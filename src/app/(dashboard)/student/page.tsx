import Link from 'next/link';
import { Plus, Clock } from 'lucide-react';

export default function StudentDashboardPage() {
    return (
        <main className="w-full">
            <div className="flex w-full items-center justify-between">
                <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
            </div>
            <div className="mt-4 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                {/* Quick Actions */}
                <div className="rounded-xl bg-card p-2 shadow-sm border border-border">
                    <Link href="/student/workspace" className="flex h-[150px] flex-col items-center justify-center gap-4 rounded-lg border-2 border-dashed border-border hover:border-primary hover:bg-accent transition-colors">
                        <div className="rounded-full bg-primary/10 p-3 text-primary">
                            <Plus className="h-6 w-6" />
                        </div>
                        <span className="text-sm font-medium text-foreground">Start New Assignment</span>
                    </Link>
                </div>
                <div className="rounded-xl bg-card p-4 shadow-sm border border-border">
                    <div className="flex items-center gap-4">
                        <Clock className="h-5 w-5 text-muted-foreground" />
                        <h3 className="ml-2 text-sm font-medium text-muted-foreground">Recent Work</h3>
                    </div>
                    <p className="truncate rounded-xl bg-muted px-4 py-8 text-center text-sm text-muted-foreground mt-4">
                        No recent assignments found.
                    </p>
                </div>
            </div>
            <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-4 lg:grid-cols-8">
                {/* Recent Submissions / Activity Feed */}
            </div>
        </main>
    );
}
