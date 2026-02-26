/**
 * Shared IORedis Connection
 *
 * Single connection instance reused by BullMQ queues, workers, and
 * the flight-recorder session store.
 *
 * GRACEFUL DEGRADATION:
 *   If REDIS_URL is not set, all consumers get `null` and must fall
 *   back to in-process alternatives.  This keeps local dev zero-config.
 *
 * PRODUCTION:
 *   Set REDIS_URL to a Redis 7+ instance (Upstash, AWS ElastiCache,
 *   or self-hosted).  BullMQ requires a persistent TCP connection,
 *   so IORedis (not Upstash HTTP client) is the correct driver here.
 */

import IORedis from 'ioredis';

let _connection: IORedis | null = null;

export function getRedisConnection(): IORedis | null {
    if (_connection) return _connection;

    const url = process.env.REDIS_URL;
    if (!url) {
        console.warn('[Redis] REDIS_URL not set — Redis features disabled (in-process fallbacks active).');
        return null;
    }

    _connection = new IORedis(url, {
        maxRetriesPerRequest: null,   // Required by BullMQ
        enableReadyCheck: false,       // Speeds up initial connection
        retryStrategy(times) {
            // Exponential backoff capped at 3 seconds
            return Math.min(times * 200, 3000);
        },
    });

    _connection.on('error', (err) => {
        console.error('[Redis] Connection error:', err.message);
    });

    _connection.on('connect', () => {
        console.log('[Redis] Connected successfully.');
    });

    return _connection;
}

/**
 * Create a NEW IORedis connection (for BullMQ workers which need
 * their own dedicated connection).
 */
export function createRedisConnection(): IORedis | null {
    const url = process.env.REDIS_URL;
    if (!url) return null;

    return new IORedis(url, {
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
        retryStrategy(times) {
            return Math.min(times * 200, 3000);
        },
    });
}
