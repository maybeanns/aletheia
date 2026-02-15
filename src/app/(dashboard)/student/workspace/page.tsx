'use client';

import { useState, useCallback, useRef } from 'react';
import CodeEditor from '@/components/editor/code-editor';
import ChatInterface from '@/components/chat/chat-interface';
import { Button } from '@/components/ui/button';
import { Play, UploadCloud } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { AuditTokenGenerator } from '@/lib/telemetry/audit-token';

// In a real app, this would come from an environment variable
const RECOVERY_SECRET = 'dev-secret-key-123';

export default function StudentWorkspacePage() {
    const [telemetryEvents, setTelemetryEvents] = useState<any[]>([]);
    const [code, setCode] = useState('// Write your Linked List implementation here...');
    const [aiMode, setAiMode] = useState<'BRAINSTORMING' | 'EXAM'>('BRAINSTORMING');
    const generatorRef = useRef(new AuditTokenGenerator(RECOVERY_SECRET));

    const handleTelemetry = useCallback((events: any[]) => {
        setTelemetryEvents((prev) => [...prev, ...events]);
    }, []);

    const handleSubmit = async () => {
        // Calculate basic metrics from telemetry
        const keystrokes = telemetryEvents.filter(e => e.type === 'keystroke');
        const pastes = telemetryEvents.filter(e => e.type === 'paste');

        const metrics = {
            typingEfficiency: keystrokes.length > 0 ? code.length / keystrokes.length : 0,
            pasteCount: pastes.length,
            pasteVolume: pastes.reduce((acc, p) => acc + (p.data.range?.endColumn - p.data.range?.startColumn || 0), 0),
            totalTimeMs: 0,
            aiInteractionCount: 0,
            editDistance: 0
        };

        const token = generatorRef.current.generateToken({
            submissionHash: generatorRef.current.generateHash(code),
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
                    content: code,
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
            <header className="flex items-center justify-between border-b border-gray-200 bg-white px-4 py-2 dark:bg-gray-900 dark:border-gray-800 shrink-0">
                <div className="flex items-center gap-4">
                    <h1 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                        Assignment: Implementing Linked List
                    </h1>
                    <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800 dark:bg-blue-900 dark:text-blue-300">
                        In Progress
                    </span>
                    <span className="text-xs text-gray-400">
                        Events: {telemetryEvents.length}
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    <select
                        value={aiMode}
                        onChange={(e) => setAiMode(e.target.value as 'BRAINSTORMING' | 'EXAM')}
                        className="h-8 rounded-md border border-gray-200 bg-white px-3 text-sm text-gray-900 focus:border-blue-500 focus:outline-none dark:border-gray-800 dark:bg-gray-950 dark:text-gray-100"
                    >
                        <option value="BRAINSTORMING">Brainstorming Mode</option>
                        <option value="EXAM">Exam Mode</option>
                    </select>
                    <Button variant="secondary" size="sm" className="gap-2">
                        <Play className="h-4 w-4" />
                        Run
                    </Button>
                    <Button onClick={handleSubmit} size="sm" className="gap-2 bg-green-600 hover:bg-green-500 text-white">
                        <UploadCloud className="h-4 w-4" />
                        Submit
                    </Button>
                </div>
            </header>

            {/* Main Workspace Area (Split Pane) */}
            <div className="flex flex-1 overflow-hidden">
                {/* Editor Pane */}
                <div className="flex-1 border-r border-gray-200 dark:border-gray-800 relative min-w-[300px]">
                    <CodeEditor
                        initialContent={code}
                        onChange={(value) => setCode(value || '')}
                        language="javascript"
                        onTelemetry={handleTelemetry}
                    />
                </div>

                {/* AI Chat Pane */}
                <div className="w-[400px] shrink-0 hidden md:block border-l border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50">
                    <ChatInterface aiMode={aiMode} />
                </div>
            </div>
        </div>
    );
}
