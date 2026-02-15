'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Send, Bot, User } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

// Minimal UI components since I haven't created the full library yet
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
                className="bg-blue-600 hover:bg-blue-700 text-white"
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
                    aiMode // Pass the mode to the backend
                }),
            });

            if (!response.ok) {
                throw new Error('Failed to fetch response');
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
            // Optional: Add error message to chat
            const errorMessage: Message = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: "I'm having trouble connecting to the Socratic Engine right now. Please try again.",
                createdAt: new Date(),
            };
            setMessages((prev) => [...prev, errorMessage]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex h-full flex-col bg-gray-50 dark:bg-gray-900 border-l border-gray-200 dark:border-gray-800">
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
                <h2 className="text-sm font-semibold flex items-center gap-2">
                    <Bot className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    Socratic Guide
                </h2>
                <span className="text-xs text-gray-500 bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded-full">
                    Brainstorming Mode
                </span>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.map((message) => (
                    <div
                        key={message.id}
                        className={cn(
                            "flex gap-3 max-w-[90%]",
                            message.role === 'user' ? "ml-auto flex-row-reverse" : ""
                        )}
                    >
                        <div className={cn(
                            "h-8 w-8 rounded-full flex items-center justify-center shrink-0",
                            message.role === 'user' ? "bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-200" : "bg-purple-100 text-purple-600 dark:bg-purple-900 dark:text-purple-200"
                        )}>
                            {message.role === 'user' ? <User className="h-5 w-5" /> : <Bot className="h-5 w-5" />}
                        </div>

                        <div className={cn(
                            "rounded-lg p-3 text-sm",
                            message.role === 'user'
                                ? "bg-blue-600 text-white"
                                : "bg-white border border-gray-200 text-gray-800 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100"
                        )}>
                            <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>
                            <span className="text-[10px] opacity-70 mt-1 block">
                                {message.createdAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                        </div>
                    </div>
                ))}
                {isLoading && (
                    <div className="flex gap-3">
                        <div className="h-8 w-8 rounded-full bg-purple-100 text-purple-600 dark:bg-purple-900 dark:text-purple-200 flex items-center justify-center shrink-0">
                            <Bot className="h-5 w-5" />
                        </div>
                        <div className="bg-white border border-gray-200 dark:bg-gray-800 dark:border-gray-700 rounded-lg p-4 flex items-center gap-2">
                            <span className="h-2 w-2 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                            <span className="h-2 w-2 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                            <span className="h-2 w-2 bg-gray-400 rounded-full animate-bounce"></span>
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            <div className="p-4 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
                <ChatInput
                    value={input}
                    onChange={(e: any) => setInput(e.target.value)}
                    onSubmit={handleSubmit}
                    disabled={isLoading}
                />
                <p className="text-[10px] text-center text-gray-400 mt-2">
                    AI can make mistakes. Verify important info.
                </p>
            </div>
        </div>
    );
}
