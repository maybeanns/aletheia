export interface TelemetryEvent {
    type: 'keystroke' | 'paste' | 'idle';
    timestamp: number;
    data: any;
}

export class TelemetryCollector {
    private events: TelemetryEvent[] = [];
    private flushCallback: (events: TelemetryEvent[]) => void;
    private batchSize: number;
    private flushInterval: number;
    private timer: NodeJS.Timeout | null = null;

    constructor(
        flushCallback: (events: TelemetryEvent[]) => void,
        batchSize = 50,
        flushInterval = 5000
    ) {
        this.flushCallback = flushCallback;
        this.batchSize = batchSize;
        this.flushInterval = flushInterval;
    }

    public log(type: TelemetryEvent['type'], data: any) {
        this.events.push({
            type,
            timestamp: Date.now(),
            data,
        });

        if (this.events.length >= this.batchSize) {
            this.flush();
        } else {
            this.scheduleFlush();
        }
    }

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

    public getEvents() {
        return this.events;
    }

    public clear() {
        this.events = [];
    }
}
