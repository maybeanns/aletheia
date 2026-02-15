import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const {
            assignmentId,
            studentId,
            content,
            telemetryEvents,
            auditToken,
            auditMetrics
        } = body;

        // Validate required fields
        if (!assignmentId || !studentId || !content || !auditToken) {
            return NextResponse.json(
                { error: 'Missing required fields' },
                { status: 400 }
            );
        }

        // Transaction to ensure atomic save
        const submission = await prisma.$transaction(async (tx) => {
            // 1. Create Submission
            const newSubmission = await tx.submission.create({
                data: {
                    assignmentId,
                    studentId,
                    content,
                    status: 'SUBMITTED',
                    submittedAt: new Date(),
                },
            });

            // 2. Save Audit Token
            await tx.auditToken.create({
                data: {
                    submissionId: newSubmission.id,
                    token: auditToken,
                    metrics: auditMetrics || {},
                },
            });

            // 3. Save Telemetry Events (Batch)
            if (telemetryEvents && telemetryEvents.length > 0) {
                // Optimize: map events to create objects
                const eventsData = telemetryEvents.map((e: any) => ({
                    submissionId: newSubmission.id,
                    eventType: e.type,
                    data: e.data || {},
                    timestamp: new Date(e.timestamp),
                }));

                await tx.telemetryEvent.createMany({
                    data: eventsData,
                });
            }

            return newSubmission;
        });

        return NextResponse.json({
            success: true,
            submissionId: submission.id
        });

    } catch (error) {
        console.error('Error saving submission:', error);
        return NextResponse.json(
            { error: 'Internal Server Error' },
            { status: 500 }
        );
    }
}
