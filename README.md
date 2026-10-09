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

Simplest setup:

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
viewport | HTMLElement | | Element that shows and clips the content (required)
content | HTMLElement | first child of viewport | Element that moves inside viewport
direction | `'all'`, `'horizontal'`, `'vertical'` | `'all'` | Directions the content scrolls in
scrollMode | `'transform'`, `'native'`, `'none'` | `'transform'` | How the position is rendered, see [Choosing `scrollMode`](#choosing-scrollmode)
pointerMode | `'all'`, `'touch'`, `'mouse'` | `'all'` | Pointers that drag content, `'mouse'` includes pen
bounce | boolean | `true` | Content can be pulled beyond the edges with resistance and bounces back when thrown beyond them
friction | number | `0.05` | How fast motion slows down after release, between 0 and 1
bounceForce | number | `0.1` | How fast content returns from beyond an edge, between 0 and 1
textSelection | boolean | `false` | Text can be selected: a mouse press on text selects it instead of dragging, a long touch press selects a word
inputsFocus | boolean | `true` | A press on a form control, `summary`, media controls or editable content, or inside them, does not drag
wheel | boolean | `true` | Wheel and trackpad scroll content. The page scrolls instead when content cannot move that way
keyboard | boolean | `true` | Keys scroll content while it has focus, see [Accessibility](#accessibility)
reducedMotion | `'auto'`, `'always'`, `'never'` | `'auto'` | `'always'` turns off inertia, bounce and smooth `scrollTo`, `'never'` keeps them, `'auto'` follows the `prefers-reduced-motion` setting
snap | function | | Where content stops after a drag or a wheel gesture, for carousels and paging. Receives the position where it would stop and the state, returns the position to scroll to, for example `(rest) => ({ x: Math.round(rest.x / 300) * 300 })`
shouldDrag | function | | Return `false` to not drag from this press, for example on a slider inside content. Receives the state and the `PointerEvent`
onUpdate | function | | Called with the state on animation frames while anything changes, the first time after creation
onClick | function | | Called with the state and the event for each click in viewport. `event.defaultPrevented` is `true` for the click that ends a drag
onPointerDown | function | | Called with the state and the `PointerEvent` when a press starts dragging
onPointerMove | function | | Called when the dragging pointer moves
onPointerUp | function | | Called when the dragging pointer is released or cancelled
onWheel | function | | Called for each `wheel` event that scrolls content

`friction` and `bounceForce` are per 60 Hz frame, motion is the same on any refresh rate.

On touch screens ScrollBooster sets CSS `touch-action` on the viewport, so swipes across `direction` scroll the page
and pinch zoom always works.

### Methods

Method | Description
------ | -----------
scrollTo | Smooth scroll to `{ x, y }`, a missing coordinate stays. Does nothing while the user drags content
scrollBy | Smooth scroll by `{ x, y }`. Repeated calls add up, for "next" and "previous" buttons
scrollIntoView | Smooth scroll to show an element of the content: `sb.scrollIntoView(element, { align })`, `align` is `'nearest'` (default), `'start'`, `'center'` or `'end'`
setPosition | Jump to `{ x, y }` and stop motion
getState | Current state, the same as `onUpdate` receives
updateOptions | Change options, including `viewport` and `content`
updateMetrics | Measure viewport and content again. Size changes are tracked automatically, call it for other changes, for example of `direction: rtl`
destroy | Stop motion, remove listeners and the styles the instance set

Positions stay within the edges. State has `position`, `maxPosition`, `viewport` and `content` sizes, `isMoving`,
`isDragging`, `dragOffset`, `dragAngle` and `borderCollision`.

### Example

``` js
const sb = new ScrollBooster({
  viewport: document.querySelector('.gallery'),
  direction: 'horizontal',
  onUpdate: (state) => {
    progress.value = state.position.x / (state.maxPosition.x || 1);
  },
  onClick: (state, event) => {
    if (!event.defaultPrevented) {
      // a click without drag
    }
  },
});

sb.scrollTo({ x: 0 });
```

### Choosing `scrollMode`

- `'transform'` (default) moves content with CSS transform and bounces beyond the edges. The viewport itself does
  not scroll, so `position: sticky` inside content and code that listens to `scroll` do not work. Use
  `sb.scrollIntoView()` instead of `element.scrollIntoView()`.
- `'native'` sets `scrollLeft` and `scrollTop` of the viewport. No bounce, everything the browser does with a
  scroller works.
- `'none'` renders nothing, render the position in `onUpdate`. Set `will-change: transform` on the content in CSS,
  so it is not repainted every frame:

``` js
onUpdate: ({ position }) => {
  // in a right-to-left viewport use +position.x
  content.style.transform = `translate(${-position.x}px, ${-position.y}px)`;
},
```

### Recipes

Gallery with links: clicks work, the click that ends a drag does not reach links and buttons.

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

Drag with the mouse on desktop, native scroll on touch screens:

``` js
// .viewport { overflow: auto; }
new ScrollBooster({ viewport, pointerMode: 'mouse', scrollMode: 'native' });
```

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

Run code when motion ends, the last `onUpdate` of a motion has `isMoving: false`:

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

React:

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

Tests in jsdom: there is no `ResizeObserver`, call `updateMetrics()` after changing sizes. Jest in CommonJS mode
has to transform the package: `transformIgnorePatterns: ['/node_modules/(?!scrollbooster)']`.

### Accessibility

- With `prefers-reduced-motion: reduce` content stops right after release, does not bounce and `scrollTo` jumps
  to the target, see the `reducedMotion` option.
- Focus on an element outside the visible area, for example with Tab, scrolls content to show it.
- Arrow keys, Page Up, Page Down, Space, Home and End scroll content while the viewport or an element in it has
  focus, like a native scroller. Keys in inputs are left alone. Make the viewport focusable when its content has
  no focusable elements: `<section class="viewport" tabindex="0" aria-label="Gallery">`.

### Nested instances

An instance may live inside the content of another one, for example horizontal rows in a vertical board. Like
native scroll, a gesture goes to the innermost instance that can move along it, a row at its edge passes it to the
outer content.

### Right-to-left

In a viewport with `direction: rtl` content starts at the right edge, and `position.x` is the distance from it:
it grows to the left, from 0 to `maxPosition.x`, so progress bars and `scrollTo()` work the same in both
directions. `dragOffset` and `borderCollision` stay physical, `borderCollision.right` is `true` at the start.

### Browser support

Chrome and Edge 90+, Firefox 90+, Safari and iOS Safari 15+. Version 3.x supports IE11.

### Special thanks

David DeSandro for his talk ["Practical UI Physics"](https://www.youtube.com/watch?v=90oMnMFozEE).

### License

MIT License (c) Ilya Shubin
