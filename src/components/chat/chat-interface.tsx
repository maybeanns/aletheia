'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Send, Bot, User, RefreshCw, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

function ChatInput({ value, onChange, onSubmit, disabled }: any) {
    return (
        <div className="flex gap-2">
            <Input
                value={value}
                onChange={onChange}
                onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => e.key === 'Enter' && !e.shiftKey && onSubmit()}
                placeholder="Ask for guidance..."
                disabled={disabled}
                className="flex-1"
            />
            <Button
                onClick={onSubmit}
                disabled={disabled || !value.trim()}
                size="icon"
                className="bg-primary hover:bg-primary/90 text-primary-foreground"
            >
                <Send className="h-4 w-4" />
                <span className="sr-only">Send</span>
            </Button>
        </div>
    );
}

interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    createdAt: Date;
    isError?: boolean;
}

interface ChatInterfaceProps {
    aiMode?: 'BRAINSTORMING' | 'EXAM';
}

export default function ChatInterface({ aiMode = 'BRAINSTORMING' }: ChatInterfaceProps) {
    const [messages, setMessages] = useState<Message[]>([
        {
            id: '1',
            role: 'assistant',
            content: `Hello! I'm Aletheia, your Socratic tutor. We are currently in ${aiMode} mode. How can I help you with your assignment today?`,
            createdAt: new Date(),
        },
    ]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    // Reset chat when mode changes
    useEffect(() => {
        setMessages([
            {
                id: Date.now().toString(),
                role: 'assistant',
                content: `Mode switched to ${aiMode}. I have adjusted my guidance style accordingly.`,
                createdAt: new Date(),
            },
        ]);
    }, [aiMode]);

    const handleRetry = (messageIndex: number) => {
        // Find the last user message before the error
        const lastUserMsg = messages.slice(0, messageIndex).reverse().find(m => m.role === 'user');
        if (lastUserMsg) {
            // Remove messages from the error onwards and re-send
            setMessages(prev => prev.slice(0, messageIndex));
            setInput(lastUserMsg.content);
        }
    };

    const handleSubmit = async () => {
        if (!input.trim() || isLoading) return;

        const userMessage: Message = {
            id: Date.now().toString(),
            role: 'user',
            content: input,
            createdAt: new Date(),
        };

        setMessages((prev) => [...prev, userMessage]);
        setInput('');
        setIsLoading(true);

        try {
            const response = await fetch('/api/ai/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messages: [...messages, userMessage],
                    assignmentContext: 'Implementing a Linked List in Javascript/Typescript',
                    codeConstraints: ['Do not use built-in Array methods if possible'],
                    aiMode
                }),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                const errorMsg = errorData.error || `Server error (${response.status})`;

                // Provide helpful messages based on error type
                let helpfulMessage = errorMsg;
                if (response.status === 503) {
                    helpfulMessage = "The AI service is currently unavailable. Please ensure the API keys (GROQ_API_KEY and GOOGLE_API_KEY) are configured in the server's environment variables.";
                } else if (response.status === 500) {
                    helpfulMessage = "An internal error occurred while processing your request. This may be due to missing API configuration. Please try again or contact your administrator.";
                }

                throw new Error(helpfulMessage);
            }

            const data = await response.json();

            const aiMessage: Message = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: data.content,
                createdAt: new Date(),
            };

            setMessages((prev) => [...prev, aiMessage]);
        } catch (error) {
            console.error('Error fetching AI response:', error);
            const errorMessage: Message = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: error instanceof Error
                    ? error.message
                    : "I'm having trouble connecting to the Socratic Engine right now. Please try again.",
                createdAt: new Date(),
                isError: true,
            };
            setMessages((prev) => [...prev, errorMessage]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex h-full flex-col bg-muted/30 border-l border-border">
            <div className="flex items-center justify-between p-4 border-b border-border bg-card">
                <h2 className="text-sm font-semibold flex items-center gap-2">
                    <Bot className="h-4 w-4 text-primary" />
                    Socratic Guide
                </h2>
                <span className="text-xs text-muted-foreground bg-accent px-2 py-1 rounded-full">
                    {aiMode === 'EXAM' ? 'Exam Mode' : 'Brainstorming Mode'}
                </span>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.map((message, index) => (
                    <div
                        key={message.id}
                        className={cn(
                            "flex gap-3 max-w-[90%]",
                            message.role === 'user' ? "ml-auto flex-row-reverse" : ""
                        )}
                    >
                        <div className={cn(
                            "h-8 w-8 rounded-full flex items-center justify-center shrink-0",
                            message.role === 'user'
                                ? "bg-primary/10 text-primary"
                                : message.isError
                                    ? "bg-destructive/10 text-destructive"
                                    : "bg-accent text-accent-foreground"
                        )}>
                            {message.role === 'user'
                                ? <User className="h-5 w-5" />
                                : message.isError
                                    ? <AlertCircle className="h-5 w-5" />
                                    : <Bot className="h-5 w-5" />
                            }
                        </div>

                        <div className={cn(
                            "rounded-lg p-3 text-sm",
                            message.role === 'user'
                                ? "bg-primary text-primary-foreground"
                                : message.isError
                                    ? "bg-destructive/10 border border-destructive/20 text-foreground"
                                    : "bg-card border border-border text-foreground"
                        )}>
                            <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>
                            <div className="flex items-center gap-2 mt-1">
                                <span className="text-[10px] opacity-70">
                                    {message.createdAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
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
                {isLoading && (
                    <div className="flex gap-3">
                        <div className="h-8 w-8 rounded-full bg-accent text-accent-foreground flex items-center justify-center shrink-0">
                            <Bot className="h-5 w-5" />
                        </div>
                        <div className="bg-card border border-border rounded-lg p-4 flex items-center gap-2">
                            <span className="h-2 w-2 bg-muted-foreground rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                            <span className="h-2 w-2 bg-muted-foreground rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                            <span className="h-2 w-2 bg-muted-foreground rounded-full animate-bounce"></span>
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            <div className="p-4 border-t border-border bg-card">
                <ChatInput
                    value={input}
                    onChange={(e: any) => setInput(e.target.value)}
                    onSubmit={handleSubmit}
                    disabled={isLoading}
                />
                <p className="text-[10px] text-center text-muted-foreground mt-2">
                    AI can make mistakes. Verify important info.
                </p>
            </div>
        </div>
    );
}
