# ScrollBooster

Enjoyable drag-to-scroll micro library (~6 kB gzipped). Supports smooth content scroll via mouse, touch and pen
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
scrollMode | String | 'transform' | Scroll technique: 'transform' moves content with CSS transform, 'native' scrolls viewport natively, 'none' leaves rendering to `onUpdate`
direction | String | 'all' | Scroll direction. Could be 'horizontal', 'vertical' or 'all'
bounce | Boolean | true | Enables elastic bounce effect when hitting viewport borders
textSelection | Boolean | false | Enables text selection inside viewport
inputsFocus | Boolean | true | Enables focus for elements: 'input', 'textarea', 'button', 'select' and 'label'
pointerMode | String | 'all' | Specify pointer type. Supported values - 'touch' (scroll only with touch), 'mouse' (scroll only with mouse and pen), 'all'
friction | Number | 0.05 | Scroll friction factor - how fast scrolling stops after pointer release, per 60 Hz frame
bounceForce | Number | 0.1 | Elastic bounce effect factor, per 60 Hz frame
wheel | Boolean | true | Mouse wheel and trackpad scroll content. A gesture goes to the page when content cannot move along its main axis, for example at the edge or across `direction`
keyboard | Boolean | true | Arrow keys, Page Up, Page Down, Space, Home and End scroll content when the viewport or an element in it has focus, see Accessibility
reducedMotion | String | 'auto' | 'always' disables inertia and bounce and makes `scrollTo` jump to the target, 'never' keeps them, 'auto' follows `prefers-reduced-motion` user setting
onUpdate | Function | noop | Handler function to perform actual scrolling. Receives scrolling state object with coordinates. Called on animation frames, the first time on the frame after the constructor
onClick | Function | noop | Click handler function. Here you can, for example, prevent default event for click on links. Receives state and the event. Calls after each `click` in scrollable area, `event.defaultPrevented` is `true` for the click that ends a drag
onPointerDown | Function | noop | Called when a press starts dragging, after `shouldDrag` allowed it. Receives state and `PointerEvent`, `event.pointerType` tells mouse, touch and pen apart
onPointerUp | Function | noop | Called when the pointer that drags content is released or cancelled
onPointerMove | Function | noop | Called when the pointer that drags content moves
onWheel | Function | noop | Called for each `wheel` event that scrolls content, before it moves
snap | Function | none | Where content stops after a drag or a wheel gesture, for carousels and paging. Receives the position where inertia would stop and the state, returns the position to scroll to, for example `(rest) => ({ x: Math.round(rest.x / 300) * 300 })`. A missing coordinate keeps its rest position, returning nothing keeps the inertia
shouldDrag | Function | () => true | Decides whether a press starts dragging. Receives state and `PointerEvent`, called on `pointerdown` in the viewport. Return `false` to leave the press to the page, for example on buttons. Wheel is switched with the `wheel` option

Touch dragging relies on CSS `touch-action`: ScrollBooster sets it on the viewport, so the browser keeps the
native gestures that do not drag content. With `direction: 'horizontal'` vertical swipes scroll the page, with
`'vertical'` horizontal swipes do, pinch zoom always works.

### List of methods

Method | Description
------ | -----------
setPosition | Jumps to position within edges and stops motion. Receives an object with properties `x` and `y`, a missing one keeps its value
scrollTo | Smooth scroll to position within edges. Receives an object with properties `x` and `y`, a missing one keeps its value. Does nothing while the user drags content
scrollBy | Smooth scroll by an offset `{ x, y }` from the target of a running scroll or from the current position, so repeated calls from "next" and "previous" buttons add up. A missing coordinate does not move
scrollIntoView | Smooth scroll to show an element of the content: `sb.scrollIntoView(element, { align })`, where `align` is `'nearest'` (default, the least scroll), `'start'`, `'center'` or `'end'`. Use it instead of the native `element.scrollIntoView({ behavior: 'smooth' })`: in `transform` mode the native smooth scroll stops after the first step
updateMetrics | Forces to recalculate elements metrics. Viewport and content resizes are tracked automatically, use it for changes that do not resize them
updateOptions | Sets option value. All properties from `Options` config object are supported, including `viewport` and `content`
getState | Returns current scroll state in a same format as `onUpdate`: `position`, `maxPosition`, `viewport` and `content` sizes, `isMoving`, `isDragging`, `dragOffset`, `dragAngle`, `borderCollision`
destroy | Stops animation, removes all instance's event listeners and observers and the transform from content

### Full Example

``` js
const viewport = document.querySelector('.viewport');
const content = document.querySelector('.scrollable-content');

const sb = new ScrollBooster({
  viewport,
  content,
  scrollMode: 'none',
  bounce: true,
  textSelection: false,
  onUpdate: (state) => {
    // state: position, maxPosition, viewport, content, isMoving, isDragging, dragOffset, dragAngle, borderCollision
    // with scrollMode: 'none' you render the scroll yourself
    // (in a right-to-left viewport position.x grows to the left, translate by +x):
    content.style.transform = `translate(
      ${-state.position.x}px,
      ${-state.position.y}px
    )`;
  },
  shouldDrag: (state, event) => {
    // disable scroll if clicked on button
    const isButton = event.target.nodeName.toLowerCase() === 'button';
    return !isButton;
  },
  onClick: (state, event) => {
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
sb.updateOptions({ wheel: false });
sb.destroy();
```

