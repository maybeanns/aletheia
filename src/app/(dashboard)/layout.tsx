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
        <div className="flex h-screen flex-col md:flex-row md:overflow-hidden bg-background">
            <div className="w-full flex-none md:w-64 border-r border-border">
                <Sidebar userRole={role} />
            </div>
            <div className="flex-grow p-6 md:overflow-y-auto md:p-12">
                {children}
            </div>
        </div>
    );
}
