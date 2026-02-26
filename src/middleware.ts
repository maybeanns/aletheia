import { NextRequest, NextResponse } from 'next/server';
import NextAuth from 'next-auth';
import { authConfig } from '@/lib/auth/auth.config';
import { checkRateLimit, globalRateLimiter } from '@/lib/rate-limit';

const { auth } = NextAuth(authConfig);

/**
 * Next.js Middleware
 *
 * Runs at the EDGE before every matched request.  Handles two concerns:
 *
 * 1. GLOBAL RATE LIMITING (Upstash Redis)
 *    A coarse 100 req/60 s per-IP sliding window applied to all API routes.
 *    This is the first line of defence — it fires before authentication,
 *    before any serverless function cold-start, and before touching the DB.
 *    Individual endpoints (chat, submissions) enforce tighter per-user limits
 *    inside their route handlers.
 *
 *    Skipped when UPSTASH_REDIS_REST_URL is not set (local dev / CI).
 *
 * 2. AUTHENTICATION (NextAuth)
 *    Redirects unauthenticated users away from protected dashboard routes.
 *    Implemented via NextAuth's built-in middleware helper.
 */
export default async function middleware(req: NextRequest) {
    // ── 1. Global IP rate limit (API routes only) ──────────────────────────
    if (req.nextUrl.pathname.startsWith('/api/')) {
        const ip =
            req.ip ??
            req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
            'unknown';

        const result = await checkRateLimit(globalRateLimiter, ip, 'global');

        if (!result.allowed) {
            const retryAfterSec = Math.ceil((result.resetAt - Date.now()) / 1000);
            return NextResponse.json(
                { error: 'Too many requests from your IP. Please try again shortly.' },
                {
                    status: 429,
                    headers: {
                        'Retry-After': String(retryAfterSec),
                        'X-RateLimit-Limit': '100',
                        'X-RateLimit-Reset': String(result.resetAt),
                    },
                }
            );
        }
    }

    // ── 2. Authentication ──────────────────────────────────────────────────
    // NextAuth's `auth` middleware handles session validation and redirects.
    // Cast needed because Next.js middleware type expects a specific signature.
    return (auth as any)(req);
}

export const config = {
    // Apply to all routes except Next.js internals and static assets
    matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
