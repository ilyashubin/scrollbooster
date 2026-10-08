# Contributing

Contributions are welcome!

1. Fork this repository and clone it
2. Use Node.js version from `.nvmrc` and run `corepack enable` once to get the pnpm version pinned in `package.json`
3. Run `pnpm install` to install all dependencies
4. Make your changes in `src`. Build output in `dist` is not committed
5. Run `pnpm exec playwright install chromium firefox webkit` once, then `pnpm test` to run unit tests in Node
   (project `unit`) and browser tests in all three browsers (projects `chromium`, `firefox`, `webkit`).
   Use `pnpm test --project unit --project chromium` to run a subset and `pnpm test:watch` while developing.
   Run `pnpm lint` and `pnpm typecheck` before committing
6. Quick way to try changes manually is to run `pnpm start` and check the demo in your browser
7. Run `pnpm build` to build the package
8. Commit your changes and make PR

Source is TypeScript in `src/`: `index.ts` is the ESM entry, `default.ts` is the entry for CommonJS and the
`<script>` build. Pure physics lives in `src/physics.ts` and is covered by unit tests in `test/unit/`.

Browser tests live in `test/` and run in real browsers with Vitest browser mode. `requestAnimationFrame` is replaced with a manual
clock (`tick()` in `test/helpers.js`), so physics advances frame by frame and trajectories are deterministic.
Pointer helpers dispatch synthetic `PointerEvent`s in browser order. Browser default actions, pointer capture and
click targets need real input, these tests in `test/real-input.test.js` drive Playwright mouse through the `mouse`
command from `test/commands/mouse.ts`.
Known bugs are kept in `test/known-bugs.test.js` as `it.fails`: when a fix makes such a test fail, switch it to `it`
and move it next to related tests.
