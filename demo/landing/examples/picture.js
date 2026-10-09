import { ScrollBooster } from '../../../src/index.ts';

const viewport = document.querySelector('#picture');
const image = viewport.querySelector('img');

// Both directions, inertia and bounce are on by default
const sb = new ScrollBooster({ viewport });

// Start from the middle of the picture
const center = () => {
    const { maxPosition } = sb.getState();
    sb.setPosition({
        x: maxPosition.x / 2,
        y: maxPosition.y / 2,
    });
};
if (image.complete) {
    center();
} else {
    image.addEventListener('load', center);
}
