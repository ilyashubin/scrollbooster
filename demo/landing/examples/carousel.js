import { ScrollBooster } from '../../../src/index.ts';

const viewport = document.querySelector('#carousel');
const dots = document.querySelectorAll('#carousel-dots button');

const sb = new ScrollBooster({
    viewport,
    direction: 'horizontal',
    // Stop on the slide where inertia would end
    snap: (rest, { viewport }) => {
        const index = Math.round(rest.x / viewport.width);
        return { x: index * viewport.width };
    },
    onUpdate: ({ position, viewport }) => {
        const current = Math.round(position.x / viewport.width);
        for (const [index, dot] of dots.entries()) {
            dot.toggleAttribute(
                'aria-current',
                index === current
            );
        }
    },
});

// Slides are as wide as the viewport
const slide = (index) => index * sb.getState().viewport.width;
const prev = document.querySelector('#carousel-prev');
const next = document.querySelector('#carousel-next');
prev.addEventListener('click', () =>
    sb.scrollBy({ x: slide(-1) })
);
next.addEventListener('click', () =>
    sb.scrollBy({ x: slide(1) })
);
for (const [index, dot] of dots.entries()) {
    dot.addEventListener('click', () =>
        sb.scrollTo({ x: slide(index) })
    );
}
