'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils/cn';
import {
    LayoutDashboard,
    Code2,
    BookOpen,
    FileText,
    Users,
    Settings,
    LogOut,
    GraduationCap
} from 'lucide-react';
import { signOut } from 'next-auth/react';

interface SidebarProps {
    userRole: string;
}

export function Sidebar({ userRole }: SidebarProps) {
    const pathname = usePathname();

    const studentLinks = [
        { name: 'Dashboard', href: '/student', icon: LayoutDashboard },
        { name: 'Workspace', href: '/student/workspace', icon: Code2 },
        { name: 'Assignments', href: '/student/assignments', icon: BookOpen },
        { name: 'Submissions', href: '/student/submissions', icon: FileText },
    ];

    const facultyLinks = [
        { name: 'Dashboard', href: '/faculty', icon: LayoutDashboard },
        { name: 'Courses', href: '/faculty/courses', icon: BookOpen },
        { name: 'Review', href: '/faculty/submissions', icon: FileText },
        { name: 'Analytics', href: '/faculty/analytics', icon: Users },
    ];

    const adminLinks = [
        { name: 'Dashboard', href: '/admin', icon: LayoutDashboard },
        { name: 'Users', href: '/admin/users', icon: Users },
        { name: 'Settings', href: '/admin/settings', icon: Settings },
    ];

    let links = studentLinks;
    if (userRole === 'PROFESSOR') links = facultyLinks;
    if (userRole === 'ADMIN') links = adminLinks;

    return (
        <div className="flex h-full flex-col px-3 py-4 md:px-2">
            <Link
                className="mb-2 flex h-20 items-end justify-start rounded-md bg-blue-600 p-4 md:h-32 hover:bg-blue-500 transition-colors"
                href={links[0].href}
            >
                <div className="w-32 text-white md:w-40">
                    <h1 className="text-xl font-bold">Aletheia</h1>
                    <p className="text-xs text-blue-100 mt-1">
                        {userRole === 'PROFESSOR' ? 'Faculty Portal' : userRole === 'ADMIN' ? 'Admin Console' : 'Student Portal'}
                    </p>
                </div>
            </Link>
            <div className="flex grow flex-row justify-between space-x-2 md:flex-col md:space-x-0 md:space-y-2">
                {links.map((link) => {
                    const LinkIcon = link.icon;
                    return (
                        <Link
                            key={link.name}
                            href={link.href}
                            className={cn(
                                'flex h-[48px] grow items-center justify-center gap-2 rounded-md bg-gray-50 p-3 text-sm font-medium hover:bg-sky-100 hover:text-blue-600 md:flex-none md:justify-start md:p-2 md:px-3 dark:bg-gray-900 dark:text-gray-100 dark:hover:bg-gray-800 dark:hover:text-blue-400',
                                pathname === link.href && 'bg-sky-100 text-blue-600 dark:bg-gray-800 dark:text-blue-400',
                            )}
                        >
                            <LinkIcon className="w-6" />
                            <p className="hidden md:block">{link.name}</p>
                        </Link>
                    );
                })}
                <div className="hidden h-auto w-full grow rounded-md bg-gray-50 md:block dark:bg-gray-900"></div>
                <form
                    action={async () => {
                        // Client-side sign out requires wrapping in form or calling signOut()
                        // Since we're in a client component, we can use signOut()
                        // But wrapping in a form allows potential server action usage if we wanted
                        // We'll just use a button with onClick for now, but to be consistent with Next.js forms
                        // we can't easily invoke server action from client component directly without importing it
                        // So we'll use next-auth/react signOut
                        await signOut();
                    }}
                >
                    <button className="flex h-[48px] w-full grow items-center justify-center gap-2 rounded-md bg-gray-50 p-3 text-sm font-medium hover:bg-sky-100 hover:text-blue-600 md:flex-none md:justify-start md:p-2 md:px-3 dark:bg-gray-900 dark:text-gray-100 dark:hover:bg-gray-800 dark:hover:text-red-400">
                        <LogOut className="w-6" />
                        <div className="hidden md:block">Sign Out</div>
                    </button>
                </form>
            </div>
        </div>
    );
}
