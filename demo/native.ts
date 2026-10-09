import { ScrollBooster } from '../src/index.ts';
import { $, createPanel, fillBoard, fillText, mountNav } from './shared/demo.ts';

mountNav();
fillText($('#filler'), 12);

const viewport = $('#native');
fillBoard($('.board', viewport), 96);
new ScrollBooster({
    viewport,
    pointerMode: 'mouse',
    scrollMode: 'native',
    onUpdate: createPanel($('#native-panel'), () => viewport),
});

const updatePagePanel = createPanel($('#page-panel'), () => document.documentElement);
let page: ScrollBooster | null = null;
const toggle = $('#page-toggle');
toggle.addEventListener('click', () => {
    if (page) {
        page.destroy();
        page = null;
    } else {
        page = new ScrollBooster({
            viewport: document.documentElement,
            content: document.body,
            scrollMode: 'native',
            direction: 'vertical',
            pointerMode: 'mouse',
            onUpdate: updatePagePanel,
        });
    }
    toggle.setAttribute('aria-pressed', String(Boolean(page)));
    toggle.textContent = `Drag the page: ${page ? 'on' : 'off'}`;
});
