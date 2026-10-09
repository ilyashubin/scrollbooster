import { ScrollBooster } from '../src/index.ts';
import { $, createPanel, fillStrip, fillText, mountNav } from './shared/demo.ts';

mountNav();
fillText($('#filler-bottom'), 8);

function mountGallery(id: string, count: number, label: string): [HTMLElement, ReturnType<typeof createPanel>] {
    const viewport = $(`#${id}`);
    fillStrip($('.strip', viewport), count, label);
    return [viewport, createPanel($(`#${id}-panel`), () => viewport)];
}

const [gallery, updateGallery] = mountGallery('gallery', 16, 'Card');
new ScrollBooster({ viewport: gallery, direction: 'horizontal', onUpdate: updateGallery });

// Slide width plus the gap of the strip
const SLIDE = 300;
const [carousel, updateCarousel] = mountGallery('carousel', 10, 'Slide');
const sb = new ScrollBooster({
    viewport: carousel,
    direction: 'horizontal',
    snap: (rest) => ({ x: Math.round(rest.x / SLIDE) * SLIDE }),
    onUpdate: updateCarousel,
});
$('#prev').addEventListener('click', () => sb.scrollBy({ x: -SLIDE }));
$('#next').addEventListener('click', () => sb.scrollBy({ x: SLIDE }));

const tabs = $('#tabs');
const tabList = $('.strip', tabs);
for (let index = 1; index <= 20; index++) {
    const tab = document.createElement('button');
    tab.type = 'button';
    tab.role = 'tab';
    tab.textContent = `Section ${index}`;
    tab.setAttribute('aria-selected', String(index === 1));
    tabList.append(tab);
}
const tabsSb = new ScrollBooster({ viewport: tabs, direction: 'horizontal', wheel: 'horizontal' });
tabList.addEventListener('click', (event) => {
    const tab = event.target instanceof Element ? event.target.closest('[role="tab"]') : null;
    if (!tab || event.defaultPrevented) {
        return;
    }
    for (const other of tabList.children) {
        other.setAttribute('aria-selected', String(other === tab));
    }
    tabsSb.scrollIntoView(tab, { align: 'center' });
});

const [rtl, updateRtl] = mountGallery('rtl', 16, 'Card');
new ScrollBooster({ viewport: rtl, direction: 'horizontal', onUpdate: updateRtl });
