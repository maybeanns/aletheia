/**
 * Flight Recorder — Server-Side Session Store
 *
 * ═══════════════════════════════════════════════════════════════════════
 *  Fix 1: Server-Side Streaming Verification
 * ═══════════════════════════════════════════════════════════════════════
 *
 * PROBLEM (Root of Trust on the Client):
 *   In V1/V2, the audit token (HMAC hash of the submission + metrics) was
 *   computed entirely in the student's browser.  A sophisticated attacker
 *   can patch the JS to generate a legitimate-looking audit token for
 *   work they didn't actually type.  The browser is an UNTRUSTED environment.
 *
 * SOLUTION (Root of Trust on the Server):
 *   The client streams telemetry events to the server via WebSocket
 *   DURING the entire coding session.  The server maintains its own
 *   running SHA-256 hash — the "flight record" — that accumulates
 *   every keystroke and code-change event in real-time.
 *
 *   At submission time, the server compares:
 *     • The client-submitted audit token hash
 *     • The server's accumulated flight-record hash
 *
 *   If they don't match → the submission is flagged for manual review.
 *   The student can never forge a matching flight record because they
 *   would need to replay the exact stream of events that the server
 *   independently accumulated.
 *
 * ARCHITECTURE:
 *
 *   Browser (WebSocket)        Server (Flight Recorder)
 *   ┌──────────────────┐       ┌────────────────────────┐
 *   │ keystroke event   │──ws──▶│ sessionStore.push()    │
 *   │ paste event       │──ws──▶│   → running SHA-256    │
 *   │ code-change event │──ws──▶│   → event counter      │
 *   └──────────────────┘       └────────────────────────┘
 *                                        │
 *                               On submission:
 *                                        ▼
 *                               Compare hashes
 *                               MATCH → VERIFIED
 *                               MISMATCH → FLAGGED
 *
 * STORAGE:
 *   - In-memory Map (single-server / dev) — this file
 *   - Redis hash (production / multi-server) — uses getRedisConnection()
 *   Sessions auto-expire after SESSION_TTL_MS to prevent memory leaks.
 */

import { createHmac } from 'crypto';
import { getRedisConnection } from '@/lib/db/redis';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FlightSession {
    sessionId: string;
    studentId: string;
    assignmentId: string;
    /** Running SHA-256 HMAC of all streamed events */
    runningHash: string;
    /** Total events received from the client */
    eventCount: number;
    /** Epoch ms when the session was created */
    createdAt: number;
    /** Epoch ms of the last event received */
    lastEventAt: number;
    /** Snapshot of the latest code state (for comparison) */
    latestCodeSnapshot: string;
}

export interface FlightEvent {
    type: 'keystroke' | 'paste' | 'code-change' | 'idle';
    timestamp: number;
    data: Record<string, unknown>;
}

