'use client';

import { useState, useCallback, useRef } from 'react';
import CodeEditor, { SUPPORTED_LANGUAGES } from '@/components/editor/code-editor';
import ChatInterface from '@/components/chat/chat-interface';
import { Button } from '@/components/ui/button';
import { Play, UploadCloud, Code2, FileText, AlertTriangle, ShieldCheck, Radio, MessageSquare, X } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { AuditTokenGenerator } from '@/lib/telemetry/audit-token';
import { TelemetryCollector } from '@/lib/telemetry/collector';
import { useFlightRecorder } from '@/lib/flight-recorder/use-flight-recorder';
import dynamic from 'next/dynamic';

const TextEditor = dynamic(() => import('@/components/editor/text-editor'), {
    ssr: false,
    loading: () => (
        <div className="h-full w-full flex items-center justify-center text-muted-foreground">
            Loading editor...
        </div>
    ),
});

const RECOVERY_SECRET = 'dev-secret-key-123';

// ── Inline Toast ──────────────────────────────────────────────────────────────
interface ToastData {
    message: string;
    type: 'success' | 'error' | 'info';
}

function InlineToast({ toast, onDismiss }: { toast: ToastData; onDismiss: () => void }) {
    return (
        <div className={cn(
            'fixed bottom-4 right-4 z-50 max-w-sm flex items-start gap-3 rounded-lg border p-4 shadow-lg animate-in slide-in-from-right-5 fade-in-0 duration-300',
            toast.type === 'success' && 'bg-card border-emerald-500/30',
            toast.type === 'error' && 'bg-card border-destructive/30',
            toast.type === 'info' && 'bg-card border-primary/30',
        )}>
            <p className="text-sm flex-1 text-foreground">{toast.message}</p>
            <button onClick={onDismiss} className="text-muted-foreground hover:text-foreground shrink-0">
                <X className="h-3.5 w-3.5" />
            </button>
        </div>
    );
}

// ── Confirmation Modal ────────────────────────────────────────────────────────
function ConfirmModal({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/50" onClick={onCancel} />
            <div className="relative bg-card border border-border rounded-xl p-6 shadow-2xl max-w-sm w-full mx-4 animate-in zoom-in-95 fade-in-0 duration-200">
                <h3 className="text-lg font-semibold text-foreground mb-2">Submit Assignment?</h3>
                <p className="text-sm text-muted-foreground mb-6">
                    This will finalize your work and generate an Audit Token. You can&apos;t undo this action.
                </p>
                <div className="flex justify-end gap-3">
                    <Button variant="outline" size="sm" onClick={onCancel}>Cancel</Button>
                    <Button size="sm" className="bg-primary hover:bg-primary/90 text-primary-foreground" onClick={onConfirm}>
                        <UploadCloud className="h-3.5 w-3.5 mr-1.5" />
                        Confirm Submit
                    </Button>
                </div>
            </div>
        </div>
    );
}

