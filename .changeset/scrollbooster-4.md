---
"scrollbooster": major
---

ScrollBooster 4.0, see [MIGRATION.md](https://github.com/ilyashubin/scrollbooster/blob/master/MIGRATION.md) for
all behavior changes.

- ESM, CommonJS and `<script>` builds with TypeScript types. ES2020 build for Chrome 90+, Firefox 86+, Safari 15+,
  IE11 is not supported anymore.
- Input on Pointer Events and CSS `touch-action`: only the main mouse button drags, extra fingers are ignored,
  `pointercancel` is handled, page scroll outside the viewport is never blocked, no listeners on `window` outside
  of a drag.
- Physics does not depend on the refresh rate: on 120 Hz screens inertia and bounce match 60 Hz. Motion ends exactly
  at `scrollTo()` targets and edges.
- New `reducedMotion` option, `prefers-reduced-motion` is respected by default.
- Size changes are tracked with `ResizeObserver`, `updateOptions()` accepts new `viewport` and `content`,
  `destroy()` stops animation and removes all listeners.
- An already scrolled viewport keeps its position on init, focused elements stay visible in `transform` mode.
- `scrollTo()` and `setPosition()` keep a coordinate that is not passed, `scrollTo()` does not interrupt a drag.
- `getState().isDragging` is `false` after release, state objects are copies. `updateOptions({ scrollMode })`
  removes the rendering of the previous mode.
- Unknown options and invalid values log a warning.
