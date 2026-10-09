# scrollbooster

## 4.0.0

### Major Changes

- 615cc90: ScrollBooster 4.0, see [MIGRATION.md](https://github.com/ilyashubin/scrollbooster/blob/master/MIGRATION.md) for
  all behavior changes.
  
  - ESM and `<script>` builds with TypeScript types, no CommonJS build, the class is a named export only. ES2022
    build for Chrome 104+, Firefox 90+, Safari 15+, IE11 is not supported anymore.
  - Input on Pointer Events and CSS `touch-action`: only the main mouse button drags, extra fingers are ignored,
    `pointercancel` is handled, page scroll outside the viewport is never blocked, no listeners on `window` outside
    of a drag.
  - Physics does not depend on the refresh rate: on 120 Hz screens inertia and bounce match 60 Hz. Motion ends exactly
    at `scrollTo()` targets and edges.
  - New `reducedMotion` option, `prefers-reduced-motion` is respected by default.
  - Size changes are tracked with `ResizeObserver` (without it, as in jsdom, `updateMetrics()` is enough),
    `updateOptions()` accepts new `viewport` and `content`, `destroy()` stops animation, removes all listeners and the
    translation from content.
  - An already scrolled viewport keeps its position on init, focused elements stay visible in `transform` mode.
  - `scrollMode` defaults to `'transform'`, `'none'` leaves rendering to `onUpdate`. `'transform'` mode renders with
    the CSS `translate` property and keeps the content's own `transform`.
  - Invalid options throw `TypeError`. `shouldScroll` is renamed to `shouldDrag`. `preventPointerMoveDefault` and
    `lockScrollOnDragDirection` are removed, `touch-action` follows `direction`. `pointerDownPreventDefault` is
    removed: a press moves focus as usual, selection and native drag are prevented only while dragging.
  - `onUpdate` is called only on animation frames, `onPointerDown` only for a press that starts dragging.
  - `scrollTo()` and `setPosition()` keep a coordinate that is not passed and stay within edges, `scrollTo()` does
    not interrupt a drag.
  - `getState().isDragging` means a drag past the click threshold, `dragOffset` resets on release, state objects are
    copies. The click that ends a drag, mouse or touch, does not reach handlers of content elements.
    `updateOptions({ scrollMode })` removes the rendering of the previous mode.
  - `textSelection` keeps presses on text for selection only for mouse and pen: touch drags from text and selects
    it with a long press. Text with `user-select: none` drags. A mouse press that drags drops the selection.
  - `wheel` option, on by default, replaces `emulateScroll` and `preventDefaultOnEmulateScroll`: content takes a
    wheel gesture only when it can move along its main axis, otherwise the page scrolls. Content moves exactly by
    the delta, events within a frame add up, lines and pages are converted. Trackpad pinch and Ctrl+wheel zoom the
    page. `dragDirectionTolerance` is removed. `wheel: 'horizontal'` scrolls a horizontal strip with a mouse wheel.
  - New `keyboard` option, on by default: arrows, page keys, Space, Home and End scroll content with focus inside.
  - New `axisLock` option keeps a gesture on the axis it starts along. New `snap` option for carousels and paging,
    new `scrollBy()` and `scrollIntoView()` methods.
  - Nested instances share a gesture: it goes to the innermost one that can move along its main axis.
  - The root element can be the viewport to drag the whole page. In `'native'` mode scroll by the browser at rest is
    reported with `onUpdate`.
  - Public API is the constructor and eight methods, internal fields and methods are private. `getState()` reports
    `viewport` and `content` sizes and `maxPosition`.
  - Right-to-left viewport: `position.x` is the distance from the start edge on the right, from 0 to `maxPosition.x`.
