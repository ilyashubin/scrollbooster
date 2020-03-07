# ScrollBooster

Enjoyable drag-to-scroll micro library (~2KB gzipped). Supports smooth content scroll via mouse/touch dragging, trackpad or mouse wheel. Zero dependencies.

Easy to setup yet flexible enough to support any custom scrolling logic.

### Installation

You can install it via `npm` or `yarn` package manager or via `script` tag:

``` bash
npm i scrollbooster
```

``` bash
yarn add scrollbooster
```

``` html
<script src="https://unpkg.com/scrollbooster@2/dist/scrollbooster.min.js"></script>
```

### Usage

The most simple setup with default settings:

``` js
import ScrollBooster from 'scrollbooster';

new ScrollBooster({
    viewport: document.querySelector('.viewport'),
    scrollMode: 'transform'
});
```

Please note that in order to support IE11 you should replace arrow functions and string templates from code examples to supported equivalents or just use Babel.

### Options

Option | Type | Default | Description
------ | ---- | ------- | -----------
viewport | DOM Node | null | Content viewport element (required)
content | DOM Node | viewport child element | Scrollable content element inside viewport
scrollMode | String | undefined | Scroll technique - via CSS transform or natively. Could be 'transform' or 'native'
direction | String | 'all' | Scroll direction. Could be 'horizontal', 'vertical' or 'all'
bounce | Boolean | true | Enables elastic bounce effect when hitting viewport borders
textSelection | Boolean | false | Enables text selection inside viewport
inputsFocus | Boolean | true | Enables focus for elements: 'input', 'textarea', 'button', 'select' and 'label'
pointerMode | String | 'all' | Specify pointer type. Supported values - 'touch' (scroll only on touch devices), 'mouse' (scroll only on desktop), 'all' (mobile and desktop) 
friction | Number | 0.05 | Scroll friction factor - how fast scrolling stops after pointer release
bounceForce | Number | 0.1 | Elastic bounce effect factor
emulateScroll | Boolean | false | Enables mouse wheel/trackpad emulation inside viewport
pointerDownPreventDefault | Boolean | true | Prevent default `mousedown`/`touchstart` event (scroll window while dragging on mobile devices)
onUpdate | Function | noop | Handler function to perform actual scrolling. Receives scrolling state object with coordinates
onClick | Function | noop | Click handler function. Here you can, for example, prevent default event for click on links. Receives object with scrolling metrics and event object. Calls after each `click` in scrollable area
shouldScroll | Function | noop | Function to permit or disable scrolling. Receives object with scrolling state and event object. Calls on `pointerdown` (mousedown, touchstart) in scrollable area. You can return `true` or `false` to enable or disable scrolling

### List of methods

Method | Description
------ | -----------
setPosition | Sets new scroll position in viewport. Receives an object with properties `x` and `y`
scrollTo | Smooth scroll to position in viewport. Receives an object with properties `x` and `y`
updateMetrics | Forces to recalculate elements metrics. Useful for cases when content in scrollable area change its size dynamically
updateOptions | Sets option value. All properties from `Options` config object are supported
getState | Returns current scroll state in a same format as `onUpdate`
destroy | Removes all instance's event listeners

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
    // state contains useful metrics: position, dragOffset, isDragging, isMoving, borderCollision
    // you can control scroll rendering manually without 'scrollMethod' option:
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
  onClick: (state, event) => {
    // prevent default link event
    const isLink = event.target.nodeName.toLowerCase() === 'link';
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

### Browser support

ScrollBooster has been tested in IE 11, Edge and other modern browsers (Chrome, Firefox, Safari).

### Special thanks

David DeSandro for his talk ["Practical UI Physics"](https://www.youtube.com/watch?v=90oMnMFozEE).

### License

MIT License (c) Ilya Shubin
