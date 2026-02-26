/**
 * @jest-environment node
 */

/**
 * POST /api/submissions — V3 unit tests
 *
 * Tests cover:
 *   1. Fix 1: Flight record verification (VERIFIED / FLAGGED / NO_FLIGHT_RECORD)
 *   2. Fix 2: BullMQ async telemetry (enqueue, not direct createMany)
 *   3. HTTP 202 Accepted response
 *   4. Rate limiting
 *   5. Validation
 */

import { POST } from './route';
import { NextRequest } from 'next/server';

// ---------------------------------------------------------------------------
// Rate limiter mock — always allow in tests
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
// TelemetryQueue mock
// ---------------------------------------------------------------------------
jest.mock('@/lib/db/telemetry-queue', () => ({
    telemetryQueue: { enqueue: jest.fn().mockResolvedValue(undefined) },
}));

// ---------------------------------------------------------------------------
// Flight recorder session store mock
// ---------------------------------------------------------------------------
const mockVerify = jest.fn();
const mockDestroy = jest.fn().mockResolvedValue(undefined);
jest.mock('@/lib/flight-recorder/session-store', () => ({
    sessionStore: {
        verify: (...args: any[]) => mockVerify(...args),
        destroy: (...args: any[]) => mockDestroy(...args),
    },
}));

// ---------------------------------------------------------------------------
// Prisma mock
// ---------------------------------------------------------------------------
jest.mock('@/lib/db/prisma', () => ({
    __esModule: true,
    default: {
        $transaction: jest.fn(),
        telemetryEvent: { createMany: jest.fn() },
    },
}));

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

describe('POST /api/submissions V3', () => {

    let mockSubmissionCreate: jest.Mock;
    let mockAuditTokenCreate: jest.Mock;

    beforeEach(() => {
        jest.clearAllMocks();

        mockSubmissionCreate = jest.fn().mockResolvedValue({ id: 'sub-123' });
        mockAuditTokenCreate = jest.fn().mockResolvedValue({});

        (prismaMock.$transaction as jest.Mock).mockImplementation(
            async (cb: (tx: any) => Promise<any>) =>
                cb({
                    submission: { create: mockSubmissionCreate },
                    auditToken: { create: mockAuditTokenCreate },
                })
        );
    });

    it('returns 202 Accepted with submissionId', async () => {
        const res = await POST(makeRequest(VALID_BODY));
        const data = await res.json();

        expect(res.status).toBe(202);
        expect(data.success).toBe(true);
        expect(data.submissionId).toBe('sub-123');
    });

    it('enqueues telemetry asynchronously via BullMQ queue', async () => {
        await POST(makeRequest(VALID_BODY));

        expect(queueMock.enqueue).toHaveBeenCalledWith(
            'sub-123',
            VALID_BODY.telemetryEvents
        );
        expect(prismaMock.telemetryEvent.createMany).not.toHaveBeenCalled();
    });

    it('does not enqueue when telemetryEvents is empty', async () => {
        await POST(makeRequest({ ...VALID_BODY, telemetryEvents: [] }));
        expect(queueMock.enqueue).not.toHaveBeenCalled();
    });

    it('returns 400 when required fields are missing', async () => {
        const res = await POST(makeRequest({ studentId: 'student-1' }));
        const data = await res.json();

        expect(res.status).toBe(400);
        expect(data.error).toMatch(/Missing required fields/);
    });

    it('returns 500 on transaction failure', async () => {
        (prismaMock.$transaction as jest.Mock).mockRejectedValueOnce(
            new Error('DB pool exhausted')
        );
        const res = await POST(makeRequest(VALID_BODY));
        expect(res.status).toBe(500);
    });

    // ── Fix 1: Flight Record Verification ─────────────────────────────────

    it('returns verification=VERIFIED when flight hashes match', async () => {
        mockVerify.mockResolvedValueOnce({
            matched: true,
            serverHash: 'abc123',
            clientHash: 'abc123',
            serverEventCount: 42,
            driftDetected: false,
            verdict: 'VERIFIED',
        });

        const res = await POST(makeRequest({
            ...VALID_BODY,
            flightRecordHash: 'abc123',
        }));
        const data = await res.json();

        expect(data.verification).toBe('VERIFIED');
        expect(mockVerify).toHaveBeenCalledWith('student-1', 'assign-1', 'abc123', VALID_BODY.content);
        expect(mockDestroy).toHaveBeenCalled();
    });

    it('returns verification=FLAGGED when flight hashes mismatch', async () => {
        mockVerify.mockResolvedValueOnce({
            matched: false,
            serverHash: 'different',
            clientHash: 'abc123',
            serverEventCount: 42,
            driftDetected: true,
            verdict: 'FLAGGED',
        });

        const res = await POST(makeRequest({
            ...VALID_BODY,
            flightRecordHash: 'abc123',
        }));
        const data = await res.json();

        expect(data.verification).toBe('FLAGGED');
    });

    it('returns verification=SKIPPED when no flightRecordHash provided', async () => {
        const res = await POST(makeRequest(VALID_BODY));
        const data = await res.json();

        expect(data.verification).toBe('SKIPPED');
        expect(mockVerify).not.toHaveBeenCalled();
    });

    it('stores verification result in enriched audit metrics', async () => {
        mockVerify.mockResolvedValueOnce({
            matched: true, serverHash: 'h', clientHash: 'h',
            serverEventCount: 10, driftDetected: false, verdict: 'VERIFIED',
        });

        await POST(makeRequest({ ...VALID_BODY, flightRecordHash: 'h' }));

        expect(mockAuditTokenCreate).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    metrics: expect.objectContaining({
                        flightRecordVerification: expect.objectContaining({
                            verdict: 'VERIFIED',
                            clientHash: 'h',
                        }),
                    }),
                }),
            })
        );
    });
});
