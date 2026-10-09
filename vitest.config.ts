import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vitest/config';
import { emulateReducedMotion } from './test/commands/media.ts';
import { mouse } from './test/commands/mouse.ts';
import { touch } from './test/commands/touch.ts';

export default defineConfig({
    test: {
        // V8 coverage works in Chromium only, `pnpm test:coverage` runs unit and chromium projects
        coverage: {
            provider: 'v8',
            include: ['src/**/*.ts'],
            reporter: ['text', 'html'],
        },
        projects: [
            {
                test: {
                    name: 'unit',
                    include: ['test/unit/**/*.test.ts'],
                    environment: 'node',
                },
            },
            {
                test: {
                    include: ['test/*.test.ts'],
                    setupFiles: ['test/setup.ts'],
                    browser: {
                        enabled: true,
                        provider: playwright(),
                        headless: true,
                        commands: { emulateReducedMotion, mouse, touch },
                        // Each instance is a project, run a subset with `--project chromium`
                        instances: [
                            { browser: 'chromium', name: 'chromium' },
                            { browser: 'firefox', name: 'firefox' },
                            { browser: 'webkit', name: 'webkit' },
                        ],
                    },
                },
            },
        ],
    },
});
