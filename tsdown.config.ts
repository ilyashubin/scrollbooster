import { defineConfig } from 'tsdown';

const shared = {
    entry: 'src/index.js',
    target: 'es2020',
    platform: 'browser',
    sourcemap: true,
} as const;

export default defineConfig([
    // ESM + CJS for bundlers and Node
    {
        ...shared,
        format: ['esm', 'cjs'],
    },
    // Minified global build for <script> tags (unpkg, jsdelivr)
    {
        ...shared,
        format: 'iife',
        globalName: 'ScrollBooster',
        minify: true,
        outputOptions: {
            entryFileNames: 'scrollbooster.min.js',
        },
    },
]);
