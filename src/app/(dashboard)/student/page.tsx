import Link from 'next/link';
import { Plus, Clock } from 'lucide-react';

export default function StudentDashboardPage() {
    return (
        <main className="w-full">
            <div className="flex w-full items-center justify-between">
                <h1 className="text-2xl font-bold dark:text-white">Dashboard</h1>
            </div>
            <div className="mt-4 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                {/* Quick Actions */}
                <div className="rounded-xl bg-gray-50 p-2 shadow-sm dark:bg-gray-800">
                    <Link href="/student/workspace" className="flex h-[150px] flex-col items-center justify-center gap-4 rounded-lg border-2 border-dashed border-gray-200 hover:border-blue-500 hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-700 transition-colors">
                        <div className="rounded-full bg-blue-100 p-3 text-blue-600 dark:bg-blue-900 dark:text-blue-300">
                            <Plus className="h-6 w-6" />
                        </div>
                        <span className="text-sm font-medium text-gray-900 dark:text-gray-100">Start New Assignment</span>
                    </Link>
                </div>
                <div className="rounded-xl bg-gray-50 p-4 shadow-sm dark:bg-gray-800">
                    <div className="flex items-center gap-4">
                        <Clock className="h-5 w-5 text-gray-500" />
                        <h3 className="ml-2 text-sm font-medium text-gray-500 dark:text-gray-400">Recent Work</h3>
                    </div>
                    <p className="truncate rounded-xl bg-white px-4 py-8 text-center text-sm dark:bg-gray-900 dark:text-gray-100 mt-4">
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
