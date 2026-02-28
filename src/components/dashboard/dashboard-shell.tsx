'use client';

import { Sidebar } from '@/components/dashboard/sidebar';
import { useState } from 'react';
import { Menu } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

interface DashboardShellProps {
    children: React.ReactNode;
    userRole: string;
}

export default function DashboardShell({ children, userRole }: DashboardShellProps) {
    const [mobileOpen, setMobileOpen] = useState(false);

    return (
        <div className="flex h-screen overflow-hidden bg-background">
            {/* Desktop Sidebar */}
            <div className="shrink-0 border-r border-border hidden md:block">
                <Sidebar userRole={userRole} />
            </div>

            {/* Mobile Sidebar Overlay */}
            {mobileOpen && (
                <div className="fixed inset-0 z-50 md:hidden">
                    <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
                    <div className="absolute inset-y-0 left-0 w-64 bg-background border-r border-border shadow-xl animate-in slide-in-from-left duration-200">
                        <Sidebar userRole={userRole} onClose={() => setMobileOpen(false)} />
                    </div>
                </div>
            )}

            {/* Main content */}
            <div className="flex-1 flex flex-col overflow-hidden">
                {/* Mobile header */}
                <div className="md:hidden flex items-center gap-3 border-b border-border px-4 py-3 bg-card shrink-0">
                    <button
                        onClick={() => setMobileOpen(true)}
                        className="p-1.5 rounded-md text-foreground hover:bg-accent transition-colors"
                        aria-label="Open navigation"
                    >
                        <Menu className="h-5 w-5" />
                    </button>
                    <span className="text-sm font-semibold text-primary">Aletheia</span>
                </div>

                <div className="flex-1 overflow-y-auto">
                    {children}
                </div>
            </div>
        </div>
    );
}
