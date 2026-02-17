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
                className="mb-2 flex h-20 items-end justify-start rounded-md bg-primary p-4 md:h-32 hover:bg-primary/90 transition-colors"
                href={links[0].href}
            >
                <div className="w-32 text-primary-foreground md:w-40">
                    <h1 className="text-xl font-bold">Aletheia</h1>
                    <p className="text-xs opacity-80 mt-1">
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
                                'flex h-[48px] grow items-center justify-center gap-2 rounded-md bg-secondary p-3 text-sm font-medium hover:bg-accent hover:text-accent-foreground md:flex-none md:justify-start md:p-2 md:px-3 text-secondary-foreground',
                                pathname === link.href && 'bg-accent text-accent-foreground',
                            )}
                        >
                            <LinkIcon className="w-6" />
                            <p className="hidden md:block">{link.name}</p>
                        </Link>
                    );
                })}
                <div className="hidden h-auto w-full grow rounded-md bg-secondary md:block"></div>
                <form
                    action={async () => {
                        await signOut();
                    }}
                >
                    <button className="flex h-[48px] w-full grow items-center justify-center gap-2 rounded-md bg-secondary p-3 text-sm font-medium hover:bg-destructive/10 hover:text-destructive md:flex-none md:justify-start md:p-2 md:px-3 text-secondary-foreground">
                        <LogOut className="w-6" />
                        <div className="hidden md:block">Sign Out</div>
                    </button>
                </form>
            </div>
        </div>
    );
}
