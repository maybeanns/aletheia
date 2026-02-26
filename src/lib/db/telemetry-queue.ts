/**
 * Telemetry Ingestion Queue
 *
 * PROBLEM:
 * The original submission route saved telemetry inside the same Prisma
 * transaction as the submission itself.  With 500 students submitting at 9 AM,
 * each carrying hundreds of raw telemetry events, those `createMany` calls:
 *   - Hold DB connections open for seconds per request.
 *   - Block the response, causing 504 Gateway Timeouts.
 *   - Can cause the entire submission to fail if telemetry insert errors out.
 *
 * SOLUTION — Async "fire and forget" with graceful degradation:
 *   1. The submission route saves only the critical records (submission + audit
 *      token) synchronously and immediately returns 200 to the student.
 *   2. Telemetry events are dispatched to this queue which writes them in the
 *      background, completely decoupled from the HTTP response path.
 *   3. If the background write fails we log but NEVER surface the error to the
 *      student — telemetry loss is acceptable; lost submissions are not.
 *
 * ARCHITECTURE:
 *   ┌─────────────────────┐        ┌───────────────────────────┐
 *   │  POST /submissions  │──202──▶│  Client (student browser) │
 *   └────────┬────────────┘        └───────────────────────────┘
 *            │  enqueue()
 *            ▼
 *   ┌─────────────────────┐   batch write   ┌─────────────────┐
 *   │  TelemetryQueue     │────────────────▶│  Postgres (via  │
 *   │  (in-process buffer)│                 │  Prisma)        │
 *   └─────────────────────┘                 └─────────────────┘
 *
 * PRODUCTION UPGRADE PATH:
 *   Replace the in-process buffer with Upstash QStash, AWS SQS, or Kafka.
 *   The enqueue() interface stays the same; only the backend changes.
 *   See the QStash webhook handler scaffold in /api/telemetry/ingest/route.ts.
 */

import prisma from '@/lib/db/prisma';

export interface RawTelemetryEvent {
    type: string;
    timestamp: number;
    data: Record<string, unknown>;
}

interface QueueItem {
    submissionId: string;
    events: RawTelemetryEvent[];
    enqueuedAt: number;
    attempts: number;
}

const MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = 2_000;
const BATCH_SIZE = 200; // max events per DB createMany call

class TelemetryIngestionQueue {
    private queue: QueueItem[] = [];
    private processing = false;

    /**
     * Enqueue a batch of telemetry events for async persistence.
     * Returns immediately — never awaited by the caller.
     */
    enqueue(submissionId: string, events: RawTelemetryEvent[]) {
        if (!events || events.length === 0) return;

        this.queue.push({
            submissionId,
            events,
            enqueuedAt: Date.now(),
            attempts: 0,
        });

        // Kick off the drain loop without blocking
        this.drain().catch(() => { /* intentionally silenced */ });
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

    private async processItem(item: QueueItem): Promise<void> {
        try {
            // Chunk events so we don't send thousands of rows in one query
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
                `[TelemetryQueue] Persisted ${item.events.length} events ` +
                `for submission ${item.submissionId} ` +
                `(queued ${Date.now() - item.enqueuedAt}ms ago)`
            );
        } catch (err) {
            item.attempts++;
            if (item.attempts < MAX_ATTEMPTS) {
                console.warn(
                    `[TelemetryQueue] Write failed (attempt ${item.attempts}/${MAX_ATTEMPTS}), ` +
                    `retrying in ${RETRY_DELAY_MS}ms...`,
                    err
                );
                await this.sleep(RETRY_DELAY_MS * item.attempts);
                this.queue.unshift(item); // put back at the front for immediate retry
            } else {
                // Final failure — log and discard.  In production, send to a DLQ.
                console.error(
                    `[TelemetryQueue] Permanently failed after ${MAX_ATTEMPTS} attempts ` +
                    `for submission ${item.submissionId}. Events dropped.`,
                    err
                );
            }
        }
    }

    private chunk<T>(arr: T[], size: number): T[][] {
        const out: T[][] = [];
        for (let i = 0; i < arr.length; i += size) {
            out.push(arr.slice(i, i + size));
        }
        return out;
    }

    private sleep(ms: number) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /** Exposed for testing */
    get queueLength() { return this.queue.length; }
}

// Module-level singleton — survives across requests in the same Node.js worker
export const telemetryQueue = new TelemetryIngestionQueue();
