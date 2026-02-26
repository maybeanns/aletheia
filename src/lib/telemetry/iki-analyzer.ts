/**
 * Inter-Keystroke Interval (IKI) Analyzer
 *
 * Everyone has a unique "typing signature" expressed as a statistical
 * distribution of intervals between successive keystrokes.  This module:
 *
 *   1. Computes per-session IKI statistics (mean, median, std-dev, p95).
 *   2. Builds a running "baseline profile" accumulated over many sessions.
 *   3. Detects when a new session's signature diverges significantly from
 *      the baseline – a potential indicator that someone else is typing.
 *
 * The drift score is a normalised distance between the two distributions
 * using a simple but robust metric (relative difference of medians + std-dev
 * ratio), capped to the range [0, 1].  A score > DRIFT_THRESHOLD is flagged.
 */

export interface IKIStats {
    /** Sample size (number of inter-keystroke intervals recorded) */
    sampleSize: number;
    /** Arithmetic mean interval in milliseconds */
    mean: number;
    /** Median interval in milliseconds */
    median: number;
    /** Standard deviation in milliseconds */
    stdDev: number;
    /** 95th-percentile interval in milliseconds */
    p95: number;
    /** Coefficient of variation (stdDev / mean) – rhythm consistency */
    cv: number;
}

export interface IKIProfile {
    /** Rolling stats across all recorded sessions */
    baseline: IKIStats | null;
    /** Number of sessions that contributed to the baseline */
    sessionCount: number;
    /** Total keystrokes recorded across all sessions */
    totalKeystrokes: number;
    /** Timestamp (ms) of the last session used to update the baseline */
    lastUpdatedAt: number;
}

export interface DriftReport {
    /** Whether a meaningful baseline exists yet */
    hasBaseline: boolean;
    /** Normalised drift score in [0, 1].  Higher = more anomalous. */
    driftScore: number;
    /** True when driftScore exceeds DRIFT_THRESHOLD */
    isFlagged: boolean;
    /** Breakdown of what drove the score */
    components: {
        medianDrift: number;
        stdDevRatio: number;
        cvDelta: number;
    };
    sessionStats: IKIStats;
    baselineStats: IKIStats | null;
}

/** Minimum sessions before we trust the baseline enough to flag drift */
const MIN_BASELINE_SESSIONS = 3;

/** Score above which we flag the session as anomalous */
const DRIFT_THRESHOLD = 0.35;

// ---------------------------------------------------------------------------
// Core maths helpers
// ---------------------------------------------------------------------------

function sortedNums(nums: number[]): number[] {
    return [...nums].sort((a, b) => a - b);
}

function mean(nums: number[]): number {
    if (nums.length === 0) return 0;
    return nums.reduce((s, v) => s + v, 0) / nums.length;
}

function median(sorted: number[]): number {
    if (sorted.length === 0) return 0;
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0
        ? (sorted[mid - 1] + sorted[mid]) / 2
        : sorted[mid];
}

function stdDev(nums: number[], avg: number): number {
    if (nums.length < 2) return 0;
    const variance = nums.reduce((s, v) => s + (v - avg) ** 2, 0) / (nums.length - 1);
    return Math.sqrt(variance);
}

function percentile(sorted: number[], p: number): number {
    if (sorted.length === 0) return 0;
    const idx = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, Math.min(idx, sorted.length - 1))];
}

// ---------------------------------------------------------------------------
// IKI computation
// ---------------------------------------------------------------------------

/**
 * Derive IKI statistics from a list of raw keystroke timestamps (ms).
 * Timestamps need NOT be pre-sorted; they are sorted internally.
 * Returns null when fewer than 2 timestamps are provided.
 */
export function computeIKIStats(timestamps: number[]): IKIStats | null {
    if (timestamps.length < 2) return null;

    const sorted = sortedNums(timestamps);
    const intervals: number[] = [];

    for (let i = 1; i < sorted.length; i++) {
        const gap = sorted[i] - sorted[i - 1];
        // Ignore unrealistically long pauses (> 10 s) – the student likely
        // stopped to think; those don't characterise typing rhythm.
        if (gap > 0 && gap <= 10_000) {
            intervals.push(gap);
        }
    }

    if (intervals.length < 2) return null;

    const sortedIntervals = sortedNums(intervals);
    const avg = mean(intervals);
    const sd = stdDev(intervals, avg);

    return {
        sampleSize: intervals.length,
        mean: Math.round(avg),
        median: Math.round(median(sortedIntervals)),
        stdDev: Math.round(sd),
        p95: Math.round(percentile(sortedIntervals, 95)),
        cv: avg > 0 ? parseFloat((sd / avg).toFixed(4)) : 0,
    };
}

