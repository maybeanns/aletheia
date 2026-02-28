import { FileText, ArrowRight } from 'lucide-react';
import Link from 'next/link';

export default function StudentSubmissionsPage() {
    return (
        <main className="p-6 w-full">
            <h1 className="text-2xl font-bold text-foreground mb-6">Submissions</h1>
            <div className="flex flex-col items-center justify-center py-16 rounded-xl border-2 border-dashed border-border bg-muted/30">
                <div className="rounded-full bg-primary/10 p-4 mb-4">
                    <FileText className="h-8 w-8 text-primary" />
                </div>
                <h2 className="text-lg font-semibold text-foreground mb-1">No Submissions Yet</h2>
                <p className="text-sm text-muted-foreground mb-4 text-center max-w-sm">
                    Your completed and graded work will appear here after you submit assignments.
                </p>
                <Link href="/student/workspace" className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:text-primary/80 transition-colors">
                    Start Working <ArrowRight className="h-4 w-4" />
                </Link>
            </div>
        </main>
    );
}
