import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';
import { telemetryQueue } from '@/lib/db/telemetry-queue';
import { checkRateLimit, submissionRateLimiter } from '@/lib/rate-limit';
import { sessionStore } from '@/lib/flight-recorder/session-store';

/**
 * POST /api/submissions
 *
 * ═══════════════════════════════════════════════════════════════════════
 *  V3 — Full Scaling Architecture
 * ═══════════════════════════════════════════════════════════════════════
 *
 *  Fix 1 (Server-Side Streaming Verification):
 *    If a `flightRecordHash` is provided by the client, the server
 *    compares it against the flight recorder's running hash.  Mismatch
 *    means the work wasn't typed through the monitored editor — the
 *    submission status becomes FLAGGED for manual review.
 *
 *  Fix 2 (Async Persistence — BullMQ):
 *    Telemetry events are pushed to a BullMQ queue (Redis-backed) and
 *    the response returns 202 Accepted immediately.  A background worker
 *    (`telemetry-worker.ts`) drains the queue and writes to Postgres.
 *    If Redis is unavailable, falls back to an in-process buffer.
 *
 *  Critical Path (synchronous, < 200ms):
 *    1. Rate limit check
 *    2. Submission + AuditToken → Prisma transaction
 *    3. Flight record verification (if applicable)
 *
 *  Non-Critical Path (async, fire-and-forget):
 *    4. Telemetry events → BullMQ queue
 *    5. Flight session cleanup
 */
export async function POST(req: NextRequest) {

    // ── Rate limiting ──────────────────────────────────────────────────────
    const userId = req.headers.get('x-user-id') ??
        req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
        'anonymous';

    const rateLimit = await checkRateLimit(submissionRateLimiter, userId, 'submission');

    if (!rateLimit.allowed) {
        const retryAfterSec = Math.ceil((rateLimit.resetAt - Date.now()) / 1000);
        return NextResponse.json(
            { error: 'Submission rate limit reached. Please wait before resubmitting.' },
            {
                status: 429,
                headers: { 'Retry-After': String(retryAfterSec) },
            }
        );
    }

    try {
        const body = await req.json();
        const {
            assignmentId,
            studentId,
            content,
            assignmentType,
            language,
            telemetryEvents,
            auditToken,
            auditMetrics,
            flightRecordHash,  // ← NEW: client's flight recorder hash
        } = body;

        // Validate required fields
        if (!assignmentId || !studentId || !content || !auditToken) {
            return NextResponse.json(
                { error: 'Missing required fields: assignmentId, studentId, content, auditToken' },
                { status: 400 }
            );
        }

        // ── Fix 1: Server-Side Flight Record Verification ─────────────────
        let verificationVerdict: 'VERIFIED' | 'FLAGGED' | 'NO_FLIGHT_RECORD' | 'SKIPPED' = 'SKIPPED';

        if (flightRecordHash) {
            try {
                const verification = await sessionStore.verify(
                    studentId,
                    assignmentId,
                    flightRecordHash,
                    content
                );

                verificationVerdict = verification.verdict;

                console.log(
                    `[Submissions] Flight record verification: ${verification.verdict} ` +
                    `(server: ${verification.serverEventCount} events, ` +
                    `hash match: ${verification.matched})`
                );
            } catch (err) {
                console.error('[Submissions] Flight record verification error:', err);
                // Don't block the submission on verification errors
                verificationVerdict = 'NO_FLIGHT_RECORD';
            }
        }

        // Determine the initial submission status based on verification
        const initialStatus = verificationVerdict === 'FLAGGED' ? 'SUBMITTED' : 'SUBMITTED';
        // NOTE: Both map to SUBMITTED for now because 'FLAGGED' is not a SubmissionStatus enum value.
        // The flag is stored in the auditMetrics JSON and surfaced in the faculty dashboard.

        // ── Critical path — atomic transaction (fast, 2 DB ops) ───────────
        const submission = await prisma.$transaction(async (tx) => {
            const newSubmission = await tx.submission.create({
                data: {
                    assignmentId,
                    studentId,
                    content,
                    status: initialStatus,
                    submittedAt: new Date(),
                },
            });

            // Enrich audit metrics with server-side verification result
            const enrichedMetrics = {
                ...(auditMetrics ?? {}),
                flightRecordVerification: {
                    verdict: verificationVerdict,
                    clientHash: flightRecordHash ?? null,
                    verifiedAt: new Date().toISOString(),
                },
            };

            await tx.auditToken.create({
                data: {
                    submissionId: newSubmission.id,
                    token: auditToken,
                    metrics: enrichedMetrics,
                },
            });

            return newSubmission;
        });

        // ── Fix 2: Async telemetry ingestion (fire and forget) ────────────
        // Pushed to BullMQ (Redis) or in-process fallback.
        // We never await this — the student gets their 202 immediately.
        if (Array.isArray(telemetryEvents) && telemetryEvents.length > 0) {
            // Don't await — fire and forget
            telemetryQueue.enqueue(submission.id, telemetryEvents).catch((err) => {
                console.error('[Submissions] Telemetry enqueue error (non-fatal):', err);
            });
        }

        // ── Cleanup flight session (background) ──────────────────────────
        if (flightRecordHash) {
            sessionStore.destroy(studentId, assignmentId).catch(() => { });
        }

        // ── Return 202 Accepted ───────────────────────────────────────────
        // 202 signals "we received your submission; telemetry is still processing"
        return NextResponse.json(
            {
                success: true,
                submissionId: submission.id,
                verification: verificationVerdict,
            },
            { status: 202 }
        );

    } catch (error) {
        console.error('[Submissions] Error saving submission:', error);
        return NextResponse.json(
            { error: 'Internal Server Error — submission could not be saved.' },
            { status: 500 }
        );
    }
}
