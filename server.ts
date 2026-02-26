/**
 * Custom Next.js Server with WebSocket Support
 *
 * WHY A CUSTOM SERVER:
 *   Next.js API routes (App Router) don't support WebSocket connections.
 *   The HTTP upgrade handshake requires access to the raw Node.js `http.Server`
 *   instance, which only a custom server provides.
 *
 * WHAT THIS DOES:
 *   1. Creates a standard HTTP server
 *   2. Attaches the Next.js request handler for all normal routes
 *   3. Attaches the Flight Recorder WebSocket server on `/ws/flight-recorder`
 *   4. Optionally starts the BullMQ telemetry worker in the same process
 *      (set INLINE_WORKER=true — useful for single-container deployments)
 *
 * HOW TO RUN:
 *   Development:   npx tsx server.ts
 *   Production:    node .next/standalone/server.js  (after `next build`)
 *
 * PACKAGE.JSON SCRIPTS:
 *   "dev":   "npx tsx server.ts"
 *   "start": "NODE_ENV=production node server.js"
 */

import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';

// Must use require for the flight recorder to avoid ESM/CJS issues
// with Next.js standalone build
const { attachFlightRecorderWS } = require('./src/lib/flight-recorder/ws-server');

const dev = process.env.NODE_ENV !== 'production';
const port = parseInt(process.env.PORT || '3000', 10);
const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(() => {
    const server = createServer((req, res) => {
        const parsedUrl = parse(req.url!, true);
        handle(req, res, parsedUrl);
    });

    // ── Attach Flight Recorder WebSocket ──────────────────────────────────
    attachFlightRecorderWS(server);

    // ── Optionally start the BullMQ telemetry worker inline ───────────────
    if (process.env.INLINE_WORKER === 'true') {
        try {
            const { startWorker } = require('./src/lib/db/telemetry-worker');
            startWorker();
            console.log('[Server] Inline BullMQ worker started.');
        } catch (err) {
            console.warn('[Server] Could not start inline worker:', err);
        }
    }

    server.listen(port, () => {
        console.log(`
╔══════════════════════════════════════════════════════════╗
║  Aletheia Server                                        ║
║  ─────────────────────────────────────────────────────   ║
║  HTTP:       http://localhost:${port}                      ║
║  WebSocket:  ws://localhost:${port}/ws/flight-recorder      ║
║  Mode:       ${dev ? 'development' : 'production'}                              ║
╚══════════════════════════════════════════════════════════╝
        `);
    });
});
