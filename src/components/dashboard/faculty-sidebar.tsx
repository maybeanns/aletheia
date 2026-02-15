'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils/cn';
import {
    LayoutDashboard,
    BookOpen,
    FileText,
    BarChart3,
    Settings,
    LogOut
} from 'lucide-react';
import { Button } from '@/components/ui/button';

const navItems = [
    { href: '/faculty/dashboard', label: 'Overview', icon: LayoutDashboard },
    { href: '/faculty/courses', label: 'My Courses', icon: BookOpen },
    { href: '/faculty/assignments', label: 'Assignments', icon: FileText },
    { href: '/faculty/analytics', label: 'Analytics', icon: BarChart3 },
    { href: '/faculty/settings', label: 'Settings', icon: Settings },
];

export default function FacultySidebar() {
    const pathname = usePathname();

    return (
        <aside className="w-64 border-r border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900 flex flex-col h-full">
            <div className="p-6">
                <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                    <span className="text-blue-600">Aletheia</span> Faculty
                </h2>
            </div>

            <nav className="flex-1 px-4 space-y-1">
                {navItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = pathname.startsWith(item.href);

                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={cn(
                                "flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors",
                                isActive
                                    ? "bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300"
                                    : "text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
                            )}
                        >
                            <Icon className="h-5 w-5" />
                            {item.label}
                        </Link>
                    );
                })}
            </nav>

            <div className="p-4 border-t border-gray-200 dark:border-gray-800">
                <Button variant="ghost" className="w-full justify-start gap-3 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20">
                    <LogOut className="h-5 w-5" />
                    Sign Out
                </Button>
            </div>
        </aside>
    );
}
