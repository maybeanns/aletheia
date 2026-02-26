/**
 * Telemetry Worker — BullMQ Consumer
 *
 * This is a STANDALONE process that drains the `telemetry-ingest` queue
 * and writes events to Postgres via Prisma.
 *
 * HOW TO RUN:
 *   npx tsx src/lib/db/telemetry-worker.ts
 *
 * In production, run this as:
 *   - A dedicated container (Docker) alongside the Next.js server
 *   - An AWS ECS / Fargate task
 *   - A systemd service on a bare-metal / VM host
 *
 * The worker is completely decoupled from the web process.  If it goes
 * down, jobs accumulate safely in Redis and are drained when the worker
 * restarts (Redis persistence ensures nothing is lost).
 *
 * CONCURRENCY:
 *   Default concurrency = 5 (processes 5 jobs in parallel).
 *   Each job may contain 100–600 telemetry events which are batch-inserted
 *   via `createMany`, so 5 concurrent jobs ≈ 3,000 rows/second throughput.
 *
 * DEAD LETTER QUEUE (DLQ):
 *   Jobs that fail all 3 attempts remain in the `failed` state in Redis.
 *   A monitoring dashboard (BullBoard, or a cron) should alert on these.
 */

import { Worker, Job } from 'bullmq';
import { createRedisConnection } from './redis';
import prisma from './prisma';
import type { TelemetryJobPayload } from './telemetry-queue';

const QUEUE_NAME = 'telemetry-ingest';
const BATCH_SIZE = 200;
const CONCURRENCY = 5;

function chunk<T>(arr: T[], size: number): T[][] {
    const out: T[][] = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
}

async function processJob(job: Job<TelemetryJobPayload>) {
    const { submissionId, events, enqueuedAt } = job.data;

    const chunks = chunk(events, BATCH_SIZE);
    let totalPersisted = 0;

    for (const batch of chunks) {
        await prisma.telemetryEvent.createMany({
            data: batch.map(e => ({
                submissionId,
                eventType: e.type,
                data: (e.data ?? {}) as any,
                timestamp: new Date(e.timestamp),
            })),
            skipDuplicates: true,
        });
        totalPersisted += batch.length;

        // Report progress so BullBoard / monitoring can track
        await job.updateProgress(Math.round((totalPersisted / events.length) * 100));
    }

    const latencyMs = Date.now() - enqueuedAt;
    console.log(
        `[TelemetryWorker] ✓ ${totalPersisted} events for ${submissionId} ` +
        `(latency: ${latencyMs}ms, attempt: ${job.attemptsMade + 1})`
    );
}

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------

function startWorker() {
    const connection = createRedisConnection();

    if (!connection) {
        console.error('[TelemetryWorker] REDIS_URL not set. Cannot start worker. Exiting.');
        process.exit(1);
    }

    const worker = new Worker<TelemetryJobPayload>(QUEUE_NAME, processJob, {
        connection,
        concurrency: CONCURRENCY,
        // Stalled job check: if a job takes > 30s, consider it stalled
        stalledInterval: 30_000,
    });

    worker.on('completed', (job) => {
        console.log(`[TelemetryWorker] Job ${job.id} completed.`);
    });

    worker.on('failed', (job, err) => {
        console.error(`[TelemetryWorker] Job ${job?.id} failed:`, err.message);
    });

    worker.on('error', (err) => {
        console.error('[TelemetryWorker] Worker error:', err);
    });

    // Graceful shutdown
    const shutdown = async () => {
        console.log('[TelemetryWorker] Shutting down gracefully...');
        await worker.close();
        await connection.quit();
        process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);

    console.log(`[TelemetryWorker] Started. Consuming "${QUEUE_NAME}" with concurrency=${CONCURRENCY}.`);
}

// Only start when run directly (not when imported)
if (require.main === module) {
    startWorker();
}

export { startWorker };
