import { PrismaClient } from '@prisma/client';

/**
 * Prisma Singleton with connection-pool tuning.
 *
 * WHY THIS MATTERS:
 * Each Next.js serverless function invocation can spin up its own PrismaClient,
 * quickly exhausting Postgres' max_connections (default: 100 on Supabase free tier).
 * During peak exam hours (9 AM Monday) hundreds of concurrent invocations will
 * hit the DB simultaneously.
 *
 * SOLUTION:
 * 1. `connection_limit=1` in the pooler URL — Supavisor / PgBouncer handles the
 *    actual pool externally.  Each serverless instance only holds ONE logical slot,
 *    preventing the N×M connection explosion.
 * 2. `pool_timeout=10` — fail fast instead of queueing indefinitely.
 * 3. `connect_timeout=10` — surface slow DB boots quickly instead of hanging.
 * 4. `pgbouncer=true` — disables Prisma's prepared-statement caching, which is
 *    incompatible with PgBouncer's transaction-mode pooling.
 * 5. The singleton pattern (globalThis) prevents multiple PrismaClient instances
 *    during Next.js hot-reload in development.
 *
 * DEPLOYMENT NOTE:
 *   DATABASE_URL must use the Supavisor pooler endpoint (port 6543), NOT the
 *   direct connection (port 5432). The DIRECT_URL (port 5432) is used only for
 *   migrations via `prisma migrate deploy`.
 *
 * FURTHER SCALING (> 500 concurrent users):
 *   Move to PgBouncer-in-process (pgpool-II) or Supabase connection pooler with
 *   dedicated pool size configured per environment.
 */
function buildPrismaClient(): PrismaClient {
    const datasourceUrl = buildPoolerUrl(process.env.DATABASE_URL);

    return new PrismaClient({
        datasourceUrl,
        log: process.env.NODE_ENV === 'development'
            ? ['warn', 'error']
            : ['error'],
    });
}

/**
 * Ensures the DATABASE_URL contains the parameters required for external
 * connection pooling (Supavisor / PgBouncer transaction mode).
 *
 * If the URL already contains these params they are left untouched.
 */
function buildPoolerUrl(rawUrl: string | undefined): string | undefined {
    if (!rawUrl) return undefined;

    try {
        const url = new URL(rawUrl);

        // Required for PgBouncer transaction-pool mode
        if (!url.searchParams.has('pgbouncer')) {
            url.searchParams.set('pgbouncer', 'true');
        }
        // One connection per serverless instance; the pooler handles the rest
        if (!url.searchParams.has('connection_limit')) {
            url.searchParams.set('connection_limit', '1');
        }
        // How long Prisma waits for a connection slot (seconds)
        if (!url.searchParams.has('pool_timeout')) {
            url.searchParams.set('pool_timeout', '10');
        }
        // How long to wait for the initial TCP connection
        if (!url.searchParams.has('connect_timeout')) {
            url.searchParams.set('connect_timeout', '10');
        }

        return url.toString();
    } catch {
        // If the URL is malformed, return as-is and let Prisma surface the error
        return rawUrl;
    }
}

declare global {
    // eslint-disable-next-line no-var
    var prismaGlobal: PrismaClient | undefined;
}

const prisma: PrismaClient = globalThis.prismaGlobal ?? buildPrismaClient();

export default prisma;

// In development, attach to globalThis so Next.js HMR reuses the same client
if (process.env.NODE_ENV !== 'production') {
    globalThis.prismaGlobal = prisma;
}
