import { ScrollBooster } from '../src/index.ts';
import { $, createPanel, mountNav } from './shared/demo.ts';

mountNav();

const viewport = $('#gallery');
const strip = $('.strip', viewport);
let loaded = 0;

// Generated picture of random width, assigned after a delay like a slow network response
function addImage(delay: number): void {
    loaded++;
    const width = 160 + Math.round(Math.random() * 240);
    const hue = (loaded * 47) % 360;
    const svg =
        `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="200">` +
        `<rect width="100%" height="100%" fill="hsl(${hue} 60% 60%)"/>` +
        `<text x="50%" y="50%" font-family="sans-serif" font-size="28" text-anchor="middle" fill="white">` +
        `${loaded} · ${width} px</text></svg>`;
    const image = document.createElement('img');
    image.alt = `Image ${loaded}`;
    strip.append(image);
    setTimeout(() => {
        image.src = `data:image/svg+xml,${encodeURIComponent(svg)}`;
    }, delay);
}

function loadImages(count: number): void {
    for (let index = 0; index < count; index++) {
        addImage(400 + index * 400);
    }
}

const sb = new ScrollBooster({
    viewport,
    direction: 'horizontal',
    onUpdate: createPanel($('#panel'), () => viewport),
});
loadImages(10);

$('#reload').addEventListener('click', () => {
    strip.replaceChildren();
    loaded = 0;
    loadImages(10);
});
$('#add').addEventListener('click', () => loadImages(3));
$('#end').addEventListener('click', () => sb.scrollTo(sb.getState().maxPosition));
