import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        include: ['test/**/*.test.js'],
        setupFiles: ['test/setup.js'],
        browser: {
            enabled: true,
            provider: playwright(),
            headless: true,
            // Each instance is a project, run a subset with `--project chromium`
            instances: [{ browser: 'chromium' }, { browser: 'firefox' }, { browser: 'webkit' }],
        },
    },
});
