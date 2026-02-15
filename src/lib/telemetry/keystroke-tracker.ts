'use client';

import { useEffect, useRef } from 'react';

export interface KeystrokeEvent {
    key: string;
    code: string;
    event: 'down' | 'up';
    timestamp: number;
}

export function useKeystrokeTracker(callback: (events: KeystrokeEvent[]) => void) {
    const eventsBuffer = useRef<KeystrokeEvent[]>([]);
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Ignore modifier keys alone mostly but we want to capture everything for analysis
            eventsBuffer.current.push({
                key: e.key,
                code: e.code,
                event: 'down',
                timestamp: Date.now(),
            });
            scheduleFlush();
        };

        const handleKeyUp = (e: KeyboardEvent) => {
            eventsBuffer.current.push({
                key: e.key,
                code: e.code,
                event: 'up',
                timestamp: Date.now(),
            });
            scheduleFlush();
        };

        const scheduleFlush = () => {
            if (timeoutRef.current) return;
            timeoutRef.current = setTimeout(() => {
                if (eventsBuffer.current.length > 0) {
                    callback([...eventsBuffer.current]);
                    eventsBuffer.current = [];
                }
                timeoutRef.current = null;
            }, 2000); // Flush every 2 seconds of inactivity or batch size
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
        };
    }, [callback]);
}
