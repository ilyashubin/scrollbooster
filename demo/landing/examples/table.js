import { ScrollBooster } from '../../../src/index.ts';

new ScrollBooster({
    viewport: document.querySelector('#table'),
    // The browser scrolls the viewport: sticky cells,
    // scrollbars and touch scrolling keep working
    scrollMode: 'native',
    // Drag with the mouse, touch scrolls natively
    pointerMode: 'mouse',
    // A drag moves along a row or a column
    axisLock: true,
});
