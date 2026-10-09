import { afterEach, beforeEach, vi } from 'vitest';
import { cleanup, installFrameClock } from './helpers.ts';

beforeEach(() => {
    installFrameClock();
});

afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
});
