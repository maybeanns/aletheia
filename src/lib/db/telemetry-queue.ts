/**
 * Telemetry Ingestion Queue — BullMQ + Redis backed
 *
 * ═══════════════════════════════════════════════════════════════════════
 *  Fix 2: Asynchronous Persistence Pattern
 * ═══════════════════════════════════════════════════════════════════════
 *
 *  BEFORE (V1):
 *    Telemetry rows were inserted synchronously inside the submission
 *    Prisma transaction.  Under load this held DB connections for seconds
 *    and caused 504s.
 *
 *  AFTER (V2 — in-process buffer):
 *    We introduced an in-process TelemetryIngestionQueue that decoupled the
 *    write from the HTTP response.  This solved 504s but had a fatal flaw:
 *    if the serverless function cold-starts or the Node process recycles,
 *    any events still in the in-process buffer are LOST.
 *
 *  NOW (V3 — this file — BullMQ + Redis):
 *    The API writes the telemetry batch to a BullMQ queue backed by Redis
 *    and immediately returns 202 Accepted.  A separate background worker
 *    (`telemetry-worker.ts`) drains the queue and performs the heavy DB
 *    inserts out-of-band.
 *
 *    ┌────────────────────┐  enqueue()   ┌───────────┐   worker   ┌──────────┐
 *    │ POST /submissions  │────────────▶│   Redis    │──────────▶│ Postgres │
 *    │ (returns 202)      │              │ (BullMQ)  │           │ (Prisma) │
 *    └────────────────────┘              └───────────┘           └──────────┘
 *
 *  GRACEFUL DEGRADATION:
 *    If REDIS_URL is not set (local dev / CI), falls back to the
 *    in-process buffer from V2 so the app still works without Redis.
 *
 *  PRODUCTION TUNING:
 *    - Queue: `telemetry-ingest` with 3 retry attempts, exponential backoff.
 *    - Worker: runs in a separate process via `npx tsx src/lib/db/telemetry-worker.ts`
 *      or as a long-lived container alongside the Next.js server.
 *    - Dead Letter Queue: failed jobs move to `telemetry-ingest-dlq` for
 *      manual inspection.
 */

import { Queue } from 'bullmq';
import { getRedisConnection } from './redis';
import prisma from './prisma';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RawTelemetryEvent {
    type: string;
    timestamp: number;
    data: Record<string, unknown>;
}

export interface TelemetryJobPayload {
    submissionId: string;
    events: RawTelemetryEvent[];
    enqueuedAt: number;
}

// ---------------------------------------------------------------------------
// BullMQ Queue (primary path)
// ---------------------------------------------------------------------------

const QUEUE_NAME = 'telemetry-ingest';

let _queue: Queue<TelemetryJobPayload> | null = null;

function getBullMQQueue(): Queue<TelemetryJobPayload> | null {
    if (_queue) return _queue;

    const connection = getRedisConnection();
    if (!connection) return null;

    _queue = new Queue<TelemetryJobPayload>(QUEUE_NAME, {
        connection,
        defaultJobOptions: {
            attempts: 3,
            backoff: { type: 'exponential', delay: 2000 },
            removeOnComplete: { count: 1000 },   // keep last 1000 for analytics
            removeOnFail: { count: 5000 },    // keep failed for debugging
        },
    });

    return _queue;
}

// ---------------------------------------------------------------------------
// In-process fallback (when Redis is unavailable)
// ---------------------------------------------------------------------------

interface FallbackQueueItem {
    submissionId: string;
    events: RawTelemetryEvent[];
    enqueuedAt: number;
    attempts: number;
}

const MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = 2_000;
const BATCH_SIZE = 200;

class InProcessFallbackQueue {
    private queue: FallbackQueueItem[] = [];
    private processing = false;

    enqueue(submissionId: string, events: RawTelemetryEvent[]) {
        if (!events || events.length === 0) return;
        this.queue.push({ submissionId, events, enqueuedAt: Date.now(), attempts: 0 });
        this.drain().catch(() => { });
    }

    private async drain() {
        if (this.processing) return;
        this.processing = true;
        while (this.queue.length > 0) {
            const item = this.queue.shift()!;
            await this.processItem(item);
        }
        this.processing = false;
    }

    private async processItem(item: FallbackQueueItem): Promise<void> {
        try {
            const chunks = this.chunk(item.events, BATCH_SIZE);
            for (const chunk of chunks) {
                await prisma.telemetryEvent.createMany({
                    data: chunk.map(e => ({
                        submissionId: item.submissionId,
                        eventType: e.type,
                        data: (e.data ?? {}) as any,
                        timestamp: new Date(e.timestamp),
                    })),
                    skipDuplicates: true,
                });
            }
            console.log(
                `[TelemetryQueue:fallback] Persisted ${item.events.length} events ` +
                `for ${item.submissionId} (queued ${Date.now() - item.enqueuedAt}ms ago)`
            );
        } catch (err) {
            item.attempts++;
            if (item.attempts < MAX_ATTEMPTS) {
                console.warn(`[TelemetryQueue:fallback] Retry ${item.attempts}/${MAX_ATTEMPTS}`, err);
                await new Promise(r => setTimeout(r, RETRY_DELAY_MS * item.attempts));
                this.queue.unshift(item);
            } else {
                console.error(`[TelemetryQueue:fallback] Permanently failed for ${item.submissionId}`, err);
            }
        }
    }

    private chunk<T>(arr: T[], size: number): T[][] {
        const out: T[][] = [];
        for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
        return out;
    }
}

const fallbackQueue = new InProcessFallbackQueue();

// ---------------------------------------------------------------------------
// Public API  —  auto-selects BullMQ or in-process fallback
// ---------------------------------------------------------------------------

export const telemetryQueue = {
    /**
     * Enqueue a batch of telemetry events for async persistence.
     * Returns immediately — never awaited by the caller.
     *
     * Uses BullMQ (Redis) in production, in-process buffer in dev.
     */
    async enqueue(submissionId: string, events: RawTelemetryEvent[]): Promise<void> {
        if (!events || events.length === 0) return;

        const queue = getBullMQQueue();

        if (queue) {
            // ── Production path: BullMQ ────────────────────────────────────
            await queue.add(
                `telemetry:${submissionId}`,
                { submissionId, events, enqueuedAt: Date.now() },
                { jobId: `telemetry-${submissionId}-${Date.now()}` }
            );
            console.log(
                `[TelemetryQueue:bullmq] Enqueued ${events.length} events for ${submissionId}`
            );
        } else {
            // ── Fallback: in-process ───────────────────────────────────────
            fallbackQueue.enqueue(submissionId, events);
        }
    },
};
