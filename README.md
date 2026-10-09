# ScrollBooster

Enjoyable drag-to-scroll micro library (~5 kB gzipped). Supports smooth content scroll via mouse, touch and pen
dragging, trackpad or mouse wheel, with inertia and elastic bounce that feel the same on 60 Hz and 120 Hz screens.
Zero dependencies, TypeScript types included.

Easy to setup yet flexible enough to support any custom scrolling logic.

Upgrading from 3.x? See [MIGRATION.md](MIGRATION.md).

### Installation

``` bash
npm i scrollbooster
```

Or with `<script>` tag, the library is available as global `ScrollBooster`:

``` html
<script src="https://unpkg.com/scrollbooster@4/dist/scrollbooster.min.js"></script>
```

### Usage

The most simple setup with default settings:

``` js
import { ScrollBooster } from 'scrollbooster';

new ScrollBooster({
    viewport: document.querySelector('.viewport'),
    scrollMode: 'transform'
});
```

The package is ESM only, `require()` loads it in Node 20.19+ and 22.12+:

``` js
const { ScrollBooster } = require('scrollbooster');
```

Types for options and state are exported for TypeScript:

``` ts
import { ScrollBooster, type ScrollBoosterOptions, type ScrollBoosterState } from 'scrollbooster';
```

### Options

Option | Type | Default | Description
------ | ---- | ------- | -----------
viewport | HTMLElement | | Content viewport element (required)
content | HTMLElement | viewport child element | Scrollable content element inside viewport
scrollMode | String | undefined | Scroll technique - via CSS transform or natively. Could be 'transform' or 'native'. Without it scroll is rendered in `onUpdate`
direction | String | 'all' | Scroll direction. Could be 'horizontal', 'vertical' or 'all'
bounce | Boolean | true | Enables elastic bounce effect when hitting viewport borders
textSelection | Boolean | false | Enables text selection inside viewport
inputsFocus | Boolean | true | Enables focus for elements: 'input', 'textarea', 'button', 'select' and 'label'
pointerMode | String | 'all' | Specify pointer type. Supported values - 'touch' (scroll only with touch), 'mouse' (scroll only with mouse and pen), 'all'
friction | Number | 0.05 | Scroll friction factor - how fast scrolling stops after pointer release, per 60 Hz frame
bounceForce | Number | 0.1 | Elastic bounce effect factor, per 60 Hz frame
emulateScroll | Boolean | false | Enables mouse wheel/trackpad emulation inside viewport
preventDefaultOnEmulateScroll | String | false | Prevents horizontal or vertical default when `emulateScroll` is enabled (eg. useful to prevent horizontal trackpad gestures while enabling vertical scrolling). Could be 'horizontal' or 'vertical'
lockScrollOnDragDirection | String | false | Touch drag in given direction moves content, drag in the other direction scrolls the page natively. Could be 'horizontal', 'vertical' or 'all' (no native touch gestures on viewport)
dragDirectionTolerance | Number | 40 | Tolerance in degrees for horizontal or vertical drag detection
pointerDownPreventDefault | Boolean | true | Prevents default `mousedown` on drag start: text selection, native drag of images and links
reducedMotion | String | 'auto' | 'always' disables inertia and bounce and makes `scrollTo` jump to the target, 'never' keeps them, 'auto' follows `prefers-reduced-motion` user setting
onUpdate | Function | noop | Handler function to perform actual scrolling. Receives scrolling state object with coordinates. Called on animation frames, the first time on the frame after the constructor
onClick | Function | noop | Click handler function. Here you can, for example, prevent default event for click on links. Receives object with scrolling metrics, event object and `isTouch`. Calls after each `click` in scrollable area
onPointerDown | Function | noop | Called when a press starts dragging, after `shouldScroll` allowed it. Receives state, `PointerEvent` and `isTouch`
onPointerUp | Function | noop | Called when the pointer that drags content is released or cancelled
onPointerMove | Function | noop | Called when the pointer that drags content moves
onWheel | Function | noop | `wheel` event handler, called with `emulateScroll`
shouldScroll | Function | noop | Function to permit or disable scrolling. Receives object with scrolling state and `PointerEvent`. Calls on `pointerdown` in scrollable area. You can return `true` or `false` to enable or disable scrolling

Touch dragging relies on CSS `touch-action`: ScrollBooster sets it on the viewport, so the browser keeps the
native gestures that do not drag content. With `direction: 'horizontal'` vertical swipes scroll the page, with
`'vertical'` horizontal swipes do, pinch zoom always works except for `lockScrollOnDragDirection: 'all'`.

### List of methods

Method | Description
------ | -----------
setPosition | Jumps to position within edges and stops motion. Receives an object with properties `x` and `y`, a missing one keeps its value
scrollTo | Smooth scroll to position within edges. Receives an object with properties `x` and `y`, a missing one keeps its value. Does nothing while the user drags content
updateMetrics | Forces to recalculate elements metrics. Viewport and content resizes are tracked automatically, use it for changes that do not resize them
updateOptions | Sets option value. All properties from `Options` config object are supported, including `viewport` and `content`
getState | Returns current scroll state in a same format as `onUpdate`
destroy | Stops animation and removes all instance's event listeners and observers

### Full Example

``` js
const viewport = document.querySelector('.viewport');
const content = document.querySelector('.scrollable-content');

const sb = new ScrollBooster({
  viewport,
  content,
  bounce: true,
  textSelection: false,
  emulateScroll: true,
  onUpdate: (state) => {
    // state contains useful metrics: position, dragOffset, dragAngle, isDragging, isMoving, borderCollision
    // you can control scroll rendering manually without 'scrollMode' option:
    content.style.transform = `translate(
      ${-state.position.x}px,
      ${-state.position.y}px
    )`;
  },
  shouldScroll: (state, event) => {
    // disable scroll if clicked on button
    const isButton = event.target.nodeName.toLowerCase() === 'button';
    return !isButton;
  },
  onClick: (state, event, isTouch) => {
    // prevent default link event
    const isLink = event.target.nodeName.toLowerCase() === 'a';
    if (isLink) {
      event.preventDefault();
    }
  }
});

// methods usage examples:
sb.updateMetrics();
sb.scrollTo({ x: 100, y: 100 });
sb.updateOptions({ emulateScroll: false });
sb.destroy();
```

### [Live ScrollBooster Examples On CodeSandbox](https://codesandbox.io/s/scrollbooster-examples-3g00p)

### Accessibility

- With `prefers-reduced-motion: reduce` content stops right after release, does not bounce and `scrollTo` jumps
  to the target. Control it with the `reducedMotion` option.
- In `transform` mode focusing an element outside the visible area (for example with Tab) scrolls the content to
  show it.

### Browser support

Chrome and Edge 90+, Firefox 86+, Safari and iOS Safari 15+. Version 3.x supports IE11.

### Special thanks

David DeSandro for his talk ["Practical UI Physics"](https://www.youtube.com/watch?v=90oMnMFozEE).

### License

MIT License (c) Ilya Shubin
