import { computeIKIStats, detectDrift, updateProfile, createEmptyProfile, IKIProfile, DriftReport } from './iki-analyzer';

export interface TelemetryEvent {
    type: 'keystroke' | 'paste' | 'idle';
    timestamp: number;
    data: any;
}

/**
 * TelemetryCollector
 *
 * Collects raw editor events AND maintains an in-memory IKI (inter-keystroke
 * interval) analysis pipeline.  On every flush it:
 *   1. Emits the raw event batch to the upstream callback.
 *   2. Computes IKI stats for the current session window.
 *   3. Runs drift detection against the student's rolling baseline profile.
 *   4. Updates the baseline profile.
 *
 * The profile is stored in localStorage so it persists across page reloads
 * within the same browser session, without needing a round-trip to the server
 * for every flush.  On submission the full profile + last drift report should
 * be included in the audit payload.
 */
export class TelemetryCollector {
    private events: TelemetryEvent[] = [];
    /** Raw keystroke timestamps accumulated since last profile update */
    private keystrokeTimestamps: number[] = [];

    private flushCallback: (events: TelemetryEvent[]) => void;
    private batchSize: number;
    private flushInterval: number;
    private timer: NodeJS.Timeout | null = null;

    /** Student's rolling IKI baseline (loaded/saved to localStorage) */
    private profile: IKIProfile;
    private readonly PROFILE_STORAGE_KEY = 'aletheia_iki_profile';

    /** Most recent drift analysis result */
    public lastDriftReport: DriftReport | null = null;

    constructor(
        flushCallback: (events: TelemetryEvent[]) => void,
        batchSize = 50,
        flushInterval = 5000
    ) {
        this.flushCallback = flushCallback;
        this.batchSize = batchSize;
        this.flushInterval = flushInterval;
        this.profile = this.loadProfile();
    }

    // ── Public API ──────────────────────────────────────────────────────────

    public log(type: TelemetryEvent['type'], data: any) {
        const now = Date.now();
        this.events.push({ type, timestamp: now, data });

        // Track keystroke timestamps for IKI computation
        if (type === 'keystroke') {
            this.keystrokeTimestamps.push(now);
        }

        if (this.events.length >= this.batchSize) {
            this.flush();
        } else {
            this.scheduleFlush();
        }
    }

    public getEvents(): TelemetryEvent[] {
        return this.events;
    }

    public getProfile(): IKIProfile {
        return this.profile;
    }

    public getLastDriftReport(): DriftReport | null {
        return this.lastDriftReport;
    }

    /**
     * Finalise the current session: compute IKI stats, run drift detection,
     * update the baseline profile, persist it, and return the drift report.
     * Call this just before building the submission audit token.
     */
    public finaliseSession(): DriftReport | null {
        const sessionStats = computeIKIStats(this.keystrokeTimestamps);
        if (!sessionStats) return null;

        const report = detectDrift(sessionStats, this.profile);
        this.lastDriftReport = report;

        // Update the baseline after drift detection so this session's data
        // doesn't pollute the comparison for its own submission.
        this.profile = updateProfile(this.profile, sessionStats);
        this.saveProfile(this.profile);

        // Reset per-session accumulation
        this.keystrokeTimestamps = [];

        return report;
    }

    public clear() {
        this.events = [];
        this.keystrokeTimestamps = [];
    }

    // ── Private helpers ─────────────────────────────────────────────────────

    private scheduleFlush() {
        if (this.timer) return;
        this.timer = setTimeout(() => this.flush(), this.flushInterval);
    }

    private flush() {
        if (this.events.length === 0) return;

        const batch = [...this.events];
        this.events = [];
        this.flushCallback(batch);

        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = null;
        }
    }

    private loadProfile(): IKIProfile {
        if (typeof window === 'undefined') return createEmptyProfile();
        try {
            const raw = localStorage.getItem(this.PROFILE_STORAGE_KEY);
            if (raw) return JSON.parse(raw) as IKIProfile;
        } catch {
            // ignore parse errors
        }
        return createEmptyProfile();
    }

    private saveProfile(profile: IKIProfile) {
        if (typeof window === 'undefined') return;
        try {
            localStorage.setItem(this.PROFILE_STORAGE_KEY, JSON.stringify(profile));
        } catch {
            // ignore storage errors
        }
    }
}
