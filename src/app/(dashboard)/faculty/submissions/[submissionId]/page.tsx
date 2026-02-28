'use client';

import { useState } from 'react';
import CodeEditor from '@/components/editor/code-editor';
import { Button } from '@/components/ui/button';
import { CheckCircle, AlertTriangle, Clock, Keyboard, FileText, MessageSquare } from 'lucide-react';

// Verification Badge Component
function VerificationBadge({ isValid }: { isValid: boolean }) {
    return (
        <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium ${isValid
            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
            : 'bg-destructive/10 text-destructive'
            }`}>
            {isValid ? <CheckCircle className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
            {isValid ? 'Authentic Submission' : 'Flagged for Review'}
        </div>
    );
}

export default function SubmissionReviewPage({ params }: { params: { submissionId: string } }) {
    const [gradeAction, setGradeAction] = useState<string | null>(null);

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
            typingEfficiency: 0.85,
            pasteCount: 1,
            pasteVolume: 50,
            aiInteractionCount: 5,
            totalTimeMs: 4500000
        },
        auditToken: 'valid-token-12345'
    };

    const handleGrade = () => {
        setGradeAction('Grading interface coming soon. This will open a grading rubric modal.');
        setTimeout(() => setGradeAction(null), 4000);
    };

    const handleRequestViva = () => {
        setGradeAction('Viva question generation coming soon. AI-generated questions based on the submission will appear here.');
        setTimeout(() => setGradeAction(null), 4000);
    };

    return (
        <div className="flex h-screen flex-col overflow-hidden">
            {/* Header */}
            <header className="flex items-center justify-between border-b border-border bg-card px-6 py-4">
                <div>
                    <div className="flex items-center gap-3">
                        <h1 className="text-2xl font-bold text-foreground">{submission.studentName}</h1>
                        <VerificationBadge isValid={true} />
                    </div>
                    <p className="text-sm text-muted-foreground">{submission.assignmentTitle} • Submitted {submission.submittedAt}</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={handleRequestViva}>Request Viva</Button>
                    <Button className="bg-primary hover:bg-primary/90 text-primary-foreground" onClick={handleGrade}>Grade Submission</Button>
                </div>
            </header>

            {/* Action feedback toast */}
            {gradeAction && (
                <div className="mx-6 mt-3 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-foreground animate-in fade-in-0 slide-in-from-top-2 duration-200">
                    {gradeAction}
                </div>
            )}

            <div className="flex flex-1 overflow-hidden">
                {/* Main Content - Code Viewer */}
                <div className="flex-1 flex flex-col min-w-0 border-r border-border">
                    <div className="flex-1 relative">
                        <CodeEditor
                            initialContent={submission.code}
                            language="javascript"
                            readOnly={true}
                        />
                    </div>
                </div>

                {/* Sidebar - Process Analytics */}
                <div className="w-[400px] shrink-0 overflow-y-auto bg-muted/30 p-6 border-l border-border">
                    <h3 className="text-lg font-semibold mb-4 text-foreground">Process Forensics</h3>

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

                        {/* Timeline Visualization */}
                        <div className="bg-card p-4 rounded-lg border border-border">
                            <h4 className="text-sm font-medium mb-3 text-foreground">Activity Timeline</h4>
                            <div className="h-4 w-full bg-muted rounded-full flex overflow-hidden">
                                <div className="h-full bg-emerald-500 w-[60%]" title="Typing"></div>
                                <div className="h-full bg-amber-500 w-[10%]" title="AI Chat"></div>
                                <div className="h-full bg-blue-500 w-[5%]" title="Paste"></div>
                                <div className="h-full bg-emerald-500 w-[25%]" title="Typing"></div>
                            </div>
                            <div className="flex justify-between text-xs text-muted-foreground mt-2">
                                <span>Start</span>
                                <span>Submission</span>
                            </div>
                        </div>

                        {/* AI Chat Log Preview */}
                        <div className="space-y-2">
                            <h4 className="text-sm font-medium text-foreground">Recent AI Questions</h4>
                            <div className="text-sm border border-border rounded-md p-3 bg-card">
                                <p className="font-medium text-primary">Student:</p>
                                <p className="text-muted-foreground mb-2">&quot;How do I reverse the pointers?&quot;</p>
                                <p className="font-medium text-accent-foreground">Aletheia:</p>
                                <p className="text-muted-foreground">&quot;Think about what &apos;next&apos; needs to point to. If you are at node B, and previous was A...&quot;</p>
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
        <div className={`p-3 rounded-lg border ${alert ? 'border-destructive/30 bg-destructive/5' : 'border-border bg-card'}`}>
            <div className="flex items-center gap-2 mb-1">
                <Icon className={`h-4 w-4 ${alert ? 'text-destructive' : 'text-muted-foreground'}`} />
                <span className="text-xs font-medium text-muted-foreground">{label}</span>
            </div>
            <div className="text-xl font-bold text-foreground">{value}</div>
            <div className="text-xs text-muted-foreground">{subtext}</div>
        </div>
    );
}