export default function StudentWorkspacePage() {
    const [telemetryEvents, setTelemetryEvents] = useState<any[]>([]);
    const [code, setCode] = useState('// Write your Linked List implementation here...');
    const [textContent, setTextContent] = useState('<p>Start writing your assignment here...</p>');
    const [aiMode, setAiMode] = useState<'BRAINSTORMING' | 'EXAM'>('BRAINSTORMING');
    const [assignmentType, setAssignmentType] = useState<'code' | 'text'>('code');
    const [language, setLanguage] = useState('javascript');
    const [driftFlagged, setDriftFlagged] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [toast, setToast] = useState<ToastData | null>(null);
    const [mobileChatOpen, setMobileChatOpen] = useState(false);

    const generatorRef = useRef(new AuditTokenGenerator(RECOVERY_SECRET));
    const sessionIdRef = useRef(`session-${Date.now()}`);

    const {
        isConnected: flightRecorderConnected,
        serverEventCount: flightEventCount,
        sendEvent: sendFlightEvent,
        syncCode: syncFlightCode,
        endSession: endFlightSession,
    } = useFlightRecorder({
        studentId: 'user-student-456',
        assignmentId: 'assign-linked-list',
        sessionId: sessionIdRef.current,
    });

    const telemetryRef = useRef<TelemetryCollector | null>(null);

    const showToast = useCallback((message: string, type: ToastData['type'] = 'info') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 6000);
    }, []);

    const handleTelemetry = useCallback((events: any[]) => {
        setTelemetryEvents((prev) => [...prev, ...events]);
        for (const event of events) {
            sendFlightEvent({
                type: event.type,
                timestamp: event.timestamp,
                data: event.data ?? {},
            });
        }
    }, [sendFlightEvent]);

    const handleCollectorReady = useCallback((collector: TelemetryCollector) => {
        telemetryRef.current = collector;
    }, []);

    const handleCodeChange = useCallback((value: string | undefined) => {
        const newCode = value || '';
        setCode(newCode);
        syncFlightCode(newCode);
    }, [syncFlightCode]);

    const handleSubmit = async () => {
        setShowConfirm(false);
        setIsSubmitting(true);

        const content = assignmentType === 'code' ? code : textContent;

        const driftReport = telemetryRef.current?.finaliseSession() ?? null;
        const ikiProfile = telemetryRef.current?.getProfile() ?? null;

        if (driftReport?.isFlagged) {
            setDriftFlagged(true);
        }

        let flightRecordHash = '';
        try {
            flightRecordHash = await endFlightSession();
        } catch {
            console.warn('[FlightRecorder] Could not retrieve server hash.');
        }

        const keystrokes = telemetryEvents.filter(e => e.type === 'keystroke');
        const pastes = telemetryEvents.filter(e => e.type === 'paste');

        const metrics = {
            typingEfficiency: keystrokes.length > 0 ? content.length / keystrokes.length : 0,
            pasteCount: pastes.length,
            pasteVolume: pastes.reduce((acc: number, p: any) => acc + (p.data?.characterCount ?? 0), 0),
            totalTimeMs: 0,
            aiInteractionCount: 0,
            editDistance: 0,
            ikiDriftReport: driftReport,
            ikiProfile: ikiProfile,
        };

        const token = generatorRef.current.generateToken({
            submissionHash: generatorRef.current.generateHash(content),
            metrics,
            timestamp: Date.now(),
            sessionId: 'session-123',
            studentId: 'user-student-456',
        });

        try {
            const response = await fetch('/api/submissions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    assignmentId: 'assign-linked-list',
                    studentId: 'user-student-456',
                    content,
                    assignmentType,
                    language: assignmentType === 'code' ? language : undefined,
                    auditToken: token,
                    auditMetrics: metrics,
                    telemetryEvents,
                    flightRecordHash,
                }),
            });

            if (!response.ok && response.status !== 202) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Submission failed');
            }

            const result = await response.json();
            const verificationNote = result.verification === 'FLAGGED'
                ? ' — Flagged for manual review'
                : result.verification === 'VERIFIED'
                    ? ' — Verified ✓'
                    : '';
            const driftNote = driftReport?.isFlagged
                ? ` ⚠ Typing-signature anomaly (drift: ${driftReport.driftScore.toFixed(2)})`
                : '';

            showToast(
                `Submission accepted! ID: ${result.submissionId}${verificationNote}${driftNote}`,
                result.verification === 'FLAGGED' ? 'info' : 'success'
            );
            setTelemetryEvents([]);
        } catch (error) {
            console.error('Submission error:', error);
            showToast('Failed to submit assignment. Please try again.', 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    // ═══════════════════════════════════════════════════════════════════════
    //  RENDER
    // ═══════════════════════════════════════════════════════════════════════

    return (
        <div className="flex flex-col h-screen">
            {/* ── Workspace Header ─────────────────────────────────────────── */}
            <header className="flex items-center justify-between border-b border-border bg-card/80 backdrop-blur-sm px-4 py-2 shrink-0 z-10 flex-wrap gap-2">
                {/* Left: Assignment info + status badges */}
                <div className="flex items-center gap-3 min-w-0">
                    <h1 className="text-sm font-semibold text-foreground truncate">
                        Implementing Linked List
                    </h1>

                    {/* Status pills */}
                    <div className="hidden sm:flex items-center gap-2">
                        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                            In Progress
                        </span>

                        {/* Flight recorder */}
                        <span className={cn(
                            'flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium',
                            flightRecorderConnected
                                ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
                                : 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400'
                        )}>
                            <Radio className="h-3 w-3" />
                            {flightRecorderConnected ? `Live (${flightEventCount})` : 'Offline'}
                        </span>

                        {/* IKI drift */}
                        {driftFlagged ? (
                            <span className="flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-[11px] font-medium text-destructive">
                                <AlertTriangle className="h-3 w-3" />
                                Anomaly
                            </span>
                        ) : (
                            <span className="flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                                <ShieldCheck className="h-3 w-3" />
                                Normal
                            </span>
                        )}
                    </div>
                </div>

                {/* Right: Controls */}
                <div className="flex items-center gap-2 flex-wrap">
                    {/* Code / Text toggle */}
                    <div className="flex items-center rounded-md border border-border overflow-hidden">
                        <button
                            onClick={() => setAssignmentType('code')}
                            className={cn(
                                'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors',
                                assignmentType === 'code'
                                    ? 'bg-primary text-primary-foreground'
                                    : 'bg-card text-muted-foreground hover:bg-accent'
                            )}
                        >
                            <Code2 className="h-3.5 w-3.5" />
                            Code
                        </button>
                        <button
                            onClick={() => setAssignmentType('text')}
                            className={cn(
                                'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors',
                                assignmentType === 'text'
                                    ? 'bg-primary text-primary-foreground'
                                    : 'bg-card text-muted-foreground hover:bg-accent'
                            )}
                        >
                            <FileText className="h-3.5 w-3.5" />
                            Text
                        </button>
                    </div>

                    {/* Language picker — code mode only */}
                    {assignmentType === 'code' && (
                        <select
                            value={language}
                            onChange={(e) => setLanguage(e.target.value)}
                            aria-label="Programming language"
                            className="h-8 rounded-md border border-border bg-card px-2 text-xs text-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
                        >
                            {SUPPORTED_LANGUAGES.map((lang) => (
                                <option key={lang.value} value={lang.value}>
                                    {lang.label}
                                </option>
                            ))}
                        </select>
                    )}

                    {/* AI Mode */}
                    <select
                        value={aiMode}
                        onChange={(e) => setAiMode(e.target.value as 'BRAINSTORMING' | 'EXAM')}
                        aria-label="AI assistance mode"
                        className="h-8 rounded-md border border-border bg-card px-2 text-xs text-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
                    >
                        <option value="BRAINSTORMING">Brainstorming</option>
                        <option value="EXAM">Exam</option>
                    </select>

                    {/* Run — code mode only (disabled, not yet implemented) */}
                    {assignmentType === 'code' && (
                        <Button
                            variant="secondary"
                            size="sm"
                            className="gap-1.5 h-8 text-xs"
                            disabled
                            title="Code execution coming soon"
                        >
                            <Play className="h-3.5 w-3.5" />
                            Run
                        </Button>
                    )}

                    {/* Submit — always visible */}
                    <Button
                        onClick={() => setShowConfirm(true)}
                        size="sm"
                        className="gap-1.5 h-8 text-xs bg-primary hover:bg-primary/90 text-primary-foreground"
                        disabled={isSubmitting}
                    >
                        {isSubmitting ? (
                            <>
                                <span className="h-3.5 w-3.5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                                Submitting...
                            </>
                        ) : (
                            <>
                                <UploadCloud className="h-3.5 w-3.5" />
                                Submit
                            </>
                        )}
                    </Button>

                    {/* Mobile chat toggle */}
                    <button
                        onClick={() => setMobileChatOpen(!mobileChatOpen)}
                        className="lg:hidden p-1.5 rounded-md text-foreground hover:bg-accent transition-colors"
                        aria-label="Toggle AI chat"
                    >
                        <MessageSquare className="h-4 w-4" />
                    </button>
                </div>
            </header>

            {/* ── Main Workspace Split ──────────────────────────────────────── */}
            <div className="flex flex-1 min-h-0 overflow-hidden relative">
                {/* Editor Pane — fills available space */}
                <div className="flex-1 min-w-0 overflow-hidden">
                    {assignmentType === 'code' ? (
                        <CodeEditor
                            initialContent={code}
                            onChange={handleCodeChange}
                            language={language}
                            onTelemetry={handleTelemetry}
                            onCollectorReady={handleCollectorReady}
                        />
                    ) : (
                        <TextEditor
                            initialContent={textContent}
                            onChange={(value) => setTextContent(value || '')}
                            onTelemetry={handleTelemetry}
                        />
                    )}
                </div>

                {/* AI Chat Pane — fixed width on desktop, slide-over on mobile */}
                <div className={cn(
                    'w-[360px] shrink-0 border-l border-border',
                    'hidden lg:block',
                )}>
                    <ChatInterface
                        aiMode={aiMode}
                        assignmentContext="Implementing a Linked List in Javascript/Typescript"
                        codeConstraints={['No built-in Array methods', 'Max 100 lines']}
                        currentCode={assignmentType === 'code' ? code : textContent}
                    />
                </div>

                {/* Mobile chat overlay */}
                {mobileChatOpen && (
                    <div className="lg:hidden fixed inset-0 z-40">
                        <div className="absolute inset-0 bg-black/50" onClick={() => setMobileChatOpen(false)} />
                        <div className="absolute inset-y-0 right-0 w-full max-w-sm bg-background shadow-xl animate-in slide-in-from-right duration-200">
                            <div className="flex items-center justify-between px-3 py-2 border-b border-border">
                                <span className="text-sm font-semibold">AI Chat</span>
                                <button onClick={() => setMobileChatOpen(false)} className="p-1 rounded hover:bg-accent">
                                    <X className="h-4 w-4" />
                                </button>
                            </div>
                            <div className="h-[calc(100%-41px)]">
                                <ChatInterface
                                    aiMode={aiMode}
                                    assignmentContext="Implementing a Linked List in Javascript/Typescript"
                                    codeConstraints={['No built-in Array methods', 'Max 100 lines']}
                                    currentCode={assignmentType === 'code' ? code : textContent}
                                />
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Confirmation Modal */}
            {showConfirm && (
                <ConfirmModal
                    onConfirm={handleSubmit}
                    onCancel={() => setShowConfirm(false)}
                />
            )}

            {/* Toast */}
            {toast && <InlineToast toast={toast} onDismiss={() => setToast(null)} />}
        </div>
    );
}
