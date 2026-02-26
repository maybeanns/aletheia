import { NextRequest, NextResponse } from 'next/server';
import NextAuth from 'next-auth';
import { authConfig } from '@/lib/auth/auth.config';
import { checkRateLimit, globalRateLimiter } from '@/lib/rate-limit';

const { auth } = NextAuth(authConfig);

/**
 * Next.js Proxy (formerly Middleware)
 *
 * Runs before every matched request. Handles two concerns:
 *
 * 1. GLOBAL RATE LIMITING (Upstash Redis)
 *    A coarse 100 req/60 s per-IP sliding window applied to all API routes.
 *    Skipped when UPSTASH_REDIS_REST_URL is not set (local dev / CI).
 *
 * 2. AUTHENTICATION (NextAuth)
 *    Redirects unauthenticated users away from protected dashboard routes.
 */
export default async function proxy(req: NextRequest) {
    // ── 1. Global IP rate limit (API routes only) ──────────────────────────
    if (req.nextUrl.pathname.startsWith('/api/')) {
        const ip =
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
    return (auth as any)(req);
}

export const config = {
    matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
