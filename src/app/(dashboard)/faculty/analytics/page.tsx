import { BarChart3 } from 'lucide-react';

export default function FacultyAnalyticsPage() {
    return (
        <main className="p-6 w-full">
            <h1 className="text-2xl font-bold text-foreground mb-6">Analytics</h1>
            <div className="flex flex-col items-center justify-center py-16 rounded-xl border-2 border-dashed border-border bg-muted/30">
                <div className="rounded-full bg-primary/10 p-4 mb-4">
                    <BarChart3 className="h-8 w-8 text-primary" />
                </div>
                <h2 className="text-lg font-semibold text-foreground mb-1">Analytics Coming Soon</h2>
                <p className="text-sm text-muted-foreground text-center max-w-sm">
                    Class-wide integrity metrics, submission trends, and AI interaction analytics will be available here.
                </p>
            </div>
        </main>
    );
}
