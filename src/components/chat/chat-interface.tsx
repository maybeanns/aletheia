'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Send, Bot, User, RefreshCw, AlertCircle,
    Trash2, Sparkles, ShieldCheck, Zap
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';

// ── Markdown-lite renderer ──
function renderMarkdown(text: string) {
    // Convert markdown to basic HTML for display
    let html = text
        // Code blocks
        .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre class="chat-code-block"><code>$2</code></pre>')
        // Inline code
        .replace(/`([^`]+)`/g, '<code class="chat-inline-code">$1</code>')
        // Bold
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        // Italic
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        // Bullet points
        .replace(/^[-•]\s+(.+)$/gm, '<li>$1</li>')
        // Numbered lists
        .replace(/^\d+\.\s+(.+)$/gm, '<li>$1</li>')
        // Line breaks
        .replace(/\n\n/g, '</p><p>')
        .replace(/\n/g, '<br/>');

    // Wrap loose <li> in <ul>
    html = html.replace(/((?:<li>.*?<\/li>\s*)+)/g, '<ul>$1</ul>');

    return `<p>${html}</p>`;
}

// ── Intent badge ──
function IntentBadge({ intent }: { intent?: string }) {
    if (!intent) return null;

    const config: Record<string, { label: string; icon: React.ReactNode; className: string }> = {
        'DIRECT_SOLUTION_SEEKING': {
            label: 'Solution Guard',
            icon: <ShieldCheck className="h-3 w-3" />,
            className: 'bg-red-500/10 text-red-400 border-red-500/20',
        },
        'DEBUGGING_HELP': {
            label: 'Debug Guide',
            icon: <Zap className="h-3 w-3" />,
            className: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
        },
        'CONCEPTUAL_QUESTION': {
            label: 'Concept',
            icon: <Sparkles className="h-3 w-3" />,
            className: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
        },
        'BRAINSTORMING': {
            label: 'Brainstorm',
            icon: <Sparkles className="h-3 w-3" />,
            className: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
        },
        'IRRELEVANT': {
            label: 'Off-topic',
            icon: <AlertCircle className="h-3 w-3" />,
            className: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
        },
    };

    const c = config[intent] || config['CONCEPTUAL_QUESTION'];

    return (
        <span className={cn(
            'inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full border',
            c.className
        )}>
            {c.icon}
            {c.label}
        </span>
    );
}


// ── Chat Input ──
function ChatInput({ value, onChange, onSubmit, disabled }: {
    value: string;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onSubmit: () => void;
    disabled: boolean;
}) {
    return (
        <div className="flex gap-2">
            <Input
                value={value}
                onChange={onChange}
                onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        onSubmit();
                    }
                }}
                placeholder="Ask for guidance..."
                disabled={disabled}
                className="flex-1"
                autoComplete="off"
            />
            <Button
                onClick={onSubmit}
                disabled={disabled || !value.trim()}
                size="icon"
                className="bg-primary hover:bg-primary/90 text-primary-foreground shrink-0"
            >
                <Send className="h-4 w-4" />
                <span className="sr-only">Send</span>
            </Button>
        </div>
    );
}


// ── Types ──
interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    createdAt: Date;
    isError?: boolean;
    isStreaming?: boolean;
    intent?: string;
}

interface ChatInterfaceProps {
    aiMode?: 'BRAINSTORMING' | 'EXAM';
    assignmentContext?: string;
    codeConstraints?: string[];
    currentCode?: string;
}


// ── Main Component ──
export default function ChatInterface({
    aiMode = 'BRAINSTORMING',
    assignmentContext,
    codeConstraints,
    currentCode,
}: ChatInterfaceProps) {
    const [messages, setMessages] = useState<Message[]>([
        {
            id: 'welcome',
            role: 'assistant',
            content: `Hello! I'm **Aletheia**, your Socratic tutor.\n\nI'm here to *guide* you through your assignment — not solve it for you. Ask me anything and I'll help you think through the problem.\n\nCurrently in **${aiMode === 'EXAM' ? 'Exam' : 'Brainstorming'} Mode**.`,
            createdAt: new Date(),
        },
    ]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const abortControllerRef = useRef<AbortController | null>(null);

    const scrollToBottom = useCallback(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, []);

    useEffect(() => {
        scrollToBottom();
    }, [messages, scrollToBottom]);

    // Notify mode change
    useEffect(() => {
        setMessages(prev => [
            ...prev,
            {
                id: `mode-${Date.now()}`,
                role: 'assistant',
                content: `Mode switched to **${aiMode === 'EXAM' ? 'Exam' : 'Brainstorming'}**. ${aiMode === 'EXAM'
                    ? 'I can only clarify the problem statement — no hints or solutions.'
                    : 'I\'ll guide you with questions and hints. Let\'s learn together!'
                    }`,
                createdAt: new Date(),
            },
        ]);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [aiMode]);

    const handleClearChat = () => {
        setMessages([
            {
                id: `welcome-${Date.now()}`,
                role: 'assistant',
                content: `Chat cleared. I'm ready to help — what would you like to work on?`,
                createdAt: new Date(),
            },
        ]);
    };

    const handleStopStreaming = () => {
        abortControllerRef.current?.abort();
        abortControllerRef.current = null;
        setIsLoading(false);
        setMessages(prev => {
            const last = prev[prev.length - 1];
            if (last?.isStreaming) {
                return [
                    ...prev.slice(0, -1),
                    { ...last, isStreaming: false, content: last.content + '\n\n*[Response stopped]*' },
                ];
            }
            return prev;
        });
    };

    const handleRetry = (messageIndex: number) => {
        const lastUserMsg = messages.slice(0, messageIndex).reverse().find(m => m.role === 'user');
        if (lastUserMsg) {
            setMessages(prev => prev.slice(0, messageIndex));
            setInput(lastUserMsg.content);
        }
    };

    const handleSubmit = async () => {
        if (!input.trim() || isLoading) return;

        const userMessage: Message = {
            id: `user-${Date.now()}`,
            role: 'user',
            content: input.trim(),
            createdAt: new Date(),
        };

        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setIsLoading(true);

        // Create abort controller for this request
        const abortController = new AbortController();
        abortControllerRef.current = abortController;

        // Build message history for the API (exclude streaming/error metadata)
        const apiMessages = [...messages.filter(m => !m.isError), userMessage].map(m => ({
            role: m.role,
            content: m.content,
        }));

        try {
            const response = await fetch('/api/ai/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messages: apiMessages,
                    assignmentContext: assignmentContext || 'General Programming Assignment',
                    codeConstraints: codeConstraints || [],
                    aiMode,
                    currentCode,
                }),
                signal: abortController.signal,
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                let helpfulMessage = errorData.error || `Server error (${response.status})`;
                if (response.status === 503) {
                    helpfulMessage = 'The AI service is currently unavailable. Please ensure API keys are configured.';
                }
                throw new Error(helpfulMessage);
            }

            // ── Handle streaming NDJSON response ──
            const reader = response.body?.getReader();
            if (!reader) throw new Error('No response stream available.');

            const streamingMsgId = `assistant-${Date.now()}`;
            let detectedIntent: string | undefined;

            // Add an empty streaming message
            setMessages(prev => [...prev, {
                id: streamingMsgId,
                role: 'assistant',
                content: '',
                createdAt: new Date(),
                isStreaming: true,
            }]);

            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });

                // Process complete lines from the buffer
                const lines = buffer.split('\n');
                buffer = lines.pop() || ''; // Keep incomplete line in buffer

                for (const line of lines) {
                    if (!line.trim()) continue;
                    try {
                        const chunk = JSON.parse(line);

                        if (chunk.error) {
                            throw new Error(chunk.error);
                        }

                        if (chunk.intent) {
                            detectedIntent = chunk.intent;
                        }

                        if (chunk.content) {
                            setMessages(prev => {
                                const updated = [...prev];
                                const idx = updated.findIndex(m => m.id === streamingMsgId);
                                if (idx !== -1) {
                                    updated[idx] = {
                                        ...updated[idx],
                                        content: updated[idx].content + chunk.content,
                                        intent: detectedIntent,
                                    };
                                }
                                return updated;
                            });
                        }

                        if (chunk.done) {
                            setMessages(prev => {
                                const updated = [...prev];
                                const idx = updated.findIndex(m => m.id === streamingMsgId);
                                if (idx !== -1) {
                                    updated[idx] = {
                                        ...updated[idx],
                                        isStreaming: false,
                                        intent: detectedIntent,
                                    };
                                }
                                return updated;
                            });
                        }
                    } catch (parseError) {
                        // Skip malformed lines
                        if (parseError instanceof Error && parseError.message !== line.trim()) {
                            console.warn('[Chat] Skipping malformed chunk:', line);
                        } else {
                            throw parseError;
                        }
                    }
                }
            }

            // Mark stream as complete (in case done signal was missed)
            setMessages(prev => {
                const updated = [...prev];
                const idx = updated.findIndex(m => m.id === streamingMsgId);
                if (idx !== -1 && updated[idx].isStreaming) {
                    updated[idx] = { ...updated[idx], isStreaming: false };
                }
                return updated;
            });

        } catch (error) {
            if (error instanceof DOMException && error.name === 'AbortError') {
                // User cancelled — already handled by handleStopStreaming
                return;
            }

            console.error('[Chat] Error:', error);
            const errorMessage: Message = {
                id: `error-${Date.now()}`,
                role: 'assistant',
                content: error instanceof Error
                    ? error.message
                    : "I'm having trouble connecting to the Socratic Engine. Please try again.",
                createdAt: new Date(),
                isError: true,
            };
            setMessages(prev => [...prev, errorMessage]);
        } finally {
            setIsLoading(false);
            abortControllerRef.current = null;
        }
    };

    return (
        <div className="flex h-full flex-col bg-muted/30 border-l border-border">
            {/* Header */}
            <div className="flex items-center justify-between p-3 border-b border-border bg-card">
                <h2 className="text-sm font-semibold flex items-center gap-2">
                    <Bot className="h-4 w-4 text-primary" />
                    Socratic Guide
                </h2>
                <div className="flex items-center gap-2">
                    <span className={cn(
                        'text-[10px] font-medium px-2 py-0.5 rounded-full border',
                        aiMode === 'EXAM'
                            ? 'bg-red-500/10 text-red-400 border-red-500/20'
                            : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                    )}>
                        {aiMode === 'EXAM' ? '🔒 Exam Mode' : '💡 Brainstorming'}
                    </span>
                    <button
                        onClick={handleClearChat}
                        className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                        title="Clear chat"
                    >
                        <Trash2 className="h-3.5 w-3.5" />
                    </button>
                </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.map((message, index) => (
                    <div
                        key={message.id}
                        className={cn(
                            "flex gap-3 max-w-[90%] animate-in fade-in-0 slide-in-from-bottom-2 duration-300",
                            message.role === 'user' ? "ml-auto flex-row-reverse" : ""
                        )}
                    >
                        {/* Avatar */}
                        <div className={cn(
                            "h-7 w-7 rounded-full flex items-center justify-center shrink-0 mt-0.5",
                            message.role === 'user'
                                ? "bg-primary/10 text-primary"
                                : message.isError
                                    ? "bg-destructive/10 text-destructive"
                                    : "bg-accent text-accent-foreground"
                        )}>
                            {message.role === 'user'
                                ? <User className="h-4 w-4" />
                                : message.isError
                                    ? <AlertCircle className="h-4 w-4" />
                                    : <Bot className="h-4 w-4" />
                            }
                        </div>

                        {/* Message bubble */}
                        <div className={cn(
                            "rounded-lg p-3 text-sm",
                            message.role === 'user'
                                ? "bg-primary text-primary-foreground"
                                : message.isError
                                    ? "bg-destructive/10 border border-destructive/20 text-foreground"
                                    : "bg-card border border-border text-foreground"
                        )}>
                            {message.role === 'assistant' ? (
                                <div
                                    className="chat-markdown whitespace-pre-wrap leading-relaxed"
                                    dangerouslySetInnerHTML={{ __html: renderMarkdown(message.content) }}
                                />
                            ) : (
                                <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>
                            )}

                            {/* Streaming cursor */}
                            {message.isStreaming && (
                                <span className="inline-block w-1.5 h-4 bg-primary/70 animate-pulse ml-0.5 align-text-bottom rounded-sm" />
                            )}

                            {/* Footer: timestamp + intent + retry */}
                            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                                <span className="text-[10px] opacity-60">
                                    {message.createdAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                                {message.intent && <IntentBadge intent={message.intent} />}
                                {message.isError && (
                                    <button
                                        onClick={() => handleRetry(index)}
                                        className="inline-flex items-center gap-1 text-[10px] text-primary hover:text-primary/80 transition-colors"
                                    >
                                        <RefreshCw className="h-3 w-3" />
                                        Retry
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                ))}

                {/* Loading indicator */}
                {isLoading && !messages.some(m => m.isStreaming) && (
                    <div className="flex gap-3">
                        <div className="h-7 w-7 rounded-full bg-accent text-accent-foreground flex items-center justify-center shrink-0">
                            <Bot className="h-4 w-4" />
                        </div>
                        <div className="bg-card border border-border rounded-lg p-3 flex items-center gap-1.5">
                            <span className="h-1.5 w-1.5 bg-muted-foreground rounded-full animate-bounce [animation-delay:-0.3s]" />
                            <span className="h-1.5 w-1.5 bg-muted-foreground rounded-full animate-bounce [animation-delay:-0.15s]" />
                            <span className="h-1.5 w-1.5 bg-muted-foreground rounded-full animate-bounce" />
                        </div>
                    </div>
                )}

                <div ref={messagesEndRef} />
            </div>

            {/* Input area */}
            <div className="p-3 border-t border-border bg-card">
                {isLoading ? (
                    <div className="flex gap-2">
                        <div className="flex-1 text-xs text-muted-foreground flex items-center gap-2">
                            <span className="h-2 w-2 bg-primary rounded-full animate-pulse" />
                            Aletheia is thinking...
                        </div>
                        <Button
                            onClick={handleStopStreaming}
                            size="sm"
                            variant="outline"
                            className="text-xs gap-1"
                        >
                            Stop
                        </Button>
                    </div>
                ) : (
                    <ChatInput
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onSubmit={handleSubmit}
                        disabled={isLoading}
                    />
                )}
                <p className="text-[10px] text-center text-muted-foreground mt-2">
                    Socratic Gateway active · AI responses are guided, never direct solutions
                </p>
            </div>

            {/* Scoped styles for markdown rendering */}
            <style jsx global>{`
                .chat-markdown p { margin-bottom: 0.5em; }
                .chat-markdown p:last-child { margin-bottom: 0; }
                .chat-markdown ul { list-style: disc; padding-left: 1.2em; margin: 0.3em 0; }
                .chat-markdown li { margin-bottom: 0.15em; }
                .chat-markdown strong { font-weight: 600; }
                .chat-code-block {
                    background: var(--accent, #1e1e2e);
                    border-radius: 6px;
                    padding: 0.6em 0.8em;
                    margin: 0.4em 0;
                    overflow-x: auto;
                    font-size: 0.85em;
                    font-family: 'Fira Code', 'Cascadia Code', monospace;
                    line-height: 1.5;
                }
                .chat-inline-code {
                    background: var(--accent, #1e1e2e);
                    border-radius: 3px;
                    padding: 0.15em 0.35em;
                    font-size: 0.9em;
                    font-family: 'Fira Code', 'Cascadia Code', monospace;
                }
            `}</style>
        </div>
    );
}
