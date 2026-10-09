import { ScrollBooster } from '../../../src/index.ts';

const viewport = document.querySelector('#gallery');
const progress = document.querySelector('#gallery-progress');

new ScrollBooster({
    viewport,
    // Vertical swipes and the wheel still scroll the page
    direction: 'horizontal',
    onUpdate: ({ position, maxPosition }) => {
        const share = maxPosition.x ? position.x / maxPosition.x : 0;
        progress.style.scale = `${share} 1`;
    },
});