// ---------------------------------------------------------------------------
// Profile management
// ---------------------------------------------------------------------------

/**
 * Merge a new session's IKI stats into an existing profile using an
 * exponential moving average so that recent sessions have more weight.
 */
export function updateProfile(
    profile: IKIProfile,
    sessionStats: IKIStats
): IKIProfile {
    const alpha = 0.3; // EMA smoothing factor – higher = more reactive to recent sessions

    if (!profile.baseline) {
        // First session – initialise the baseline directly
        return {
            baseline: { ...sessionStats },
            sessionCount: 1,
            totalKeystrokes: sessionStats.sampleSize,
            lastUpdatedAt: Date.now(),
        };
    }

    const b = profile.baseline;

    const ema = (prev: number, curr: number) =>
        parseFloat((alpha * curr + (1 - alpha) * prev).toFixed(2));

    const newBaseline: IKIStats = {
        sampleSize: Math.round(ema(b.sampleSize, sessionStats.sampleSize)),
        mean: Math.round(ema(b.mean, sessionStats.mean)),
        median: Math.round(ema(b.median, sessionStats.median)),
        stdDev: Math.round(ema(b.stdDev, sessionStats.stdDev)),
        p95: Math.round(ema(b.p95, sessionStats.p95)),
        cv: parseFloat(ema(b.cv, sessionStats.cv).toFixed(4)),
    };

    return {
        baseline: newBaseline,
        sessionCount: profile.sessionCount + 1,
        totalKeystrokes: profile.totalKeystrokes + sessionStats.sampleSize,
        lastUpdatedAt: Date.now(),
    };
}

export function createEmptyProfile(): IKIProfile {
    return {
        baseline: null,
        sessionCount: 0,
        totalKeystrokes: 0,
        lastUpdatedAt: 0,
    };
}

// ---------------------------------------------------------------------------
// Drift detection
// ---------------------------------------------------------------------------

/**
 * Compare a session's IKI stats against the established baseline and produce
 * a DriftReport.  Returns a report with hasBaseline=false when there aren't
 * enough sessions to make the baseline meaningful.
 */
export function detectDrift(
    sessionStats: IKIStats,
    profile: IKIProfile
): DriftReport {
    const noBaseline: DriftReport = {
        hasBaseline: false,
        driftScore: 0,
        isFlagged: false,
        components: { medianDrift: 0, stdDevRatio: 0, cvDelta: 0 },
        sessionStats,
        baselineStats: profile.baseline,
    };

    if (
        !profile.baseline ||
        profile.sessionCount < MIN_BASELINE_SESSIONS
    ) {
        return noBaseline;
    }

    const b = profile.baseline;
    const s = sessionStats;

    // ── Component 1: relative shift in median IKI ─────────────────────
    // A doubling/halving of the median contributes 1.0 to this component.
    const medianDrift = b.median > 0
        ? Math.abs(s.median - b.median) / b.median
        : 0;

    // ── Component 2: std-dev ratio ────────────────────────────────────
    // Compares rhythm consistency.  A 3× change in stdDev contributes 1.0.
    const stdDevRatio = b.stdDev > 0
        ? Math.min(Math.abs(s.stdDev / b.stdDev - 1), 2) / 2
        : 0;

    // ── Component 3: coefficient of variation delta ────────────────────
    // CV is scale-invariant; a delta > 0.5 contributes 1.0.
    const cvDelta = Math.min(Math.abs(s.cv - b.cv) / 0.5, 1);

    // Weighted combination: median shift is the most reliable signal
    const driftScore = parseFloat(
        (0.5 * medianDrift + 0.3 * stdDevRatio + 0.2 * cvDelta).toFixed(4)
    );
    const capped = Math.min(driftScore, 1);

    return {
        hasBaseline: true,
        driftScore: capped,
        isFlagged: capped > DRIFT_THRESHOLD,
        components: {
            medianDrift: parseFloat(medianDrift.toFixed(4)),
            stdDevRatio: parseFloat(stdDevRatio.toFixed(4)),
            cvDelta: parseFloat(cvDelta.toFixed(4)),
        },
        sessionStats,
        baselineStats: b,
    };
}
