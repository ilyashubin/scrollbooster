import { ScrollBooster } from '../../../src/index.ts';

const viewport = document.querySelector('#tabs');

const sb = new ScrollBooster({
    viewport,
    direction: 'horizontal',
    // The mouse wheel scrolls the tabs, then the page
    wheel: 'horizontal',
    // The click that ends a drag comes prevented
    onClick: (_state, event) => {
        const tab = event.target.closest('[role="tab"]');
        if (!tab || event.defaultPrevented) {
            return;
        }
        const selected = viewport.querySelector('[aria-selected="true"]');
        selected.setAttribute('aria-selected', 'false');
        tab.setAttribute('aria-selected', 'true');
        sb.scrollIntoView(tab, { align: 'center' });
    },
});
