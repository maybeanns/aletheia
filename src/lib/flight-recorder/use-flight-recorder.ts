'use client';

/**
 * useFlightRecorder — Client-Side WebSocket Hook
 *
 * STABILITY GUARANTEES:
 *   - Connects exactly ONCE on mount
 *   - If connection fails 3 times in a row, STOPS trying (no infinite loops)
 *   - Never causes a page refresh or re-render cascade
 *   - All state updates are batched and guarded by mountedRef
 *   - Returns stable callbacks that never change identity
 */

import { useCallback, useEffect, useRef, useState } from 'react';

interface FlightRecorderOptions {
    studentId: string;
    assignmentId: string;
    sessionId: string;
    wsUrl?: string;
    enabled?: boolean;
}

interface FlightRecorderReturn {
    isConnected: boolean;
    serverHash: string | null;
    serverEventCount: number;
    sendEvent: (event: { type: string; timestamp: number; data: Record<string, unknown> }) => void;
    syncCode: (code: string) => void;
    endSession: () => Promise<string>;
}

const MAX_BUFFER_SIZE = 500;
const MAX_RECONNECTS = 3;   // Give up after 3 failures — don't spam
const RECONNECT_MS = 5000; // Fixed 5s delay between attempts

export function useFlightRecorder({
    studentId,
    assignmentId,
    sessionId,
    wsUrl,
    enabled = true,
}: FlightRecorderOptions): FlightRecorderReturn {
    const [isConnected, setIsConnected] = useState(false);
    const [serverHash, setServerHash] = useState<string | null>(null);
    const [serverEventCount, setServerEventCount] = useState(0);

    const wsRef = useRef<WebSocket | null>(null);
    const bufferRef = useRef<any[]>([]);
    const reconnectCountRef = useRef(0);
    const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const hashResolverRef = useRef<((hash: string) => void) | null>(null);
    const mountedRef = useRef(true);
    const gaveUpRef = useRef(false);

    // Capture options once — never re-read from props
    const optsRef = useRef({ studentId, assignmentId, sessionId, wsUrl, enabled });

    // ── Stable send (never changes identity) ──────────────────────────────
    const send = useCallback((data: any) => {
        const ws = wsRef.current;
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify(data));
        } else if (bufferRef.current.length < MAX_BUFFER_SIZE) {
            bufferRef.current.push(data);
        }
    }, []);

    // ── Connect on mount, cleanup on unmount ──────────────────────────────
    useEffect(() => {
        if (!optsRef.current.enabled) return;
        if (typeof window === 'undefined') return;

        mountedRef.current = true;
        gaveUpRef.current = false;

        function getUrl(): string {
            if (optsRef.current.wsUrl) return optsRef.current.wsUrl;
            const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            return `${proto}//${window.location.host}/ws/flight-recorder`;
        }

        function connect() {
            // Guard: don't connect if unmounted or gave up
            if (!mountedRef.current || gaveUpRef.current) return;

            // Guard: don't exceed max retries
            if (reconnectCountRef.current >= MAX_RECONNECTS) {
                gaveUpRef.current = true;
                console.warn(
                    `[FlightRecorder] Stopped after ${MAX_RECONNECTS} failed connection attempts. ` +
                    'Flight recording is disabled for this session.'
                );
                return;
            }

            const url = getUrl();

            try {
                const ws = new WebSocket(url);
                wsRef.current = ws;

                ws.onopen = () => {
                    if (!mountedRef.current) { ws.close(); return; }

                    // Reset failure counter on successful connection
                    reconnectCountRef.current = 0;
                    setIsConnected(true);

                    // Start session
                    ws.send(JSON.stringify({
                        action: 'start',
                        studentId: optsRef.current.studentId,
                        assignmentId: optsRef.current.assignmentId,
                        sessionId: optsRef.current.sessionId,
                    }));

                    // Flush buffered events
                    const buffered = bufferRef.current.splice(0);
                    for (const msg of buffered) {
                        ws.send(JSON.stringify(msg));
                    }
                };

                ws.onmessage = (rawMsg) => {
                    if (!mountedRef.current) return;
                    try {
                        const msg = JSON.parse(rawMsg.data as string);
                        if (msg.status === 'ok' && typeof msg.eventCount === 'number') {
                            setServerEventCount(msg.eventCount);
                        }
                        if (msg.status === 'hash' && msg.hash) {
                            setServerHash(msg.hash);
                            setServerEventCount(msg.eventCount ?? 0);
                            if (hashResolverRef.current) {
                                hashResolverRef.current(msg.hash);
                                hashResolverRef.current = null;
                            }
                        }
                    } catch { /* ignore */ }
                };

                ws.onclose = () => {
                    wsRef.current = null;
                    if (!mountedRef.current) return;

                    setIsConnected(false);

                    // Only reconnect if we haven't given up
                    if (!gaveUpRef.current) {
                        reconnectCountRef.current++;
                        reconnectTimerRef.current = setTimeout(connect, RECONNECT_MS);
                    }
                };

                ws.onerror = () => {
                    // onclose fires after this — handled there
                };
            } catch {
                console.warn('[FlightRecorder] WebSocket not available.');
                gaveUpRef.current = true;
            }
        }

        // Start the first connection attempt
        connect();

        // Cleanup: prevent reconnects and close socket
        return () => {
            mountedRef.current = false;
            gaveUpRef.current = true;
            if (reconnectTimerRef.current) {
                clearTimeout(reconnectTimerRef.current);
                reconnectTimerRef.current = null;
            }
            if (wsRef.current) {
                wsRef.current.onclose = null; // prevent reconnect trigger
                wsRef.current.close();
                wsRef.current = null;
            }
        };
    }, []); // empty deps — runs exactly once

    // ── Public API (all stable — never change identity) ───────────────────

    const sendEvent = useCallback((event: { type: string; timestamp: number; data: Record<string, unknown> }) => {
        send({ action: 'event', event });
    }, [send]);

    const syncCode = useCallback((code: string) => {
        send({ action: 'code-sync', code });
    }, [send]);

    const endSession = useCallback((): Promise<string> => {
        return new Promise((resolve) => {
            hashResolverRef.current = resolve;
            send({ action: 'end' });

            // Timeout: resolve empty after 5s if server doesn't respond
            setTimeout(() => {
                if (hashResolverRef.current) {
                    hashResolverRef.current('');
                    hashResolverRef.current = null;
                }
            }, 5000);
        });
    }, [send]);

    return {
        isConnected,
        serverHash,
        serverEventCount,
        sendEvent,
        syncCode,
        endSession,
    };
}
