import { BookOpen, Plus } from 'lucide-react';
import Link from 'next/link';

export default function FacultyCoursesPage() {
    return (
        <main className="p-6 w-full">
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-2xl font-bold text-foreground">My Courses</h1>
            </div>
            <div className="flex flex-col items-center justify-center py-16 rounded-xl border-2 border-dashed border-border bg-muted/30">
                <div className="rounded-full bg-primary/10 p-4 mb-4">
                    <BookOpen className="h-8 w-8 text-primary" />
                </div>
                <h2 className="text-lg font-semibold text-foreground mb-1">No Courses Yet</h2>
                <p className="text-sm text-muted-foreground mb-4 text-center max-w-sm">
                    Create your first course to start assigning work and tracking student progress with Aletheia.
                </p>
                <span className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
                    <Plus className="h-4 w-4" /> Course creation coming soon
                </span>
            </div>
        </main>
    );
}
