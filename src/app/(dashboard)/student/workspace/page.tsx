'use client';

import { useState, useCallback, useRef } from 'react';
import CodeEditor, { SUPPORTED_LANGUAGES } from '@/components/editor/code-editor';
import ChatInterface from '@/components/chat/chat-interface';
import { Button } from '@/components/ui/button';
import { Play, UploadCloud, Code2, FileText } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { AuditTokenGenerator } from '@/lib/telemetry/audit-token';
import dynamic from 'next/dynamic';

// Lazy-load text editor to avoid SSR issues with TipTap
const TextEditor = dynamic(() => import('@/components/editor/text-editor'), {
    ssr: false,
    loading: () => (
        <div className="h-full w-full flex items-center justify-center text-muted-foreground">
            Loading editor...
        </div>
    ),
});

// In a real app, this would come from an environment variable
const RECOVERY_SECRET = 'dev-secret-key-123';

export default function StudentWorkspacePage() {
    const [telemetryEvents, setTelemetryEvents] = useState<any[]>([]);
    const [code, setCode] = useState('// Write your Linked List implementation here...');
    const [textContent, setTextContent] = useState('<p>Start writing your assignment here...</p>');
    const [aiMode, setAiMode] = useState<'BRAINSTORMING' | 'EXAM'>('BRAINSTORMING');
    const [assignmentType, setAssignmentType] = useState<'code' | 'text'>('code');
    const [language, setLanguage] = useState('javascript');
    const generatorRef = useRef(new AuditTokenGenerator(RECOVERY_SECRET));

    const handleTelemetry = useCallback((events: any[]) => {
        setTelemetryEvents((prev) => [...prev, ...events]);
    }, []);

    const handleSubmit = async () => {
        const content = assignmentType === 'code' ? code : textContent;

        // Calculate basic metrics from telemetry
        const keystrokes = telemetryEvents.filter(e => e.type === 'keystroke');
        const pastes = telemetryEvents.filter(e => e.type === 'paste');

        const metrics = {
            typingEfficiency: keystrokes.length > 0 ? content.length / keystrokes.length : 0,
            pasteCount: pastes.length,
            pasteVolume: pastes.reduce((acc, p) => acc + (p.data.range?.endColumn - p.data.range?.startColumn || 0), 0),
            totalTimeMs: 0,
            aiInteractionCount: 0,
            editDistance: 0
        };

        const token = generatorRef.current.generateToken({
            submissionHash: generatorRef.current.generateHash(content),
            metrics,
            timestamp: Date.now(),
            sessionId: 'session-123',
            studentId: 'user-student-456'
        });

        console.log('Submission Token Generated:', token);

        try {
            const response = await fetch('/api/submissions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    assignmentId: 'assign-linked-list',
                    studentId: 'user-student-456',
                    content: content,
                    assignmentType,
                    language: assignmentType === 'code' ? language : undefined,
                    auditToken: token,
                    auditMetrics: metrics,
                    telemetryEvents: telemetryEvents
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Submission failed');
            }

            const result = await response.json();
            alert(`Submission successful! ID: ${result.submissionId}\nAudit Token: ${token.substring(0, 20)}...`);

            // Optional: Clear events after success
            setTelemetryEvents([]);

        } catch (error) {
            console.error('Submission error:', error);
            alert('Failed to submit assignment. Please try again.');
        }
    };

    return (
        <div className="flex flex-col h-[calc(100vh-theme(spacing.24))] md:h-[calc(100vh-theme(spacing.12))]">
            {/* Workspace Header */}
            <header className="flex items-center justify-between border-b border-border bg-card px-4 py-2 shrink-0">
                <div className="flex items-center gap-4">
                    <h1 className="text-sm font-semibold text-foreground">
                        Assignment: Implementing Linked List
                    </h1>
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                        In Progress
                    </span>
                    <span className="text-xs text-muted-foreground">
                        Events: {telemetryEvents.length}
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    {/* Assignment Type Toggle */}
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

                    {/* Language Picker (only for code) */}
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
                        className="h-8 rounded-md border border-border bg-card px-3 text-sm text-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
                    >
                        <option value="BRAINSTORMING">Brainstorming Mode</option>
                        <option value="EXAM">Exam Mode</option>
                    </select>

                    <Button variant="secondary" size="sm" className="gap-2">
                        <Play className="h-4 w-4" />
                        Run
                    </Button>
                    <Button onClick={handleSubmit} size="sm" className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground">
                        <UploadCloud className="h-4 w-4" />
                        Submit
                    </Button>
                </div>
            </header>

            {/* Main Workspace Area (Split Pane) */}
            <div className="flex flex-1 overflow-hidden">
                {/* Editor Pane */}
                <div className="flex-1 border-r border-border relative min-w-[300px]">
                    {assignmentType === 'code' ? (
                        <CodeEditor
                            initialContent={code}
                            onChange={(value) => setCode(value || '')}
                            language={language}
                            onTelemetry={handleTelemetry}
                        />
                    ) : (
                        <TextEditor
                            initialContent={textContent}
                            onChange={(value) => setTextContent(value || '')}
                            onTelemetry={handleTelemetry}
                        />
                    )}
                </div>

                {/* AI Chat Pane */}
                <div className="w-[400px] shrink-0 hidden md:block">
                    <ChatInterface aiMode={aiMode} />
                </div>
            </div>
        </div>
    );
}
