'use client';

import { useEffect } from 'react';

export interface PasteEvent {
    content: string;
    length: number;
    timestamp: number;
    isSuspicious: boolean;
}

export function usePasteDetector(callback: (event: PasteEvent) => void) {
    useEffect(() => {
        const handlePaste = (e: ClipboardEvent) => {
            const content = e.clipboardData?.getData('text/plain') || '';
            const length = content.length;
            const isSuspicious = length > 50; // Arbitrary threshold for flagging

            callback({
                content,
                length,
                timestamp: Date.now(),
                isSuspicious,
            });
        };

        window.addEventListener('paste', handlePaste);

        return () => {
            window.removeEventListener('paste', handlePaste);
        };
    }, [callback]);
}
