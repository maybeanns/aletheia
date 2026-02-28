import { Settings } from 'lucide-react';

export default function AdminSettingsPage() {
    return (
        <main className="p-6 w-full">
            <h1 className="text-2xl font-bold text-foreground mb-6">System Settings</h1>
            <div className="flex flex-col items-center justify-center py-16 rounded-xl border-2 border-dashed border-border bg-muted/30">
                <div className="rounded-full bg-primary/10 p-4 mb-4">
                    <Settings className="h-8 w-8 text-primary" />
                </div>
                <h2 className="text-lg font-semibold text-foreground mb-1">Settings Coming Soon</h2>
                <p className="text-sm text-muted-foreground text-center max-w-sm">
                    System configuration, API key management, and platform settings will be available here.
                </p>
            </div>
        </main>
    );
}
