import { ScrollBooster } from '../../../src/index.ts';

const viewport = document.querySelector('#scene');
const layers = viewport.querySelectorAll('[data-depth]');

new ScrollBooster({
    viewport,
    // The front layer sets the scroll range
    content: viewport.querySelector('[data-depth="1"]'),
    direction: 'horizontal',
    // Draw the position yourself: far layers move slower
    scrollMode: 'none',
    onUpdate: ({ position }) => {
        for (const layer of layers) {
            const x = -position.x * Number(layer.dataset.depth);
            layer.style.translate = `${x}px 0`;
        }
    },
});
