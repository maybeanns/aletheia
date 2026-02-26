import {
    computeIKIStats,
    detectDrift,
    updateProfile,
    createEmptyProfile,
    IKIProfile,
} from './iki-analyzer';

// ---------------------------------------------------------------------------
// computeIKIStats
// ---------------------------------------------------------------------------

describe('computeIKIStats', () => {
    it('returns null for fewer than 2 timestamps', () => {
        expect(computeIKIStats([])).toBeNull();
        expect(computeIKIStats([Date.now()])).toBeNull();
    });

    it('computes correct sample size and mean', () => {
        // 4 keystrokes with 100 ms gaps → 3 intervals of 100 ms
        const base = 1_700_000_000_000;
        const timestamps = [base, base + 100, base + 200, base + 300];
        const stats = computeIKIStats(timestamps);

        expect(stats).not.toBeNull();
        expect(stats!.sampleSize).toBe(3);
        expect(stats!.mean).toBe(100);
        expect(stats!.median).toBe(100);
        expect(stats!.stdDev).toBe(0);
        expect(stats!.p95).toBe(100);
        expect(stats!.cv).toBe(0);
    });

    it('filters out pauses longer than 10 seconds', () => {
        const base = 1_700_000_000_000;
        // 10 s gap should be excluded
        const tsWithLongPause = [base, base + 100, base + 100 + 15_000, base + 100 + 15_000 + 100];
        const stats = computeIKIStats(tsWithLongPause);

        // Only the two 100 ms intervals should survive
        expect(stats).not.toBeNull();
        expect(stats!.sampleSize).toBe(2);
        expect(stats!.mean).toBe(100);
    });

    it('computes non-zero stdDev for uneven intervals', () => {
        const base = 1_700_000_000_000;
        const timestamps = [base, base + 50, base + 200, base + 250, base + 500];
        const stats = computeIKIStats(timestamps);

        expect(stats).not.toBeNull();
        expect(stats!.stdDev).toBeGreaterThan(0);
        expect(stats!.cv).toBeGreaterThan(0);
    });
});

// ---------------------------------------------------------------------------
// updateProfile
// ---------------------------------------------------------------------------

describe('updateProfile', () => {
    const makeStats = (median: number, stdDev: number) => ({
        sampleSize: 100,
        mean: median,
        median,
        stdDev,
        p95: median + stdDev * 2,
        cv: stdDev / median,
    });

    it('initialises a baseline from the first session', () => {
        const profile = createEmptyProfile();
        const stats = makeStats(150, 30);
        const updated = updateProfile(profile, stats);

        expect(updated.sessionCount).toBe(1);
        expect(updated.baseline).not.toBeNull();
        expect(updated.baseline!.median).toBe(150);
    });

    it('uses EMA so the baseline shifts toward new data', () => {
        let profile = createEmptyProfile();

        // Seed baseline with 5 identical sessions
        for (let i = 0; i < 5; i++) {
            profile = updateProfile(profile, makeStats(150, 30));
        }

        // Now inject a faster typist
        profile = updateProfile(profile, makeStats(80, 20));

        // Baseline should have shifted toward 80 but not reached it
        expect(profile.baseline!.median).toBeLessThan(150);
        expect(profile.baseline!.median).toBeGreaterThan(80);
    });

    it('increments session count on every call', () => {
        let profile = createEmptyProfile();
        for (let i = 0; i < 4; i++) {
            profile = updateProfile(profile, makeStats(150, 30));
        }
        expect(profile.sessionCount).toBe(4);
    });
});

// ---------------------------------------------------------------------------
// detectDrift
// ---------------------------------------------------------------------------

describe('detectDrift', () => {
    const makeStats = (median: number, stdDev = 30) => ({
        sampleSize: 100,
        mean: median,
        median,
        stdDev,
        p95: median + stdDev * 2,
        cv: stdDev / median,
    });

    function buildMatureProfile(medianMs: number): IKIProfile {
        let profile = createEmptyProfile();
        // Need at least 3 sessions for drift detection to activate
        for (let i = 0; i < 4; i++) {
            profile = updateProfile(profile, makeStats(medianMs));
        }
        return profile;
    }

    it('returns hasBaseline=false when profile has fewer than 3 sessions', () => {
        let profile = createEmptyProfile();
        profile = updateProfile(profile, makeStats(150));
        profile = updateProfile(profile, makeStats(150));
        // Still only 2 sessions

        const report = detectDrift(makeStats(300), profile);
        expect(report.hasBaseline).toBe(false);
        expect(report.isFlagged).toBe(false);
    });

    it('does not flag sessions consistent with the baseline', () => {
        const profile = buildMatureProfile(150);
        const report = detectDrift(makeStats(155), profile);

        expect(report.hasBaseline).toBe(true);
        expect(report.isFlagged).toBe(false);
    });

    it('flags sessions with a dramatically different typing speed', () => {
        const profile = buildMatureProfile(150);
        // Simulate someone typing 4× faster
        const report = detectDrift(makeStats(38), profile);

        expect(report.hasBaseline).toBe(true);
        expect(report.isFlagged).toBe(true);
        expect(report.driftScore).toBeGreaterThan(0.35);
    });

    it('drift score is always in [0, 1]', () => {
        const profile = buildMatureProfile(150);
        // Extreme outlier
        const report = detectDrift(makeStats(5000, 1000), profile);

        expect(report.driftScore).toBeGreaterThanOrEqual(0);
        expect(report.driftScore).toBeLessThanOrEqual(1);
    });
});
