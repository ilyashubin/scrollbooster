import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vitest/config';
import { mouse } from './test/commands/mouse';

export default defineConfig({
    test: {
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
                    include: ['test/**/*.test.js'],
                    setupFiles: ['test/setup.js'],
                    browser: {
                        enabled: true,
                        provider: playwright(),
                        headless: true,
                        commands: { mouse },
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
