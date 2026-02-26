import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';
import { telemetryQueue } from '@/lib/db/telemetry-queue';
import { checkRateLimit, submissionRateLimiter } from '@/lib/rate-limit';

/**
 * POST /api/submissions
 *
 * Decoupled submission handler:
 *
 * BEFORE (V1 — the problem):
 *   Everything — submission creation, audit token, and ALL telemetry events —
 *   was saved inside a single synchronous Prisma transaction.  With 500 students
 *   submitting at 9 AM, each carrying 300–600 telemetry events, this caused:
 *     • DB connections held open for 2–5 seconds per request.
 *     • 504 Gateway Timeouts as Vercel's 10 s function limit was breached.
 *     • Entire submissions failing if telemetry inserts errored.
 *
 * AFTER (V2 — this file):
 *   Critical path (transaction):  Submission record + AuditToken only.
 *   Background (async, no wait):  Telemetry events queued asynchronously.
 *
 *   The student receives a 200 in < 200ms.  Telemetry drains behind the scenes
 *   with automatic retry.  A failed telemetry batch has zero impact on the
 *   student's grade or submission status.
 *
 *   Rate limiter: 5 submissions / 60 seconds per user — prevents double-click
 *   spam and protects the DB during exam rushes.
 */
export async function POST(req: NextRequest) {

    // ── Rate limiting ──────────────────────────────────────────────────────
    const userId = req.headers.get('x-user-id') ??
        req.ip ??
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
        } = body;

        // Validate required fields
        if (!assignmentId || !studentId || !content || !auditToken) {
            return NextResponse.json(
                { error: 'Missing required fields: assignmentId, studentId, content, auditToken' },
                { status: 400 }
            );
        }

        // ── Critical path — atomic transaction (fast, < 2 DB ops) ─────────
        const submission = await prisma.$transaction(async (tx) => {
            const newSubmission = await tx.submission.create({
                data: {
                    assignmentId,
                    studentId,
                    content,
                    status: 'SUBMITTED',
                    submittedAt: new Date(),
                },
            });

            await tx.auditToken.create({
                data: {
                    submissionId: newSubmission.id,
                    token: auditToken,
                    metrics: auditMetrics ?? {},
                },
            });

            return newSubmission;
        });

        // ── Non-critical path — async telemetry ingestion (fire and forget) ─
        // The queue handles batching, retries, and error logging internally.
        // We never await this — the student gets their 200 immediately.
        if (Array.isArray(telemetryEvents) && telemetryEvents.length > 0) {
            telemetryQueue.enqueue(submission.id, telemetryEvents);
        }

        return NextResponse.json({
            success: true,
            submissionId: submission.id,
        });

    } catch (error) {
        console.error('[Submissions] Error saving submission:', error);
        return NextResponse.json(
            { error: 'Internal Server Error — submission could not be saved.' },
            { status: 500 }
        );
    }
}
