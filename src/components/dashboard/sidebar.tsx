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
    PanelLeftClose,
    PanelLeft,
} from 'lucide-react';
import { signOut } from 'next-auth/react';
import { useState } from 'react';

interface SidebarProps {
    userRole: string;
    onClose?: () => void;
}

export function Sidebar({ userRole, onClose }: SidebarProps) {
    const pathname = usePathname();
    const [collapsed, setCollapsed] = useState(false);

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

    const portalLabel = userRole === 'PROFESSOR'
        ? 'Faculty Portal'
        : userRole === 'ADMIN'
            ? 'Admin Console'
            : 'Student Portal';

    return (
        <div
            className={cn(
                'flex h-full flex-col transition-all duration-300 ease-in-out',
                collapsed ? 'w-[68px]' : 'w-64'
            )}
        >
            {/* Logo / Brand */}
            <Link
                className={cn(
                    'flex items-end rounded-md bg-primary m-2 hover:bg-primary/90 transition-all overflow-hidden',
                    collapsed ? 'h-14 justify-center p-2' : 'h-24 p-4'
                )}
                href={links[0].href}
            >
                <div className="text-primary-foreground">
                    <h1 className={cn('font-bold', collapsed ? 'text-sm' : 'text-xl')}>
                        {collapsed ? 'A' : 'Aletheia'}
                    </h1>
                    {!collapsed && (
                        <p className="text-xs opacity-80 mt-0.5">{portalLabel}</p>
                    )}
                </div>
            </Link>

            {/* Navigation Links */}
            <nav className="flex flex-col gap-1 px-2 mt-2 flex-1">
                {links.map((link) => {
                    const LinkIcon = link.icon;
                    const isActive = pathname === link.href ||
                        (link.href !== '/student' && link.href !== '/faculty' && link.href !== '/admin' && pathname.startsWith(link.href));
                    return (
                        <Link
                            key={link.name}
                            href={link.href}
                            title={link.name}
                            className={cn(
                                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                                'text-secondary-foreground hover:bg-accent hover:text-accent-foreground',
                                isActive && 'bg-accent text-accent-foreground',
                                collapsed && 'justify-center px-0'
                            )}
                        >
                            <LinkIcon className="h-5 w-5 shrink-0" />
                            {!collapsed && <span>{link.name}</span>}
                        </Link>
                    );
                })}
            </nav>

            {/* Bottom actions */}
            <div className="mt-auto px-2 pb-2 flex flex-col gap-1">
                {/* Collapse toggle */}
                <button
                    onClick={() => setCollapsed(!collapsed)}
                    title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                    className={cn(
                        'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                        'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                        collapsed && 'justify-center px-0'
                    )}
                >
                    {collapsed
                        ? <PanelLeft className="h-5 w-5 shrink-0" />
                        : <PanelLeftClose className="h-5 w-5 shrink-0" />
                    }
                    {!collapsed && <span>Collapse</span>}
                </button>

                {/* Sign Out */}
                <form action={async () => { await signOut(); }}>
                    <button
                        title="Sign Out"
                        className={cn(
                            'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                            'text-secondary-foreground hover:bg-destructive/10 hover:text-destructive',
                            collapsed && 'justify-center px-0'
                        )}
                    >
                        <LogOut className="h-5 w-5 shrink-0" />
                        {!collapsed && <span>Sign Out</span>}
                    </button>
                </form>
            </div>
        </div>
    );
}
