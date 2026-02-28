import { Users, Settings, ShieldCheck } from 'lucide-react';
import Link from 'next/link';

export default function AdminDashboardPage() {
    return (
        <main className="p-6">
            <h1 className="mb-2 text-2xl font-bold text-foreground">
                Admin Console
            </h1>
            <p className="text-muted-foreground mb-6">Welcome, Admin. Manage users and system settings.</p>

            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                <div className="rounded-xl bg-card p-5 shadow-sm border border-border flex flex-col">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="rounded-lg bg-primary/10 p-2 text-primary">
                            <Users className="h-5 w-5" />
                        </div>
                        <h3 className="font-semibold text-foreground">User Management</h3>
                    </div>
                    <p className="text-sm text-muted-foreground mb-4 flex-1">View and manage all registered students, professors, and administrators.</p>
                    <Link href="/admin/users" className="text-sm font-medium text-primary hover:text-primary/80 transition-colors">
                        Manage Users →
                    </Link>
                </div>
                <div className="rounded-xl bg-card p-5 shadow-sm border border-border flex flex-col">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="rounded-lg bg-primary/10 p-2 text-primary">
                            <Settings className="h-5 w-5" />
                        </div>
                        <h3 className="font-semibold text-foreground">System Settings</h3>
                    </div>
                    <p className="text-sm text-muted-foreground mb-4 flex-1">Configure API keys, platform settings, and integration parameters.</p>
                    <Link href="/admin/settings" className="text-sm font-medium text-primary hover:text-primary/80 transition-colors">
                        Open Settings →
                    </Link>
                </div>
                <div className="rounded-xl bg-card p-5 shadow-sm border border-border flex flex-col">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="rounded-lg bg-primary/10 p-2 text-primary">
                            <ShieldCheck className="h-5 w-5" />
                        </div>
                        <h3 className="font-semibold text-foreground">System Health</h3>
                    </div>
                    <p className="text-sm text-muted-foreground mb-4 flex-1">Monitor platform integrity, telemetry pipeline status, and API health.</p>
                    <span className="text-sm font-medium text-muted-foreground">Coming soon</span>
                </div>
            </div>
        </main>
    );
}
