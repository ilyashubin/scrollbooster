# ScrollBooster

Enjoyable content drag-to-scroll micro (~2KB gzipped) library.

### Installation

You can install it via `npm` package manager or just drop a `script` tag:

``` bash
npm i scrollbooster
```

``` html
<script src="path/to/scrollbooster.min.js"></script>
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
emulateScroll | boolean | false | Emulate viewport mouse wheel events (for cases when scrolling with `transform` property)
onUpdate | function | noop | User function that updates element properties according to received coordinates (see demo examples). Receives object with properties: `position`, `viewport` and `content`. Each property contains metrics to perform an actual scrolling

### Methods

Method | Description
------ | -----------
setPosition | Sets new scroll position in viewport. Receives an object with properties `x` and `y`
updateMetrics | Updates element sizes. Useful for images loading or other dynamic content
getUpdate | Returns current metrics and coordinates in a same format as `onUpdate`
destroy | Destroys all instance's event listeners

### Browser support

ScrollBooster was tested in IE 11, Edge and other modern browsers (Chrome, Firefox, Safari).

### Special thanks

David DeSandro for his talk ["Practical UI Physics"](https://www.youtube.com/watch?v=90oMnMFozEE)