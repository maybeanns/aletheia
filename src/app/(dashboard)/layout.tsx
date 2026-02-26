import { Sidebar } from '@/components/dashboard/sidebar';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';

export default async function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const session = await auth();

    if (!session?.user) {
        redirect('/login');
    }

    const role = (session.user as any).role || 'STUDENT';

    return (
        <div className="flex h-screen overflow-hidden bg-background">
            {/* Sidebar — controls its own width via collapsed state */}
            <div className="shrink-0 border-r border-border hidden md:block">
                <Sidebar userRole={role} />
            </div>

            {/* Main content — no massive padding, just enough for breathing room */}
            <div className="flex-1 overflow-y-auto">
                {children}
            </div>
        </div>
    );
}
