/**
 * @jest-environment node
 */

/**
 * POST /api/submissions — unit tests
 *
 * Architecture note: since V2, telemetry events are persisted asynchronously
 * via TelemetryIngestionQueue, NOT inside the Prisma transaction.
 * Tests validate that:
 *   1. The submission + audit-token transaction completes synchronously.
 *   2. Telemetry is queued (fire-and-forget) — the route calls telemetryQueue.enqueue(),
 *      not prisma.telemetryEvent.createMany() directly.
 *   3. Validation and rate-limit errors return the correct HTTP status.
 */

import { POST } from './route';
import { NextRequest } from 'next/server';

// ---------------------------------------------------------------------------
// Rate limiter mock — always allow in tests (no Redis dependency)
// ---------------------------------------------------------------------------
jest.mock('@/lib/rate-limit', () => ({
    submissionRateLimiter: null,
    checkRateLimit: jest.fn().mockResolvedValue({
        allowed: true,
        remaining: 99,
        resetAt: 0,
        limiterId: 'submission',
    }),
}));

// ---------------------------------------------------------------------------
// TelemetryQueue mock — capture calls without actual DB ops
// ---------------------------------------------------------------------------
jest.mock('@/lib/db/telemetry-queue', () => ({
    telemetryQueue: { enqueue: jest.fn() },
}));

// ---------------------------------------------------------------------------
// Prisma mock — inline fns to avoid Jest hoisting issues
// ---------------------------------------------------------------------------
jest.mock('@/lib/db/prisma', () => ({
    __esModule: true,
    default: {
        $transaction: jest.fn(),
        telemetryEvent: { createMany: jest.fn() },
    },
}));

// ---------------------------------------------------------------------------
// Resolve mocked modules AFTER jest.mock calls
// ---------------------------------------------------------------------------
import prisma from '@/lib/db/prisma';
import { telemetryQueue } from '@/lib/db/telemetry-queue';

const prismaMock = prisma as jest.Mocked<typeof prisma>;
const queueMock = telemetryQueue as jest.Mocked<typeof telemetryQueue>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(body: Record<string, unknown>) {
    return new NextRequest('http://localhost/api/submissions', {
        method: 'POST',
        body: JSON.stringify(body),
        headers: { 'Content-Type': 'application/json' },
    });
}

const VALID_BODY = {
    assignmentId: 'assign-1',
    studentId: 'student-1',
    content: 'console.log("hello")',
    auditToken: 'valid.audit.token',
    auditMetrics: { typingEfficiency: 0.9 },
    telemetryEvents: [{ type: 'keystroke', data: {}, timestamp: Date.now() }],
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /api/submissions', () => {

    // Inner mocks for the tx callback — re-created each test
    let mockSubmissionCreate: jest.Mock;
    let mockAuditTokenCreate: jest.Mock;

    beforeEach(() => {
        jest.clearAllMocks();

        mockSubmissionCreate = jest.fn().mockResolvedValue({ id: 'sub-123' });
        mockAuditTokenCreate = jest.fn().mockResolvedValue({});

        // Simulate $transaction executing the callback with a tx object
        (prismaMock.$transaction as jest.Mock).mockImplementation(
            async (cb: (tx: any) => Promise<any>) =>
                cb({
                    submission: { create: mockSubmissionCreate },
                    auditToken: { create: mockAuditTokenCreate },
                })
        );
    });

    it('returns 200 with submissionId on a valid request', async () => {
        const res = await POST(makeRequest(VALID_BODY));
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.submissionId).toBe('sub-123');
    });

    it('creates submission and audit token inside the transaction', async () => {
        await POST(makeRequest(VALID_BODY));

        expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
        expect(mockSubmissionCreate).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    assignmentId: 'assign-1',
                    studentId: 'student-1',
                    status: 'SUBMITTED',
                }),
            })
        );
        expect(mockAuditTokenCreate).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({ token: 'valid.audit.token' }),
            })
        );
    });

    it('queues telemetry asynchronously via telemetryQueue.enqueue()', async () => {
        await POST(makeRequest(VALID_BODY));

        // Async queue — NOT a direct createMany call
        expect(queueMock.enqueue).toHaveBeenCalledWith(
            'sub-123',
            VALID_BODY.telemetryEvents
        );
        expect(prismaMock.telemetryEvent.createMany).not.toHaveBeenCalled();
    });

    it('does not call enqueue when telemetryEvents is empty', async () => {
        await POST(makeRequest({ ...VALID_BODY, telemetryEvents: [] }));
        expect(queueMock.enqueue).not.toHaveBeenCalled();
    });

    it('returns 400 when required fields are missing', async () => {
        const res = await POST(makeRequest({ studentId: 'student-1' }));
        const data = await res.json();

        expect(res.status).toBe(400);
        expect(data.error).toMatch(/Missing required fields/);
    });

    it('returns 500 when the DB transaction throws', async () => {
        (prismaMock.$transaction as jest.Mock).mockRejectedValueOnce(
            new Error('DB connection pool exhausted')
        );
        const res = await POST(makeRequest(VALID_BODY));
        expect(res.status).toBe(500);
    });
});
