# ScrollBooster

Enjoyable content drag-to-scroll micro (~2KB gzipped) library.

### Installation

You can install it via `npm` or `yarn` package manager or just drop a `script` tag:

``` bash
npm i scrollbooster
```

``` bash
yarn add scrollbooster
```

``` html
<script src="https://unpkg.com/scrollbooster@1.1.0/dist/scrollbooster.min.js"></script>
```

### Usage

``` js
import ScrollBooster from 'scrollbooster'

let sb = new ScrollBooster({
  viewport: document.querySelector('.viewport') // required
  // ...other options
})
```

### Options

Option | Type | Default | Description
------ | ---- | ------- | -----------
viewport | element | null | Viewport - outer element
content | element | First child of viewport element | Scrollable content inside viewport
handle | element | Viewport element | Element that respond to drag event
bounce | boolean | true | Inertia bounce effect (scroll past viewport borders)
textSelection | boolean | false | Ability to select text content
friction | float | 0.05 | Scroll friction factor (scroll inertia after pointer release)
bounceForce | float | 0.1 | Bounce effect factor
emulateScroll | boolean | false | Emulate viewport mouse wheel events (for cases when scrolling with `transform` property)
onUpdate | function | noop | User function that updates element properties according to received coordinates (see demo examples). Receives object with properties: `position`, `viewport` and `content`. Each property contains metrics to perform an actual scrolling
onClick | function | noop | Function that receives object with scrolling metrics and event object. Calls after each `click` in scrollable area. Here you can, for example, prevent default event for click on links
shouldScroll | function | noop | Function that receives object with scrolling metrics and event object. Calls on `pointerdown` (mousedown, touchstart) in scrollable area. Here you can return `true` or `false` to start actual scrolling or not

### Methods to perform custom logic

Method | Description
------ | -----------
setPosition | Sets new scroll position in viewport. Receives an object with properties `x` and `y`
updateMetrics | Updates element sizes. Useful for images loading or other dynamic content
getUpdate | Returns current metrics and coordinates in a same format as `onUpdate`
destroy | Destroys all instance's event listeners

### Full Example

``` js
let viewport = document.querySelector('.viewport')
let content = document.querySelector('.viewport-content')

let sb = new ScrollBooster({
  viewport: viewport,
  content: content,
  handle: document.querySelector('.viewport-scroller'), 
  bounce: true,
  textSelection: false,
  emulateScroll: false,
  onUpdate: (data)=> {
    content.style.transform = `translate(
      ${-data.position.x}px,
      ${-data.position.y}px
    )`
    // and also metrics: data.viewport['width'|'height'] and data.cotent['width'|'height']
  },
  shouldScroll: (data, event) => {
    if (event.target.classList.contains('button')) {
      return false
    } else {
      return true
    }
  },
  onClick: (data, event) => {
    if (event.target.classList.contains('link')) {
      event.preventDefault()
    }
  }
})

// methods example:
sb.updateMetrics()
sb.setPosition({
  x: 100,
  y: 100
})
sb.destroy()
```

### Browser support

ScrollBooster has been tested in IE 11, Edge and other modern browsers (Chrome, Firefox, Safari).

### Special thanks

David DeSandro for his talk ["Practical UI Physics"](https://www.youtube.com/watch?v=90oMnMFozEE).

### License

MIT License (c) Ilya Shubin