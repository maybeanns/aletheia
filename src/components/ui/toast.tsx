'use client';

import { useState, useEffect, useCallback, createContext, useContext } from 'react';
import { cn } from '@/lib/utils/cn';
import { CheckCircle, AlertCircle, Info, X } from 'lucide-react';

interface Toast {
    id: string;
    message: string;
    type: 'success' | 'error' | 'info';
    duration?: number;
}

interface ToastContextValue {
    toast: (message: string, type?: Toast['type'], duration?: number) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
    const ctx = useContext(ToastContext);
    if (!ctx) throw new Error('useToast must be used within ToastProvider');
    return ctx;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const addToast = useCallback((message: string, type: Toast['type'] = 'info', duration = 5000) => {
        const id = `toast-${Date.now()}`;
        setToasts(prev => [...prev, { id, message, type, duration }]);
    }, []);

    const removeToast = useCallback((id: string) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    return (
        <ToastContext.Provider value={{ toast: addToast }}>
            {children}
            {/* Toast container */}
            <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-sm">
                {toasts.map(t => (
                    <ToastItem key={t.id} toast={t} onDismiss={removeToast} />
                ))}
            </div>
        </ToastContext.Provider>
    );
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: string) => void }) {
    useEffect(() => {
        const timer = setTimeout(() => onDismiss(toast.id), toast.duration || 5000);
        return () => clearTimeout(timer);
    }, [toast.id, toast.duration, onDismiss]);

    const icons = {
        success: <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0" />,
        error: <AlertCircle className="h-4 w-4 text-destructive shrink-0" />,
        info: <Info className="h-4 w-4 text-primary shrink-0" />,
    };

    return (
        <div className={cn(
            'flex items-start gap-3 rounded-lg border p-4 shadow-lg animate-in slide-in-from-right-5 fade-in-0 duration-300',
            'bg-card border-border text-foreground'
        )}>
            {icons[toast.type]}
            <p className="text-sm flex-1">{toast.message}</p>
            <button onClick={() => onDismiss(toast.id)} className="text-muted-foreground hover:text-foreground shrink-0">
                <X className="h-3.5 w-3.5" />
            </button>
        </div>
    );
}
