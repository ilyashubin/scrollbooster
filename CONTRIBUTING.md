# Contributing

Contributions are welcome!

1. Fork this repository and clone it
2. Use Node.js version from `.nvmrc` and run `corepack enable` once to get the pnpm version pinned in `package.json`
3. Run `pnpm install` to install all dependencies
4. Make your changes in `src`. Build output in `dist` is not committed
5. Run `pnpm exec playwright install chromium firefox webkit` once, then `pnpm test` to run unit tests in Node
   (project `unit`) and browser tests in all three browsers (projects `chromium`, `firefox`, `webkit`).
   Use `pnpm test --project unit --project chromium` to run a subset and `pnpm test:watch` while developing
6. Quick way to try changes manually is to run `pnpm start` and check the demo in your browser
7. Run `pnpm check` before committing: lint, typecheck, all tests, build and package checks in one command
8. If the change affects users, run `pnpm changeset`, pick the bump type and describe the change. It adds a file
   to `.changeset/` that goes to the changelog on release
9. Commit your changes and make PR

Source is TypeScript in `src/`: `index.ts` is the ESM entry, `default.ts` is the entry for CommonJS and the
`<script>` build. Pure physics lives in `src/physics.ts` and is covered by unit tests in `test/unit/`.

Browser tests live in `test/` and run in real browsers with Vitest browser mode. `requestAnimationFrame` is replaced with a manual
clock (`tick()` in `test/helpers.js`), so physics advances frame by frame and trajectories are deterministic.
Pointer helpers dispatch synthetic `PointerEvent`s in browser order. Browser default actions, pointer capture and
click targets need real input, these tests in `test/real-input.test.js` drive Playwright mouse through the `mouse`
command. Browser commands live in `test/commands/`, `emulateReducedMotion` switches `prefers-reduced-motion`.
Physics is defined per 60 Hz frame; `tick(frames, frameDuration)` with another duration checks other refresh rates.
Known bugs are kept in `test/known-bugs.test.js` as `it.fails`: when a fix makes such a test fail, switch it to `it`
and move it next to related tests.

## Checks

Command | What it does
------- | ------------
`pnpm lint` | Biome linter and formatter check, `pnpm lint:fix` applies fixes. The only check that runs in CI
`pnpm typecheck` | TypeScript for `src` (`tsconfig.json`) and for TypeScript tests and configs (`tsconfig.test.json`)
`pnpm test` | Unit tests in Node and browser tests in Chromium, Firefox and WebKit
`pnpm test:coverage` | Unit and Chromium tests with V8 coverage of `src`, HTML report in `coverage/`. V8 coverage works in Chromium only
`pnpm build` | ESM, CommonJS and `<script>` builds with types in `dist`
`pnpm check:package` | Checks the built package: `publint` for `package.json`, `@arethetypeswrong/cli` for types of every entry point, `size-limit` for the gzip size budget in `.size-limit.json`. Run `pnpm build` first
`pnpm check` | All of the above except coverage, in this order

Debugging tests:

- `pnpm test:watch --project chromium --browser.headless=false` opens the browser with the test page, rerun a
  single file with `pnpm test:watch test/drag.test.js`.
- Trajectory snapshots in `test/__snapshots__/` pin the physics. A change that is not meant to change motion must
  not update them. When a change is meant to, update with `pnpm test -u` and review the snapshot diff.

devDependencies are pinned to exact versions, `pnpm outdated` shows what is behind.

## Release

Releases are made locally, CI only runs the linter.

1. Run `pnpm install` and `pnpm check` on a clean `master`
2. Run `pnpm changeset version`: it bumps the version in `package.json` and writes `CHANGELOG.md` from the files in
   `.changeset/`. Review and commit the result
3. Run `pnpm changeset publish`: it builds the package (`prepublishOnly`), publishes it to npm (asks for the 2FA code)
   and creates a git tag
4. Push the commit and the tag: `git push --follow-tags`

While `.changeset/pre.json` exists the repository is in prerelease mode: versions get the `beta` suffix
(`4.0.0-beta.0`, `4.0.0-beta.1`) and are published under the `beta` dist-tag, so `npm i scrollbooster` still installs
3.x. Run `pnpm changeset pre exit` before the stable release.
