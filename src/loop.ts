import { FRAME_DURATION } from './physics';

// Longer frames (hidden tab, long task) advance animation by this duration only
const MAX_FRAME_DURATION = 100;

export interface Loop {
    /** Request the next frame, a stopped loop starts with the last measured frame duration */
    start(): void;
    /** Cancel the next frame */
    stop(): void;
}

/**
 * requestAnimationFrame loop that passes the time since the previous frame in 60 Hz frames. It runs until stopped,
 * `frame` may stop or restart it.
 */
export function createLoop(frame: (frames: number) => void): Loop {
    let isRunning = false;
    let rafId = 0;
    let lastTime: number | null = null;
    let lastDuration = FRAME_DURATION;

    // The first frame of a loop has no previous one and reuses the last measured frame duration
    const getElapsedFrames = (time: number): number => {
        const previousTime = lastTime;
        lastTime = time;
        if (previousTime === null) {
            return lastDuration / FRAME_DURATION;
        }
        const duration = Math.min(time - previousTime, MAX_FRAME_DURATION);
        if (duration > 0) {
            lastDuration = duration;
        }
        return Math.max(duration, 0) / FRAME_DURATION;
    };

    const tick = (time: number) => {
        const id = rafId;
        frame(getElapsedFrames(time));
        // Stopped or restarted by frame(): nothing to request, or the next frame is already requested
        if (isRunning && rafId === id) {
            rafId = requestAnimationFrame(tick);
        }
    };

    return {
        start() {
            if (!isRunning) {
                lastTime = null;
            }
            isRunning = true;
            cancelAnimationFrame(rafId);
            rafId = requestAnimationFrame(tick);
        },
        stop() {
            isRunning = false;
            cancelAnimationFrame(rafId);
        },
    };
}