### Choosing `scrollMode`

- `'transform'` (default) moves content with CSS transform. Only it bounces beyond the edges. The viewport usually has
  `overflow: hidden`, so the browser itself cannot scroll it: `position: sticky` inside content, smooth
  `element.scrollIntoView()` and other libraries that listen to `scroll` of the viewport do not work, use
  `sb.scrollIntoView()` instead.
- `'native'` sets `scrollLeft` and `scrollTop` of the viewport. Content does not bounce, everything the browser does
  with a scroller works, and with `overflow: auto` touch, wheel and keyboard keep native scrolling.
- `'none'` renders nothing, draw the position yourself in `onUpdate`.

### Recipes

Gallery with links: clicks on links work, the click that ends a drag is prevented, nothing to set up.

``` js
new ScrollBooster({ viewport, direction: 'horizontal' });
```

Carousel that stops on a slide, with buttons:

``` js
const slide = 300;
const sb = new ScrollBooster({
  viewport,
  direction: 'horizontal',
  snap: (rest) => ({ x: Math.round(rest.x / slide) * slide }),
});
next.addEventListener('click', () => sb.scrollBy({ x: slide }));
prev.addEventListener('click', () => sb.scrollBy({ x: -slide }));
```

Show the active tab: `sb.scrollIntoView(activeTab, { align: 'center' })`.

Drag with the mouse on desktop, native scroll on touch screens. Touch needs a viewport the browser can scroll:

``` js
// .viewport { overflow: auto; }
new ScrollBooster({ viewport, pointerMode: 'mouse', scrollMode: 'native' });
```

With `pointerMode: 'mouse'` in `'transform'` mode touch does not scroll content at all.

Drag the whole page with the mouse:

``` js
new ScrollBooster({
  viewport: document.documentElement,
  content: document.body,
  scrollMode: 'native',
  direction: 'vertical',
  pointerMode: 'mouse',
});
```

Run code when the motion ends: the last `onUpdate` of a motion has `isMoving: false`.

``` js
let wasMoving = false;
new ScrollBooster({
  viewport,
  onUpdate: (state) => {
    if (wasMoving && !state.isMoving) {
      loadMoreIfNeeded(state.position, state.maxPosition);
    }
    wasMoving = state.isMoving;
  },
});
```

React: create the instance in an effect and destroy it in the cleanup, pass changed props with `updateOptions()`.

``` jsx
function Gallery({ children, direction }) {
  const viewport = useRef(null);
  const sb = useRef(null);
  useEffect(() => {
    sb.current = new ScrollBooster({ viewport: viewport.current, direction });
    return () => sb.current.destroy();
  }, []);
  useEffect(() => sb.current.updateOptions({ direction }), [direction]);
  return (
    <div ref={viewport} style={{ overflow: 'hidden' }}>
      <div style={{ display: 'flex', width: 'max-content' }}>{children}</div>
    </div>
  );
}
```

Component tests in jsdom work: without `ResizeObserver` sizes are read on `updateMetrics()`. Jest with CommonJS
modules needs the ESM package transformed: `transformIgnorePatterns: ['/node_modules/(?!scrollbooster)']`.

### [Live ScrollBooster Examples On CodeSandbox](https://codesandbox.io/s/scrollbooster-examples-3g00p)

### Accessibility

- With `prefers-reduced-motion: reduce` content stops right after release, does not bounce and `scrollTo` jumps
  to the target. Control it with the `reducedMotion` option.
- In `transform` mode focusing an element outside the visible area (for example with Tab) scrolls the content to
  show it.
- With the `keyboard` option (on by default) arrow keys scroll by 40 px, Page Up, Page Down and Space by a page,
  Home and End to the edges, while the viewport or an element in it has focus. With `direction: 'horizontal'` page
  keys, Home and End scroll horizontally. A key that content cannot take goes to the page, keys in inputs, with
  Ctrl, Alt or Meta and Space on buttons are left alone. Make the viewport focusable when its content has no
  focusable elements: `<div class="viewport" tabindex="0" role="region" aria-label="Gallery">`.

### Nested instances

An instance may live inside the content of another one, for example horizontal rows in a vertical board. Both
contents stay in place until the pointer moves past the click threshold, then the gesture goes to the innermost
instance that can move along its main axis, like native scroll goes to one scroller. A row at its edge passes the
gesture to the outer content. The other instance gets `onPointerUp` with the `pointermove` event that decided.

### Right-to-left

In a viewport with `direction: rtl` content starts at the right edge. `position.x` is the distance from that edge
and grows to the left, from 0 to `maxPosition.x`, so progress bars and `scrollTo()` work the same in both
directions. `dragOffset` and `borderCollision` stay physical: dragging to the right gives a positive `dragOffset.x`,
`borderCollision.right` is `true` at the start. `scrollMode: 'native'` writes negative `scrollLeft`, as browsers
do. Direction is read on `updateMetrics()`, call it after changing `direction` of the viewport.

### Browser support

Chrome and Edge 90+, Firefox 86+, Safari and iOS Safari 15+. Version 3.x supports IE11.

### Special thanks

David DeSandro for his talk ["Practical UI Physics"](https://www.youtube.com/watch?v=90oMnMFozEE).

### License

MIT License (c) Ilya Shubin
