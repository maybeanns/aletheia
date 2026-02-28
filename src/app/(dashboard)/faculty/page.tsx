import { BookOpen, BarChart3, FileText } from 'lucide-react';
import Link from 'next/link';

export default function FacultyDashboardPage() {
    return (
        <main className="p-6">
            <h1 className="mb-2 text-2xl font-bold text-foreground">
                Faculty Dashboard
            </h1>
            <p className="text-muted-foreground mb-6">Welcome, Professor. Manage your courses and review student work.</p>

            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                <DashboardCard
                    icon={BookOpen}
                    title="My Courses"
                    description="View and manage your courses and create new assignments."
                    href="/faculty/courses"
                    linkText="Go to Courses"
                />
                <DashboardCard
                    icon={FileText}
                    title="Submissions"
                    description="Review student submissions with process forensics and audit tokens."
                    href="/faculty/submissions"
                    linkText="Review Submissions"
                />
                <DashboardCard
                    icon={BarChart3}
                    title="Analytics"
                    description="Class-wide integrity metrics, trends, and AI interaction analytics."
                    href="/faculty/analytics"
                    linkText="View Analytics"
                />
            </div>
        </main>
    );
}

function DashboardCard({ icon: Icon, title, description, href, linkText }: {
    icon: typeof BookOpen;
    title: string;
    description: string;
    href: string;
    linkText: string;
}) {
    return (
        <div className="rounded-xl bg-card p-5 shadow-sm border border-border flex flex-col">
            <div className="flex items-center gap-3 mb-3">
                <div className="rounded-lg bg-primary/10 p-2 text-primary">
                    <Icon className="h-5 w-5" />
                </div>
                <h3 className="font-semibold text-foreground">{title}</h3>
            </div>
            <p className="text-sm text-muted-foreground mb-4 flex-1">{description}</p>
            <Link href={href} className="text-sm font-medium text-primary hover:text-primary/80 transition-colors">
                {linkText} →
            </Link>
        </div>
    );
}
