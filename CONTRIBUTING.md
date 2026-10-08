# Contributing

Contributions are welcome!

1. Fork this repository and clone it
2. Use Node.js version from `.nvmrc` and run `corepack enable` once to get the pnpm version pinned in `package.json`
3. Run `pnpm install` to install all dependencies
4. Make your changes in `src`. Build output in `dist` is not committed
5. Run `pnpm exec playwright install chromium firefox webkit` once, then `pnpm test` to run tests in all three browsers.
   Use `pnpm test --project chromium` to run a single browser and `pnpm test:watch` while developing
6. Quick way to try changes manually is to run `pnpm start` and check the demo in your browser
7. Run `pnpm build` to build the package
8. Commit your changes and make PR

Tests live in `test/` and run in real browsers with Vitest browser mode. `requestAnimationFrame` is replaced with a manual
clock (`tick()` in `test/helpers.js`), so physics advances frame by frame and trajectories are deterministic.
Known bugs are kept in `test/known-bugs.test.js` as `it.fails`: when a fix makes such a test fail, switch it to `it`
and move it next to related tests.
