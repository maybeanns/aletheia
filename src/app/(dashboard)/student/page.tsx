import Link from 'next/link';
import { Plus, Clock, ArrowRight, BookOpen, BarChart3 } from 'lucide-react';

export default function StudentDashboardPage() {
    return (
        <main className="w-full p-6">
            <div className="flex w-full items-center justify-between">
                <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
            </div>
            <div className="mt-4 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {/* Quick Action: Start Assignment */}
                <div className="rounded-xl bg-card p-2 shadow-sm border border-border">
                    <Link href="/student/workspace" className="flex h-[150px] flex-col items-center justify-center gap-4 rounded-lg border-2 border-dashed border-border hover:border-primary hover:bg-accent transition-colors">
                        <div className="rounded-full bg-primary/10 p-3 text-primary">
                            <Plus className="h-6 w-6" />
                        </div>
                        <span className="text-sm font-medium text-foreground">Start New Assignment</span>
                    </Link>
                </div>

                {/* Recent Work */}
                <div className="rounded-xl bg-card p-4 shadow-sm border border-border">
                    <div className="flex items-center gap-4">
                        <Clock className="h-5 w-5 text-muted-foreground" />
                        <h3 className="ml-2 text-sm font-medium text-muted-foreground">Recent Work</h3>
                    </div>
                    <div className="rounded-xl bg-muted px-4 py-6 text-center mt-4">
                        <p className="text-sm text-muted-foreground mb-3">No recent assignments found.</p>
                        <Link href="/student/workspace" className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:text-primary/80 transition-colors">
                            Start working <ArrowRight className="h-3 w-3" />
                        </Link>
                    </div>
                </div>

                {/* Submissions Summary */}
                <div className="rounded-xl bg-card p-4 shadow-sm border border-border">
                    <div className="flex items-center gap-4">
                        <BarChart3 className="h-5 w-5 text-muted-foreground" />
                        <h3 className="ml-2 text-sm font-medium text-muted-foreground">My Progress</h3>
                    </div>
                    <div className="rounded-xl bg-muted px-4 py-6 text-center mt-4">
                        <p className="text-sm text-muted-foreground mb-3">Complete assignments to track your progress.</p>
                        <Link href="/student/assignments" className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:text-primary/80 transition-colors">
                            View assignments <ArrowRight className="h-3 w-3" />
                        </Link>
                    </div>
                </div>
            </div>
        </main>
    );
}
