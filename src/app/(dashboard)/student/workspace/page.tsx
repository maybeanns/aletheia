'use client';

import { useState, useCallback, useRef } from 'react';
import CodeEditor, { SUPPORTED_LANGUAGES } from '@/components/editor/code-editor';
import ChatInterface from '@/components/chat/chat-interface';
import { Button } from '@/components/ui/button';
import { Play, UploadCloud, Code2, FileText, AlertTriangle, ShieldCheck, Radio } from 'lucide-react';
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

export default function StudentWorkspacePage() {
    const [telemetryEvents, setTelemetryEvents] = useState<any[]>([]);
    const [code, setCode] = useState('// Write your Linked List implementation here...');
    const [textContent, setTextContent] = useState('<p>Start writing your assignment here...</p>');
    const [aiMode, setAiMode] = useState<'BRAINSTORMING' | 'EXAM'>('BRAINSTORMING');
    const [assignmentType, setAssignmentType] = useState<'code' | 'text'>('code');
    const [language, setLanguage] = useState('javascript');
    const [driftFlagged, setDriftFlagged] = useState(false);

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
                ? '\n🔍 Server verification: FLAGGED for manual review'
                : result.verification === 'VERIFIED'
                    ? '\n✅ Server verification: VERIFIED'
                    : '';
            const driftNote = driftReport?.isFlagged
                ? `\n⚠️  Typing-signature anomaly (drift: ${driftReport.driftScore.toFixed(2)})`
                : '';
            alert(
                `Submission accepted! ID: ${result.submissionId}` +
                `\nAudit Token: ${token.substring(0, 20)}...` +
                verificationNote + driftNote
            );
            setTelemetryEvents([]);
        } catch (error) {
            console.error('Submission error:', error);
            alert('Failed to submit assignment. Please try again.');
        }
    };

    // ═══════════════════════════════════════════════════════════════════════
    //  RENDER
    // ═══════════════════════════════════════════════════════════════════════

    return (
        <div className="flex flex-col h-screen">
            {/* ── Workspace Header ─────────────────────────────────────────── */}
            <header className="flex items-center justify-between border-b border-border bg-card/80 backdrop-blur-sm px-4 py-2 shrink-0 z-10">
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
                <div className="flex items-center gap-2">
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
                        className="h-8 rounded-md border border-border bg-card px-2 text-xs text-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
                    >
                        <option value="BRAINSTORMING">Brainstorming</option>
                        <option value="EXAM">Exam</option>
                    </select>

                    {/* Run — code mode only */}
                    {assignmentType === 'code' && (
                        <Button variant="secondary" size="sm" className="gap-1.5 h-8 text-xs">
                            <Play className="h-3.5 w-3.5" />
                            Run
                        </Button>
                    )}

                    {/* Submit — always visible */}
                    <Button
                        onClick={handleSubmit}
                        size="sm"
                        className="gap-1.5 h-8 text-xs bg-primary hover:bg-primary/90 text-primary-foreground"
                    >
                        <UploadCloud className="h-3.5 w-3.5" />
                        Submit
                    </Button>
                </div>
            </header>

            {/* ── Main Workspace Split ──────────────────────────────────────── */}
            <div className="flex flex-1 min-h-0 overflow-hidden">
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

                {/* AI Chat Pane — fixed width, hidden on small screens */}
                <div className="w-[360px] shrink-0 hidden lg:block border-l border-border">
                    <ChatInterface
                        aiMode={aiMode}
                        assignmentContext="Implementing a Linked List in Javascript/Typescript"
                        codeConstraints={['No built-in Array methods', 'Max 100 lines']}
                        currentCode={assignmentType === 'code' ? code : textContent}
                    />
                </div>
            </div>
        </div>
    );
}
