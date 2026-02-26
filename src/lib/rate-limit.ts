/**
 * Rate Limiter — Upstash Redis + @upstash/ratelimit
 *
 * PROBLEM:
 * Without rate limits, a single student can hammer /api/ai/chat faster than
 * Gemini's RPM quota allows, causing 429s for everyone else in the class.
 * Additionally, the Groq classification endpoint has its own tier limits.
 *
 * SOLUTION — Sliding-window rate limiting per user, enforced at the edge:
 *
 *   /api/ai/chat       →  10 requests / 10 seconds  per user  (Socratic chat)
 *   /api/submissions   →   5 requests / 60 seconds  per user  (submission burst guard)
 *   Global catch-all   → 100 requests / 60 seconds  per IP    (DDoS protection)
 *
 * WHY UPSTASH:
 *   - Serverless-native Redis with an HTTP REST API — works in both Node.js and
 *     Vercel Edge Runtime (no persistent TCP connection required).
 *   - Global replication means a student in London and one in New York both
 *     share the same rate-limit counter with ~10ms latency to the nearest
 *     Upstash region.
 *   - Free tier: 10,000 commands/day — enough for ~1,000 chat messages.
 *
 * GRACEFUL DEGRADATION:
 *   If UPSTASH_REDIS_REST_URL / TOKEN are not set (local dev / CI),
 *   the limiter bypasses all checks and returns { allowed: true }.
 *   This means you never need Redis locally.
 */

import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

function buildRedis(): Redis | null {
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;

    if (!url || !token) {
        // Not configured — rate limiting is disabled (dev / CI mode)
        return null;
    }

    return new Redis({ url, token });
}

const redis = buildRedis();

// ---------------------------------------------------------------------------
// Limiters
// ---------------------------------------------------------------------------

/**
 * Socratic chat limiter: 10 requests per 10 seconds per user.
 * This maps to ~1 message/second burst tolerance with a 10-s cooldown.
 */
export const chatRateLimiter = redis
    ? new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(10, '10 s'),
        analytics: true,
        prefix: 'aletheia:rl:chat',
    })
    : null;

/**
 * Submission limiter: 5 requests per 60 seconds per user.
 * Prevents "submit-spam" attacks and double-click submissions.
 */
export const submissionRateLimiter = redis
    ? new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(5, '60 s'),
        analytics: true,
        prefix: 'aletheia:rl:submission',
    })
    : null;

/**
 * Global IP limiter: 100 requests per 60 seconds per IP.
 * Applied before authentication as a coarse DDoS shield.
 */
export const globalRateLimiter = redis
    ? new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(100, '60 s'),
        analytics: true,
        prefix: 'aletheia:rl:global',
    })
    : null;

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

export interface RateLimitResult {
    allowed: boolean;
    /** Remaining requests in the current window */
    remaining: number;
    /** Epoch ms when the window resets */
    resetAt: number;
    /** The limiter that made the decision (for logging) */
    limiterId: string;
}

/**
 * Check a named rate limiter.  Returns `{ allowed: true }` when Redis is
 * not configured (graceful degradation).
 */
export async function checkRateLimit(
    limiter: Ratelimit | null,
    identifier: string,
    limiterId: string
): Promise<RateLimitResult> {
    if (!limiter) {
        return { allowed: true, remaining: Infinity, resetAt: 0, limiterId };
    }

    const result = await limiter.limit(identifier);

    return {
        allowed: result.success,
        remaining: result.remaining,
        resetAt: result.reset,
        limiterId,
    };
}
