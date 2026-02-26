/**
 * Flight Recorder — WebSocket Server
 *
 * Handles real-time event streaming from the student's browser to the
 * server-side flight recorder.  Events are folded into the running hash
 * immediately upon receipt.
 *
 * PROTOCOL (JSON over WebSocket):
 *
 *   Client → Server:
 *     { "action": "start", "studentId": "...", "assignmentId": "...", "sessionId": "..." }
 *     { "action": "event", "event": { "type": "keystroke", "timestamp": ..., "data": {...} } }
 *     { "action": "code-sync", "code": "..." }   // periodic full-code snapshot
 *     { "action": "end" }
 *
 *   Server → Client:
 *     { "status": "ok", "eventCount": N }
 *     { "status": "error", "message": "..." }
 *     { "status": "session-started", "sessionId": "..." }
 *     { "status": "hash", "hash": "..." }   // sent on "end" for client to include in audit token
 *
 * INTEGRATION:
 *   This module exports `attachFlightRecorderWS(server)` which attaches
 *   the WebSocket handler to an existing HTTP server on path `/ws/flight-recorder`.
 *   Called from the custom `server.ts`.
 *
 * SECURITY:
 *   - In production, validate the session JWT in the WebSocket upgrade
 *     handshake before accepting the connection.
 *   - Rate limit: max 100 events/second per connection.
 */

import { WebSocketServer, WebSocket } from 'ws';
import type { Server as HTTPServer } from 'http';
import { sessionStore, FlightEvent } from './session-store';

// Per-connection state
interface ConnectionState {
    studentId: string | null;
    assignmentId: string | null;
    sessionId: string | null;
    eventCount: number;
    lastEventTime: number;
}

const MAX_EVENTS_PER_SECOND = 100;

export function attachFlightRecorderWS(server: HTTPServer): WebSocketServer {
    const wss = new WebSocketServer({
        server,
        path: '/ws/flight-recorder',
    });

    wss.on('connection', (ws: WebSocket) => {
        const state: ConnectionState = {
            studentId: null,
            assignmentId: null,
            sessionId: null,
            eventCount: 0,
            lastEventTime: 0,
        };

        ws.on('message', async (raw) => {
            try {
                const msg = JSON.parse(raw.toString());

                switch (msg.action) {
                    // ── Session start ──────────────────────────────────────
                    case 'start': {
                        const { studentId, assignmentId, sessionId } = msg;

                        if (!studentId || !assignmentId || !sessionId) {
                            ws.send(JSON.stringify({
                                status: 'error',
                                message: 'Missing studentId, assignmentId, or sessionId',
                            }));
                            return;
                        }

                        state.studentId = studentId;
                        state.assignmentId = assignmentId;
                        state.sessionId = sessionId;

                        await sessionStore.create(studentId, assignmentId, sessionId);

                        ws.send(JSON.stringify({
                            status: 'session-started',
                            sessionId,
                        }));
                        break;
                    }

                    // ── Telemetry event ────────────────────────────────────
                    case 'event': {
                        if (!state.studentId || !state.assignmentId) {
                            ws.send(JSON.stringify({
                                status: 'error',
                                message: 'Session not started. Send "start" first.',
                            }));
                            return;
                        }

                        // Rate limiting
                        const now = Date.now();
                        if (now - state.lastEventTime < (1000 / MAX_EVENTS_PER_SECOND)) {
                            // Silently drop — don't flood the client with errors
                            return;
                        }
                        state.lastEventTime = now;

                        const event: FlightEvent = msg.event;
                        if (!event || !event.type || !event.timestamp) {
                            ws.send(JSON.stringify({
                                status: 'error',
                                message: 'Invalid event shape',
                            }));
                            return;
                        }

                        await sessionStore.push(state.studentId, state.assignmentId, event);
                        state.eventCount++;

                        // Acknowledge every 10th event to reduce chatter
                        if (state.eventCount % 10 === 0) {
                            ws.send(JSON.stringify({
                                status: 'ok',
                                eventCount: state.eventCount,
                            }));
                        }
                        break;
                    }

                    // ── Code sync (full snapshot) ─────────────────────────
                    case 'code-sync': {
                        if (!state.studentId || !state.assignmentId) return;

                        const code = msg.code;
                        if (typeof code !== 'string') return;

                        // Treat code-sync as a special event type
                        await sessionStore.push(state.studentId, state.assignmentId, {
                            type: 'code-change',
                            timestamp: Date.now(),
                            data: { code },
                        });

                        ws.send(JSON.stringify({ status: 'ok', action: 'code-synced' }));
                        break;
                    }

                    // ── Session end — return the server's hash ────────────
                    case 'end': {
                        if (!state.studentId || !state.assignmentId) {
                            ws.send(JSON.stringify({
                                status: 'error',
                                message: 'No active session',
                            }));
                            return;
                        }

                        const session = await sessionStore.get(
                            state.studentId,
                            state.assignmentId
                        );

                        ws.send(JSON.stringify({
                            status: 'hash',
                            hash: session?.runningHash ?? '',
                            eventCount: session?.eventCount ?? 0,
                        }));
                        break;
                    }

                    default:
                        ws.send(JSON.stringify({
                            status: 'error',
                            message: `Unknown action: ${msg.action}`,
                        }));
                }
            } catch (err) {
                console.error('[FlightRecorder:WS] Message handling error:', err);
                ws.send(JSON.stringify({
                    status: 'error',
                    message: 'Internal server error',
                }));
            }
        });

        ws.on('close', () => {
            console.log(
                `[FlightRecorder:WS] Connection closed: ` +
                `${state.studentId}/${state.assignmentId} (${state.eventCount} events)`
            );
        });

        ws.on('error', (err) => {
            console.error('[FlightRecorder:WS] WebSocket error:', err);
        });
    });

    console.log('[FlightRecorder:WS] WebSocket server attached at /ws/flight-recorder');
    return wss;
}
