# Agent guide

ScrollBooster is a drag-to-scroll library without dependencies: TypeScript in `src/`, ESM and `<script>` builds.
[CONTRIBUTING.md](CONTRIBUTING.md) describes the setup, the module layout, the tests, the demo and the release. Read
it first, this file adds only what is easy to get wrong.

## Commands

- `pnpm check` must pass before every commit: lint, typecheck, all tests in Node, Chromium, Firefox and WebKit,
  build and package checks.
- `pnpm lint:fix` applies Biome formatting. Code edited by scripts often needs it.
- Run a subset while working: `pnpm test test/wheel.test.ts --project chromium`, `-t <name>` filters tests.
- Node version is in `.nvmrc`, pnpm comes from `packageManager` through corepack. Do not use npm or yarn.

## Behavior changes

- Version 4.0 is a new major. Choose the behavior that is most correct, not the one closest to 3.x: breaking
  changes are fine. Do not justify code by "as in 3.x" in comments or commits.
- Every change users can notice goes to [MIGRATION.md](MIGRATION.md) (what changed, what to do), to the changeset
  in `.changeset/` and, for public options or methods, to [README.md](README.md) and the JSDoc in `src/types.ts`.
- A new option needs a default in `DEFAULTS` and a check in `CHECKS` in `src/options.ts`: `CHECKS` is keyed by all
  options, so a missing check does not compile. The demo sandbox `demo/index.ts` gets a control for it.
- Browser support is Chrome and Edge 104+, Firefox 90+, Safari and iOS Safari 15+. Check a new DOM or CSS feature
  in MDN browser-compat-data before using it, raising the floor is a documented breaking change.
- `.size-limit.json` holds the gzip budget. Raise it only for new features, and say why in the commit message.

## Tests

- Every fix or feature comes with tests. Check that a new test fails when the change is reverted: a test that
  passes on the old code proves nothing.
- Browser tests replace `requestAnimationFrame` with a manual clock (`test/setup.ts`). Advance frames with `tick()`.
  Awaiting a real animation frame hangs until the test times out. `nextRender()` waits for a real rendering update,
  where `ResizeObserver` and `scroll` events arrive.
- The wheel gesture ends after an 80 ms timeout, use `vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })`.
- Trajectory snapshots in `test/__snapshots__/` pin the physics. Update them with `-u` only when motion is meant to
  change, and check that the diff touches only the expected tests.
- Synthetic `PointerEvent`s do not trigger browser default actions, capture or `touch-action`. Such behavior
  belongs in `test/real-input.test.ts` (Playwright mouse) or `test/real-touch.test.ts` (CDP touch, Chromium only).
- To measure something in a real browser, write a throwaway `test/*.test.ts` that reports values through a failing
  `expect`, then delete it. `console.log` from browser tests is not shown reliably.
- jsdom has no `ResizeObserver` and no `Element.scrollTo()`. `test/unit/jsdom.test.ts` keeps creation, updates
  and destruction working there.

## Code

- Comments explain why, not what. Many lines in `src/` exist because of a specific browser quirk; keep the comment
  next to the workaround and name the browser.
- Internal coordinates in `motion.ts` are content offsets (the public position with the opposite sign). `mirrorX()`
  converts the x axis for right-to-left viewports, `getState()` returns public coordinates.
- `input.ts`, `wheel.ts` and `keyboard.ts` do not import the class: they get options and callbacks through a host
  object. `motion.ts` and `physics.ts` have no DOM and are unit tested in Node.
- Physics constants are per 60 Hz frame. Frame counts can be fractional, motion must not depend on refresh rate.
- `dist/`, `dist-demo/`, `coverage/` and `.vitest/` are build output and are not committed.

## Browser quirks that the code relies on

- Safari on iOS ignores `touch-action` for touches that start on a link and pans the page, so a touch press adds a
  non-passive `touchmove` listener for its duration and prevents moves along the drag.
- After a long press on a link Safari on iOS sends a mouse `pointerdown` with `buttons` 0 that is never released,
  so a press without the main button does not drag.
- Firefox and WebKit compute `user-select: auto` for descendants of `user-select: none`, ancestors are walked.
- A prevented `selectstart` keeps an existing selection in Chromium and WebKit, a dragging press clears it.
- Assigning `scrollLeft` follows CSS `scroll-behavior: smooth`, so native scroll uses
  `scrollTo({ behavior: 'instant' })`.
- Content in `'transform'` mode moves with the `translate` property and `will-change: translate`. Without its own
  layer Chromium repaints the content every frame.

## Demo and landing

`demo/index.html` is the public landing page. Its code samples are the sources of `demo/landing/examples/*.js`:
a change of an option name or behavior must keep them working and correct, check the page with `pnpm dev`. The
package has `sideEffects: false`, so `vite.config.ts` marks demo modules as having side effects, otherwise the build
drops modules that are imported only to run.

## Trying changes on devices

`pnpm dev` serves the demo on the local network. Add `?events` to a page address to log raw input events on a phone,
Send stores the log in the dev server, read it with `curl localhost:5173/__events` (use the port `pnpm dev` printed).
How scrolling feels, especially on iOS and on 120 Hz screens, is not covered by tests: ask for a device check.

## Commits

One finished change per commit, `pnpm check` green. The subject says what changed and, for a fix, the cause, in
the style of `git log`, for example "Scroll the viewport instantly, scroll-behavior: smooth animated every frame of
native mode". Do not push unless asked.
