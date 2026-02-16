/**
 * @jest-environment node
 */
import { POST } from './route';
import { NextRequest } from 'next/server';
import { prismaMock } from '@/lib/db/__mocks__/prisma';

// Mock the Prisma client
jest.mock('@/lib/db/prisma', () => ({
    __esModule: true,
    default: {
        $transaction: jest.fn((callback) => callback(prismaMock)),
        submission: {
            create: jest.fn(),
        },
        auditToken: {
            create: jest.fn(),
        },
        telemetryEvent: {
            createMany: jest.fn(),
        }
    },
}));



describe('POST /api/submissions', () => {

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should create a submission, audit token, and telemetry events', async () => {
        // Mock successful creation
        prismaMock.submission.create.mockResolvedValue({ id: 'sub-123' } as any);

        const body = {
            assignmentId: 'assign-1',
            studentId: 'student-1',
            content: 'console.log("hello")',
            auditToken: 'valid.token',
            auditMetrics: { typingEfficiency: 0.9 },
            telemetryEvents: [
                { type: 'keystroke', data: {}, timestamp: Date.now() }
            ]
        };

        const req = new NextRequest('http://localhost/api/submissions', {
            method: 'POST',
            body: JSON.stringify(body)
        });

        const response = await POST(req);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.submissionId).toBe('sub-123');

        // Verify transaction calls
        expect(prismaMock.submission.create).toHaveBeenCalled();
        expect(prismaMock.auditToken.create).toHaveBeenCalled();
        expect(prismaMock.telemetryEvent.createMany).toHaveBeenCalled();
    });

    it('should return 400 if required fields are missing', async () => {
        const body = {
            // Missing assignmentId, content, etc.
            studentId: 'student-1'
        };

        const req = new NextRequest('http://localhost/api/submissions', {
            method: 'POST',
            body: JSON.stringify(body)
        });

        const response = await POST(req);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.error).toBe('Missing required fields');
    });
});
