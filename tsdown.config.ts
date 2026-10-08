import { defineConfig } from 'tsdown';

const shared = {
    target: 'es2020',
    platform: 'browser',
    sourcemap: true,
} as const;

export default defineConfig([
    // ESM for bundlers and Node: named and default export, types
    {
        ...shared,
        entry: { index: 'src/index.ts' },
        format: 'esm',
        dts: true,
    },
    // CommonJS: module.exports = ScrollBooster, types with export =
    {
        ...shared,
        entry: { index: 'src/default.ts' },
        format: 'cjs',
        dts: true,
    },
    // Minified global build for <script> tags (unpkg, jsdelivr)
    {
        ...shared,
        entry: 'src/default.ts',
        format: 'iife',
        globalName: 'ScrollBooster',
        minify: true,
        outputOptions: {
            entryFileNames: 'scrollbooster.min.js',
        },
    },
]);
