'use client';

import { useState, useEffect } from 'react';
import CodeEditor from '@/components/editor/code-editor';
import { Button } from '@/components/ui/button';
import { Badge } from 'lucide-react'; // Placeholder for badge component if needed, or use generic
import { CheckCircle, AlertTriangle, Clock, Keyboard, FileText, MessageSquare } from 'lucide-react';

// Verification Badge Component
function VerificationBadge({ isValid }: { isValid: boolean }) {
    return (
        <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium ${isValid ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
            }`}>
            {isValid ? <CheckCircle className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
            {isValid ? 'Authentic Submission' : 'Flagged for Review'}
        </div>
    );
}

export default function SubmissionReviewPage({ params }: { params: { submissionId: string } }) {
    // Mock Data - in real app fetch via API
    const submission = {
        studentName: 'Jane Doe',
        assignmentTitle: 'Implementing Linked List',
        submittedAt: new Date().toLocaleString(),
        grade: null,
        status: 'SUBMITTED',
        code: `class LinkedList {
    constructor() {
        this.head = null;
        this.size = 0;
    }

    add(element) {
        // Implementation
    }
}`,
        metrics: {
            typingEfficiency: 0.85, // High typing (good)
            pasteCount: 1, // Low paste (good)
            pasteVolume: 50,
            aiInteractionCount: 5,
            totalTimeMs: 4500000 // 1.25 hours
        },
        auditToken: 'valid-token-12345'
    };

    return (
        <div className="flex h-screen flex-col overflow-hidden">
            {/* Header */}
            <header className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-4 dark:bg-gray-900 dark:border-gray-800">
                <div>
                    <div className="flex items-center gap-3">
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{submission.studentName}</h1>
                        <VerificationBadge isValid={true} />
                    </div>
                    <p className="text-sm text-gray-500">{submission.assignmentTitle} • Submitted {submission.submittedAt}</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline">Request Viva</Button>
                    <Button className="bg-blue-600 hover:bg-blue-700 text-white">Grade Submission</Button>
                </div>
            </header>

            <div className="flex flex-1 overflow-hidden">
                {/* Main Content - Code Viewer */}
                <div className="flex-1 flex flex-col min-w-0 border-r border-gray-200 dark:border-gray-800">
                    <div className="flex-1 relative">
                        <CodeEditor
                            initialContent={submission.code}
                            language="javascript"
                            readOnly={true}
                        />
                    </div>
                </div>

                {/* Sidebar - Process Analytics */}
                <div className="w-[400px] shrink-0 overflow-y-auto bg-gray-50 dark:bg-gray-900/50 p-6 border-l border-gray-200 dark:border-gray-800">
                    <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">Process Forensics</h3>

                    <div className="space-y-6">
                        {/* Key Metrics Cards */}
                        <div className="grid grid-cols-2 gap-3">
                            <MetricCard
                                icon={Keyboard}
                                label="Typing Efficiency"
                                value={`${(submission.metrics.typingEfficiency * 100).toFixed(0)}%`}
                                subtext="Manual entry rate"
                            />
                            <MetricCard
                                icon={FileText}
                                label="Paste Events"
                                value={submission.metrics.pasteCount.toString()}
                                subtext={`${submission.metrics.pasteVolume} chars total`}
                                alert={submission.metrics.pasteCount > 5}
                            />
                            <MetricCard
                                icon={MessageSquare}
                                label="AI Interactions"
                                value={submission.metrics.aiInteractionCount.toString()}
                                subtext="Questions asked"
                            />
                            <MetricCard
                                icon={Clock}
                                label="Total Time"
                                value="1h 15m"
                                subtext="Active editing"
                            />
                        </div>

                        {/* Timeline Visualization (Placeholder) */}
                        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                            <h4 className="text-sm font-medium mb-3">Activity Timeline</h4>
                            <div className="h-4 w-full bg-gray-100 rounded-full flex overflow-hidden">
                                <div className="h-full bg-green-500 w-[60%]" title="Typing"></div>
                                <div className="h-full bg-yellow-500 w-[10%]" title="AI Chat"></div>
                                <div className="h-full bg-blue-500 w-[5%]" title="Paste"></div>
                                <div className="h-full bg-green-500 w-[25%]" title="Typing"></div>
                            </div>
                            <div className="flex justify-between text-xs text-gray-500 mt-2">
                                <span>Start</span>
                                <span>Submission</span>
                            </div>
                        </div>

                        {/* AI Chat Log Preview */}
                        <div className="space-y-2">
                            <h4 className="text-sm font-medium">Recent AI Questions</h4>
                            <div className="text-sm border border-gray-200 dark:border-gray-700 rounded-md p-3 bg-white dark:bg-gray-800">
                                <p className="font-medium text-blue-600">Student:</p>
                                <p className="text-gray-600 dark:text-gray-300 mb-2">"How do I reverse the pointers?"</p>
                                <p className="font-medium text-purple-600">Aletheia:</p>
                                <p className="text-gray-600 dark:text-gray-300">"Think about what 'next' needs to point to. If you are at node B, and previous was A..."</p>
                            </div>
                        </div>

                    </div>
                </div>
            </div>
        </div>
    );
}

function MetricCard({ icon: Icon, label, value, subtext, alert }: any) {
    return (
        <div className={`p-3 rounded-lg border ${alert ? 'border-red-300 bg-red-50 dark:bg-red-900/10' : 'border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800'}`}>
            <div className="flex items-center gap-2 mb-1">
                <Icon className={`h-4 w-4 ${alert ? 'text-red-500' : 'text-gray-500'}`} />
                <span className="text-xs font-medium text-gray-500">{label}</span>
            </div>
            <div className="text-xl font-bold text-gray-900 dark:text-gray-100">{value}</div>
            <div className="text-xs text-gray-400">{subtext}</div>
        </div>
    );
}
