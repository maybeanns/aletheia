import FacultySidebar from '@/components/dashboard/faculty-sidebar';

export default function FacultyLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="flex h-screen bg-gray-50 dark:bg-gray-950">
            <FacultySidebar />
            <main className="flex-1 overflow-y-auto">
                {children}
            </main>
        </div>
    );
}
