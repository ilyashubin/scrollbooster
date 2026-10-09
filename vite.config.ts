import { defineConfig } from 'vite';
import { PAGES } from './demo/shared/pages.ts';

// Demo pages import `src/` directly: no library build while developing
export default defineConfig({
    root: 'demo',
    // Relative asset paths, so the built demo works from any directory of a static host
    base: './',
    server: { host: true, open: true },
    // Dependency scan of the dev server would resolve build input from `root`, its own globs are relative to `root`
    optimizeDeps: { entries: ['*.html'] },
    build: {
        outDir: '../dist-demo',
        emptyOutDir: true,
        rolldownOptions: {
            // Resolved from the working directory
            input: PAGES.map((page) => `demo/${page.file}`),
        },
    },
});
