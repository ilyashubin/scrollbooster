# Migrating from 3.x to 4.0

4.0 keeps the option names, methods and the shape of the `onUpdate` state of 3.x, but fixes their behavior where
3.x was wrong, without keeping old quirks. Check at least [options](#options) (invalid options throw now),
[input](#input-pointer-events), [methods and state](#methods-and-state) and [`onUpdate` timing](#onupdate-timing).
Everything below is a list of behavior changes, each with what to do if it affects you.

## Browser support

4.0 targets browsers released since 2021: Chrome and Edge 90+, Firefox 86+, Safari and iOS Safari 15+. IE11 and
old Edge are not supported anymore, the build is ES2020 without polyfills. If you need IE11, stay on 3.x.

## Package

- The package is ESM (`dist/index.js`) with a minified `<script>` build (`dist/scrollbooster.min.js`, global
  `ScrollBooster` as before). There is no CommonJS build: `require('scrollbooster')` loads the ESM build in Node
  20.19+ and 22.12+ and in bundlers.
- The class is a named export only, in every form of import:
  `import { ScrollBooster } from 'scrollbooster'`, `const { ScrollBooster } = require('scrollbooster')`.
  `import ScrollBooster from 'scrollbooster'` and `const ScrollBooster = require('scrollbooster')` do not work.
- TypeScript types are included: `ScrollBoosterOptions`, `ScrollBoosterState` and others. Remove
  `@types/scrollbooster` or local declarations if you have them.
- Source files are not published anymore. Deep imports like `scrollbooster/src/index.js` fail, import
  `scrollbooster` instead. `scrollbooster/dist/scrollbooster.min.js` still works.
- Pin the major version in CDN links: `https://unpkg.com/scrollbooster@4/dist/scrollbooster.min.js`.

## Input: Pointer Events

Mouse and touch listeners are replaced with Pointer Events.

- `onPointerDown`, `onPointerMove`, `onPointerUp` and `shouldScroll` receive a `PointerEvent` instead of
  `MouseEvent` or `TouchEvent`. `event.touches` is gone: read `clientX`, `pageX` and others from the event itself.
  Callbacks get `(state, event)`, the third argument `isTouch` is removed: check `event.pointerType === 'touch'`,
  it also tells pen from mouse. In `onClick` use `'pointerType' in event && event.pointerType === 'touch'`, older
  browsers may send `click` as a `MouseEvent` without `pointerType`.
- `onPointerMove` is called only while dragging. In 3.x it was called on every mouse move over the page.
- `onPointerDown` and `onPointerUp` come in pairs for a press that starts dragging. `onPointerDown` is not called
  anymore for presses that do not drag: other mouse buttons, scrollbars, form inputs with `inputsFocus`, presses
  rejected by `shouldScroll` or `pointerMode`. `shouldScroll` is called before `onPointerDown`.
- `onPointerUp` is called only for the pointer that started the drag, also when the browser cancels it
  (`pointercancel`, `event.type` tells which). In 3.x it was called on every `mouseup` and `touchend` on the page.
- Only the main mouse button drags. Middle and side buttons are ignored, in 3.x only the right button was.
- One pointer drags at a time: a second finger on the same viewport is ignored and lifting it does not end the drag.
  If the browser never delivers `pointerup` of the dragging finger (the element was removed, capture was lost), the
  next touch starts a new drag, `onPointerUp` is not called for the lost one.
- After a mouse drag `click` goes to the viewport and is prevented, so `click` handlers on elements inside the
  content do not run after a drag. A click without movement reaches them as usual. Only the first click after the
  drag is prevented. In `onClick` use `event.defaultPrevented` to tell a click after drag from a plain click.
- `pointerDownPreventDefault` is removed, passing it throws. `mousedown` is not prevented anymore, so a press inside
  the viewport moves focus like a click anywhere else: an input outside loses focus, a focusable element inside gets
  it. Text selection and native drag of images and links are prevented with `selectstart` and `dragstart` while
  the pointer drags. Focus by the press that drags content does not scroll it in `'transform'` mode.

### Native touch gestures

ScrollBooster sets CSS `touch-action` on the viewport instead of calling `preventDefault()` on `touchmove`:

| `direction`     | `touch-action`     | Native gestures left to the browser |
| --------------- | ------------------ | ----------------------------------- |
| `'all'`         | `pinch-zoom`       | Pinch zoom                          |
| `'horizontal'`  | `pan-y pinch-zoom` | Vertical page scroll, pinch zoom    |
| `'vertical'`    | `pan-x pinch-zoom` | Horizontal page scroll, pinch zoom  |

With `pointerMode: 'mouse'` the style is not set. The previous inline value is restored by `destroy()`.

- With `direction: 'all'` touching the viewport does not scroll the page anymore. In 3.x the page scrolled and
  the content barely moved. If you need the page to scroll, use `direction: 'horizontal'` or `'vertical'`.
- `lockScrollOnDragDirection` is removed, passing it throws. Its main use, a horizontal gallery that lets vertical
  swipes scroll the page, is now `direction: 'horizontal'` alone. Touch drag in a direction disabled by `direction`
  goes to the browser. For `'all'` (no native gestures at all) set `touch-action: none !important` on the viewport
  in CSS.
- To use your own `touch-action`, set it in CSS with `!important` or use `pointerMode: 'mouse'`.
- `preventPointerMoveDefault` is removed, passing it throws. Native touch scrolling is controlled with
  `touch-action`.

### Wheel

`emulateScroll` and `preventDefaultOnEmulateScroll` are replaced with `wheel`, enabled by default: mouse wheel and
trackpad scroll the content like a native scroll container. Passing the old options throws.

- A wheel event scrolls the content and is prevented only when the content can move along the main axis of the
  event. Otherwise it goes to the page: at the edge, or across `direction`, so vertical wheel over a horizontal
  gallery scrolls the page. 3.x either never prevented the page scroll or prevented every event in one direction,
  also at the edges.
- A gesture that started on the content stays with it until it ends (no events for 80 ms), so the page does not
  jump or navigate back when the content reaches its edge in the middle of a swipe.
- A scroller nested in the content takes the event first, the outer one moves only when the inner one cannot.
- Wheel is ignored while the pointer drags content.
- `onWheel` is called only for events that scroll the content.
- Content moves exactly by the wheel delta. 3.x moved it by 95% of the delta, took only the last event of a frame,
  and treated deltas in lines and pages as pixels (Firefox mouse wheels report lines, so content moved by 3 px per
  notch). Now all events of a frame add up, lines are 16 px and a page is the viewport size.
- With `wheel: false` there is no `wheel` listener on the viewport. With `scrollMode: 'native'` and a viewport
  with `overflow: auto` this leaves wheel scrolling to the browser.

`dragDirectionTolerance` is removed with `preventDefaultOnEmulateScroll` and `lockScrollOnDragDirection`, the
only options that used it.

## Methods and state

- The public API is the constructor, `updateOptions()`, `updateMetrics()`, `scrollTo()`, `setPosition()`,
  `getState()` and `destroy()`. Everything else is private in TypeScript types and may change in any release:
  fields like `props`, `position`, `isDragging`, `viewport`, `content`, `edgeX`, `edgeY`, and methods like
  `isMoving()`, `getDragAngle()`, `getDragDirection()`, `startAnimationLoop()`, `animate()`,
  `updateScrollPosition()`, `setContentPosition()`, `handleEvents()`. The `apply*Force` methods are gone. Read
  `getState()` instead:

  | 3.x                                     | 4.0                                  |
  | --------------------------------------- | ------------------------------------ |
  | `sb.isMoving()`                         | `sb.getState().isMoving`             |
  | `sb.viewport`, `sb.content` (sizes)     | `sb.getState().viewport`, `.content` |
  | `sb.edgeX.from`, `sb.edgeY.from`        | `-sb.getState().maxPosition.x`, `.y` |
  | `sb.position` (negative offsets)        | `sb.getState().position`             |
  | `sb.props.viewport`, `sb.props.content` | keep your own references             |

- `getState()` and `onUpdate` have new fields: `viewport` and `content` sizes and `maxPosition`, the largest
  `position` on each axis.
- `scrollTo()` and `setPosition()` keep a coordinate that is not passed: `scrollTo({ x: 100 })` scrolls
  horizontally and leaves the vertical position as is. In 3.x a missing coordinate meant 0, pass it explicitly to
  keep that: `scrollTo({ x: 100, y: 0 })`. During a running `scrollTo()` the missing coordinate keeps its target.
- `scrollTo()` and `setPosition()` keep the position within edges: `scrollTo({ y: 99999 })` stops at the end. In
  3.x the target was not limited and content could stay beyond the edge, or bounce back after `setPosition()`.
- `scrollTo()` does nothing while the user drags content. In 3.x it took the content from under the pointer and
  ignored the pointer until release.
- `getState().isDragging` is `true` only while the pointer is pressed and has moved more than 5 px along allowed
  directions, the same threshold that tells a drag from a click. In 3.x it turned `true` on any movement and stayed
  `true` after release until the next press.
- `dragOffset` and `dragAngle` describe the current press and return to 0 on release. `onPointerUp` gets the values
  of the press that ended. In 3.x they kept the last drag until the next press, `onClick` saw them.
- `getState()` and `onUpdate` get new objects every time: a saved state does not change with later motion, and
  changing it does not affect the instance. In 3.x `dragOffset` was the internal object.
- `updateOptions({ scrollMode })` removes the rendering of the previous mode: leaving `'transform'` removes the
  transform from content, switching to `'transform'` moves native scroll into the transform. In 3.x the offsets of
  both modes added up. A new `content` in `'transform'` mode leaves the previous content without transform.

## Scroll mode

`scrollMode` defaults to `'transform'`: `new ScrollBooster({ viewport })` scrolls the content right away. In 3.x
nothing was rendered without `scrollMode`. If you render the scroll yourself in `onUpdate`, pass
`scrollMode: 'none'`, `undefined` is not a valid value anymore.

## `onUpdate` timing

`onUpdate` is called only on animation frames, right before the browser paints. The constructor,
`updateOptions()` and `updateMetrics()` do not call it synchronously anymore: the first call comes on the first
frame after `new ScrollBooster()`, so `onUpdate` can use the instance variable. The frame is always before the
first paint, nothing flickers. Read `getState()` if you need the state right away.

## Options

The constructor and `updateOptions()` throw `TypeError` for invalid options, before anything is applied:

- unknown option, for example `scrollMethod` instead of `scrollMode` or the removed `preventPointerMoveDefault`;
- a value of the wrong type or outside the allowed set, for example `direction: 'diagonal'`, `bounce: 'yes'`,
  `onUpdate: null`, explicit `undefined`;
- `friction` or `bounceForce` not between 0 and 1 exclusive;
- `viewport` that is not an `HTMLElement`, a viewport without child element and no `content`, `content` that is not
  inside `viewport`.

3.x logged an error and returned a broken instance or threw a `TypeError` from the middle of the constructor. If
options come from user input, catch the error.

## Physics

- Motion is the same on any refresh rate. In 3.x physics ran per frame, so on 120 Hz screens inertia and bounce
  were twice as fast and short. `friction` and `bounceForce` keep their meaning at 60 Hz, where motion matches 3.x.
  On 120 Hz screens inertia now travels twice as far as in 3.x.
- Motion ends exactly at the `scrollTo()` target and at the edges. 3.x stopped a fraction of a pixel short.
- Starting a drag, wheel scrolling and `setPosition()` cancel a running `scrollTo()`. In 3.x dragging did not work
  until `scrollTo()` finished.
- `scrollTo()` along a direction disabled by `direction` does not keep the animation running forever.
- `getState().position` never reports `-0`.

## Reduced motion

New option `reducedMotion` defaults to `'auto'`: when the user has `prefers-reduced-motion: reduce`, content stops
right after release without inertia, does not bounce beyond edges, and `scrollTo()` jumps to the target. Dragging
follows the pointer as usual. Set `reducedMotion: 'never'` to keep motion regardless of the setting, `'always'` to
force reduced motion.

## Lifecycle

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
