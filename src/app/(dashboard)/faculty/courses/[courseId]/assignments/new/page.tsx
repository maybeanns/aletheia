'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Save, Sparkles, AlertTriangle } from 'lucide-react';
import Link from 'next/link';

export default function CreateAssignmentPage({ params }: { params: { courseId: string } }) {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        dueDate: '',
        aiMode: 'BRAINSTORMING',
        codeConstraints: ''
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        try {
            // In a real app, this would be a server action or API call
            console.log('Creating assignment:', { ...formData, courseId: params.courseId });

            // Simulate delay
            await new Promise(resolve => setTimeout(resolve, 1000));

            // Redirect back to course page (mocked)
            router.push(`/faculty/courses`);

        } catch (error) {
            console.error('Failed to create assignment:', error);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto p-8">
            <div className="mb-8">
                <Link
                    href="/faculty/courses"
                    className="flex items-center text-sm text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 mb-4"
                >
                    <ArrowLeft className="h-4 w-4 mr-1" />
                    Back to Course
                </Link>
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Create New Assignment</h1>
                        <p className="text-gray-500 dark:text-gray-400 mt-1">Configure parameters and AI strictness.</p>
                    </div>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-8">
                {/* Basic Info */}
                <div className="bg-white dark:bg-gray-900 p-6 rounded-lg border border-gray-200 dark:border-gray-800 space-y-4">
                    <h2 className="text-lg font-semibold flex items-center gap-2">
                        <FileText className="h-5 w-5 text-blue-500" />
                        Assignment Details
                    </h2>

                    <div className="grid gap-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Assignment Title</label>
                            <Input
                                placeholder="e.g. Linked List Implementation"
                                value={formData.title}
                                onChange={e => setFormData({ ...formData, title: e.target.value })}
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium">Description</label>
                            <textarea
                                className="w-full min-h-[100px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                placeholder="Describe the task requirements..."
                                value={formData.description}
                                onChange={e => setFormData({ ...formData, description: e.target.value })}
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium">Due Date</label>
                            <Input
                                type="datetime-local"
                                value={formData.dueDate}
                                onChange={e => setFormData({ ...formData, dueDate: e.target.value })}
                                required
                            />
                        </div>
                    </div>
                </div>

                {/* AI Configuration */}
                <div className="bg-white dark:bg-gray-900 p-6 rounded-lg border border-gray-200 dark:border-gray-800 space-y-4">
                    <h2 className="text-lg font-semibold flex items-center gap-2">
                        <Sparkles className="h-5 w-5 text-purple-500" />
                        AI & Pedagogical Settings
                    </h2>

                    <div className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">AI Mode</label>
                            <select
                                className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                value={formData.aiMode}
                                onChange={e => setFormData({ ...formData, aiMode: e.target.value })}
                            >
                                <option value="BRAINSTORMING">Brainstorming (Socratic Guide)</option>
                                <option value="EXAM">Exam Mode (Strict No-Code Policy)</option>
                            </select>
                            <p className="text-xs text-gray-500">
                                {formData.aiMode === 'BRAINSTORMING'
                                    ? "AI will guide students through the problem without giving direct answers."
                                    : "AI will strictly refuse to write code and only clarify questions."}
                            </p>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium">Code Constraints</label>
                            <Input
                                placeholder="e.g. No Array.map, Max 100 lines (comma separated)"
                                value={formData.codeConstraints}
                                onChange={e => setFormData({ ...formData, codeConstraints: e.target.value })}
                            />
                            <p className="text-xs text-gray-500">
                                Specific rules the AI should enforce when reviewing student code.
                            </p>
                        </div>
                    </div>
                </div>

                <div className="flex justify-end gap-3">
                    <Button type="button" variant="ghost" onClick={() => router.back()}>Cancel</Button>
                    <Button type="submit" disabled={isLoading} className="bg-blue-600 hover:bg-blue-700 text-white gap-2">
                        {isLoading ? 'Saving...' : (
                            <>
                                <Save className="h-4 w-4" />
                                Create Assignment
                            </>
                        )}
                    </Button>
                </div>
            </form>
        </div>
    );
}

function FileText({ className }: { className?: string }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
            <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" x2="8" y1="13" y2="13" />
            <line x1="16" x2="8" y1="17" y2="17" />
            <line x1="10" x2="8" y1="9" y2="9" />
        </svg>
    )
}
