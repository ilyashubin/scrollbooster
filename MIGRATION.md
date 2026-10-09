# Migrating from 3.x to 4.0

4.0 keeps the options, methods and `onUpdate` state of 3.x. Most apps only need to check the
[browser support](#browser-support), the [input changes](#input-pointer-events) and
[`scrollTo()` with one coordinate](#methods-and-state). Everything below is a list of behavior changes, each with
what to do if it affects you.

## Browser support

4.0 targets browsers released since 2021: Chrome and Edge 90+, Firefox 86+, Safari and iOS Safari 15+. IE11 and
old Edge are not supported anymore, the build is ES2020 without polyfills. If you need IE11, stay on 3.x.

## Package

- The package ships ESM (`dist/index.js`), CommonJS (`dist/index.cjs`) and a minified `<script>` build
  (`dist/scrollbooster.min.js`, global `ScrollBooster`) through the `exports` map. `import ScrollBooster from
  'scrollbooster'`, `require('scrollbooster')` and the `<script>` tag work as before.
- ESM also has a named export: `import { ScrollBooster } from 'scrollbooster'`.
- TypeScript types are included: `ScrollBoosterOptions`, `ScrollBoosterState` and others. Remove
  `@types/scrollbooster` or local declarations if you have them.
- Source files are not published anymore. Deep imports like `scrollbooster/src/index.js` fail, import
  `scrollbooster` instead. `scrollbooster/dist/scrollbooster.min.js` still works.
- Pin the major version in CDN links: `https://unpkg.com/scrollbooster@4/dist/scrollbooster.min.js`.

## Input: Pointer Events

Mouse and touch listeners are replaced with Pointer Events.

- `onPointerDown`, `onPointerMove`, `onPointerUp` and `shouldScroll` receive a `PointerEvent` instead of
  `MouseEvent` or `TouchEvent`. `event.touches` is gone: read `clientX`, `pageX` and others from the event itself.
  `isTouch` is `true` for `event.pointerType === 'touch'`, pen counts as mouse like in 3.x.
- `onPointerMove` is called only while dragging. In 3.x it was called on every mouse move over the page.
- `onPointerUp` is called only for the pointer that started the drag, also when the browser cancels it
  (`pointercancel`, `event.type` tells which). In 3.x it was called on every `mouseup` and `touchend` on the page.
- Only the main mouse button drags. Middle and side buttons are ignored, in 3.x only the right button was.
- One pointer drags at a time: a second finger on the same viewport is ignored and lifting it does not end the drag.
  If the browser never delivers `pointerup` of the dragging finger (the element was removed, capture was lost), the
  next touch starts a new drag, `onPointerUp` is not called for the lost one.
- After a mouse drag `click` goes to the viewport and is prevented as before, so `click` handlers on elements
  inside the content do not run anymore after a drag. A click without movement reaches them as usual.
- `pointerDownPreventDefault` still prevents `mousedown` (text selection, native drag of images and links), other
  `mousedown` listeners on the page keep working.

### Native touch gestures

ScrollBooster sets CSS `touch-action` on the viewport instead of calling `preventDefault()` on `touchmove`:

| `direction` or `lockScrollOnDragDirection` | `touch-action`     | Native gestures left to the browser |
| ------------------------------------------ | ------------------ | ----------------------------------- |
| `'all'` (default)                          | `pinch-zoom`       | Pinch zoom                          |
| `'horizontal'`                             | `pan-y pinch-zoom` | Vertical page scroll, pinch zoom    |
| `'vertical'`                               | `pan-x pinch-zoom` | Horizontal page scroll, pinch zoom  |
| `lockScrollOnDragDirection: 'all'`         | `none`             | None                                |

`lockScrollOnDragDirection` takes precedence over `direction`. With `pointerMode: 'mouse'` the style is not set.
The previous inline value is restored by `destroy()`.

- With `direction: 'all'` touching the viewport does not scroll the page anymore. In 3.x the page scrolled and
  the content barely moved. If you need the page to scroll, use `direction: 'horizontal'` or `'vertical'`.
- `lockScrollOnDragDirection: 'all'` blocks native gestures only on the viewport, not on the whole page.
- To use your own `touch-action`, set it in CSS with `!important` or use `pointerMode: 'mouse'`.
- `preventPointerMoveDefault` is deprecated and does nothing.

### Wheel

Without `emulateScroll` there is no `wheel` listener on the viewport. With it the listener is passive unless
`preventDefaultOnEmulateScroll` is set too, so the page can scroll without waiting for JavaScript.

## Methods and state

- `scrollTo()` and `setPosition()` keep a coordinate that is not passed: `scrollTo({ x: 100 })` scrolls
  horizontally and leaves the vertical position as is. In 3.x a missing coordinate meant 0, pass it explicitly to
  keep that: `scrollTo({ x: 100, y: 0 })`. During a running `scrollTo()` the missing coordinate keeps its target.
- `scrollTo()` does nothing while the user drags content. In 3.x it took the content from under the pointer and
  ignored the pointer until release.
- `getState().isDragging` is `true` only while the pointer is pressed and has moved. In 3.x it stayed `true` after
  release until the next press. `dragOffset` still keeps the offset of the last drag until the next `pointerdown`,
  so `onClick` can read it.
- `getState()` and `onUpdate` get new objects every time: a saved state does not change with later motion, and
  changing it does not affect the instance. In 3.x `dragOffset` was the internal object.
- `updateOptions({ scrollMode })` removes the rendering of the previous mode: leaving `'transform'` removes the
  transform from content, switching to `'transform'` moves native scroll into the transform. In 3.x the offsets of
  both modes added up. A new `content` in `'transform'` mode leaves the previous content without transform.

## Options

Unknown options and invalid values log a `console.warn`, for example `scrollMethod` instead of `scrollMode`,
`direction: 'diagonal'` or `friction: 0`. The options are applied as before, fix them to remove the warning.
`friction` and `bounceForce` must be numbers between 0 and 1 exclusive. `preventPointerMoveDefault` warns as
deprecated.

## Physics

- Motion is the same on any refresh rate. In 3.x physics ran per frame, so on 120 Hz screens inertia and bounce
  were twice as fast and short. `friction` and `bounceForce` keep their meaning at 60 Hz, where motion matches 3.x.
  On 120 Hz screens inertia now travels twice as far as in 3.x.
- Motion ends exactly at the `scrollTo()` target and at the edges. 3.x stopped a fraction of a pixel short.
- Starting a drag, wheel scrolling and `setPosition()` cancel a running `scrollTo()`. In 3.x dragging did not work
  until `scrollTo()` finished.
- `scrollTo()` along a direction disabled by `direction` does not keep the animation running forever.
- `getState().position` never reports `-0`.
- Internal methods `applyForce`, `applyEdgeForce`, `applyDragForce`, `applyScrollForce` and `applyTargetForce`
  are removed. `updateScrollPosition()` and `animate()` take frame count and rAF timestamp.

## Reduced motion

New option `reducedMotion` defaults to `'auto'`: when the user has `prefers-reduced-motion: reduce`, content stops
right after release without inertia, does not bounce beyond edges, and `scrollTo()` jumps to the target. Dragging
follows the pointer as usual. Set `reducedMotion: 'never'` to keep the 3.x behavior, `'always'` to force it.

## Lifecycle

- Invalid options (no `viewport`, no content) log an error as before, but the constructor does not throw a
  `TypeError` anymore. Methods of such an instance do nothing.
- A viewport that is already scrolled keeps its scroll position on init. 3.x reset it to 0.
- Size changes of the viewport and content are tracked with `ResizeObserver`. The window `resize` listener is gone,
  call `updateMetrics()` only for changes that do not resize viewport or content.
- `updateOptions({ viewport })` or `updateOptions({ content })` moves listeners to the new elements and measures
  them. A new viewport without `content` uses its first child.
- `destroy()` stops the running animation and timers, removes all listeners including the `load` listener on
  content that 3.x left behind, and turns further method calls into no-ops. Calling it twice is safe.

## Transform mode and focus

With `scrollMode: 'transform'` focusing an element outside the visible area (Tab, `focus()`) scrolls the content
to show it. In 3.x native focus scroll and the transform added up and moved the element out of view. Native scroll
of the viewport (find in page, anchor links) is moved into the transform as well.
