import { afterEach, beforeEach, vi } from 'vitest';
import { cleanup, installFrameClock } from './helpers.js';

beforeEach(() => {
    installFrameClock();
});

afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
});
