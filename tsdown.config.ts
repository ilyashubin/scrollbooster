import { defineConfig } from 'tsdown';

const shared = {
    target: 'es2020',
    platform: 'browser',
    sourcemap: true,
} as const;

export default defineConfig([
    // ESM for bundlers and Node, `require()` loads it too in Node 20.19+ and 22.12+
    {
        ...shared,
        entry: { index: 'src/index.ts' },
        format: 'esm',
        dts: true,
    },
    // Minified global build for <script> tags (unpkg, jsdelivr)
    {
        ...shared,
        entry: 'src/global.ts',
        format: 'iife',
        globalName: 'ScrollBooster',
        minify: true,
        outputOptions: {
            entryFileNames: 'scrollbooster.min.js',
        },
    },
]);