export interface VerificationResult {
    matched: boolean;
    serverHash: string;
    clientHash: string;
    serverEventCount: number;
    driftDetected: boolean;
    /** Human-readable verdict */
    verdict: 'VERIFIED' | 'FLAGGED' | 'NO_FLIGHT_RECORD';
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Sessions expire after 6 hours of inactivity */
const SESSION_TTL_MS = 6 * 60 * 60 * 1000;

/** HMAC secret — in production, use a proper env var */
const HMAC_SECRET = process.env.FLIGHT_RECORDER_SECRET || 'flight-recorder-dev-secret';

/** Redis key prefix for flight sessions */
const REDIS_KEY_PREFIX = 'aletheia:flight:';

// ---------------------------------------------------------------------------
// In-memory store (single-server / dev fallback)
// ---------------------------------------------------------------------------

const memoryStore = new Map<string, FlightSession>();

// Periodic cleanup of expired sessions
setInterval(() => {
    const now = Date.now();
    for (const [key, session] of memoryStore) {
        if (now - session.lastEventAt > SESSION_TTL_MS) {
            memoryStore.delete(key);
        }
    }
}, 60_000); // every minute

// ---------------------------------------------------------------------------
// Core functions
// ---------------------------------------------------------------------------

function computeSessionKey(studentId: string, assignmentId: string): string {
    return `${studentId}:${assignmentId}`;
}

/**
 * Compute the next running hash by folding a new event into the current hash.
 * Uses HMAC-SHA256 with a server-side secret — unforgeable by the client.
 */
function foldEventIntoHash(currentHash: string, event: FlightEvent): string {
    const payload = `${currentHash}|${event.type}|${event.timestamp}|${JSON.stringify(event.data)}`;
    return createHmac('sha256', HMAC_SECRET).update(payload).digest('hex');
}

// ---------------------------------------------------------------------------
// Session Store (auto-selects Redis or in-memory)
// ---------------------------------------------------------------------------

export const sessionStore = {
    /**
     * Create or resume a flight recording session.
     */
    async create(studentId: string, assignmentId: string, sessionId: string): Promise<FlightSession> {
        const key = computeSessionKey(studentId, assignmentId);
        const now = Date.now();

        const session: FlightSession = {
            sessionId,
            studentId,
            assignmentId,
            runningHash: createHmac('sha256', HMAC_SECRET)
                .update(`init:${sessionId}:${now}`)
                .digest('hex'),
            eventCount: 0,
            createdAt: now,
            lastEventAt: now,
            latestCodeSnapshot: '',
        };

        const redis = getRedisConnection();
        if (redis) {
            await redis.set(
                `${REDIS_KEY_PREFIX}${key}`,
                JSON.stringify(session),
                'PX', SESSION_TTL_MS
            );
        } else {
            memoryStore.set(key, session);
        }

        console.log(`[FlightRecorder] Session created: ${key} (sid: ${sessionId})`);
        return session;
    },

    /**
     * Push a telemetry event into the running flight record.
     * Updates the running hash and event count atomically.
     */
    async push(studentId: string, assignmentId: string, event: FlightEvent): Promise<void> {
        const key = computeSessionKey(studentId, assignmentId);
        const redis = getRedisConnection();

        let session: FlightSession | null = null;

        if (redis) {
            const raw = await redis.get(`${REDIS_KEY_PREFIX}${key}`);
            if (raw) session = JSON.parse(raw);
        } else {
            session = memoryStore.get(key) ?? null;
        }

        if (!session) {
            console.warn(`[FlightRecorder] No session for ${key} — event dropped.`);
            return;
        }

        // Fold this event into the running hash
        session.runningHash = foldEventIntoHash(session.runningHash, event);
        session.eventCount++;
        session.lastEventAt = Date.now();

        // Track code snapshots from code-change events
        if (event.type === 'code-change' && typeof event.data?.code === 'string') {
            session.latestCodeSnapshot = event.data.code as string;
        }

        // Persist
        if (redis) {
            await redis.set(
                `${REDIS_KEY_PREFIX}${key}`,
                JSON.stringify(session),
                'PX', SESSION_TTL_MS
            );
        } else {
            memoryStore.set(key, session);
        }
    },

    /**
     * Retrieve the current flight session (for verification at submission time).
     */
    async get(studentId: string, assignmentId: string): Promise<FlightSession | null> {
        const key = computeSessionKey(studentId, assignmentId);
        const redis = getRedisConnection();

        if (redis) {
            const raw = await redis.get(`${REDIS_KEY_PREFIX}${key}`);
            return raw ? JSON.parse(raw) : null;
        }

        return memoryStore.get(key) ?? null;
    },

    /**
     * Verify a submission against the server's flight record.
     *
     * @param studentId   — the student submitting
     * @param assignmentId — which assignment
     * @param clientHash   — the hash computed by the client's audit token
     * @param submittedCode — the final code content being submitted
     * @returns VerificationResult with verdict VERIFIED / FLAGGED / NO_FLIGHT_RECORD
     */
    async verify(
        studentId: string,
        assignmentId: string,
        clientHash: string,
        submittedCode: string
    ): Promise<VerificationResult> {
        const session = await this.get(studentId, assignmentId);

        if (!session) {
            return {
                matched: false,
                serverHash: '',
                clientHash,
                serverEventCount: 0,
                driftDetected: false,
                verdict: 'NO_FLIGHT_RECORD',
            };
        }

        // Primary check: do the hashes match?
        const hashMatched = session.runningHash === clientHash;

        // Secondary check: does the submitted code match the last snapshot?
        // (catches cases where the student copies pre-written code at the last second)
        const codeMatched = session.latestCodeSnapshot === submittedCode;

        // Drift: if the code matches but hashes don't, or vice versa
        const driftDetected = !hashMatched || !codeMatched;

        const verdict = (hashMatched && codeMatched)
            ? 'VERIFIED'
            : 'FLAGGED';

        console.log(
            `[FlightRecorder] Verification for ${studentId}/${assignmentId}: ` +
            `hash=${hashMatched ? '✓' : '✗'} code=${codeMatched ? '✓' : '✗'} → ${verdict}`
        );

        return {
            matched: hashMatched && codeMatched,
            serverHash: session.runningHash,
            clientHash,
            serverEventCount: session.eventCount,
            driftDetected,
            verdict,
        };
    },

    /**
     * Clean up a session after verification (or on timeout).
     */
    async destroy(studentId: string, assignmentId: string): Promise<void> {
        const key = computeSessionKey(studentId, assignmentId);
        const redis = getRedisConnection();

        if (redis) {
            await redis.del(`${REDIS_KEY_PREFIX}${key}`);
        } else {
            memoryStore.delete(key);
        }
    },
};
