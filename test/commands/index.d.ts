import type { MouseStep } from './mouse.ts';
import type { TouchStep } from './touch.ts';

declare module 'vitest/browser' {
    interface BrowserCommands {
        mouse(steps: MouseStep[], innerWidth: number): Promise<void>;
        touch(steps: TouchStep[], innerWidth: number): Promise<void>;
        emulateReducedMotion(value: 'reduce' | 'no-preference' | 'reset'): Promise<void>;
    }
}
