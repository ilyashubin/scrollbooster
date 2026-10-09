import type { Direction, Size } from './types';

// Arrow key step, as in browsers
const LINE_PX = 40;

// Page keys scroll by a viewport size, keeping a strip of the previous page in view
const PAGE_OVERLAP = 0.875;

// Keys in these elements edit or choose their value
const EDITABLE_NODES = ['input', 'textarea', 'select'];

/**
 * Arrows scroll in screen directions (`x` grows to the right), page keys forward and back from the start edge,
 * Home and End to the edges
 */
export type KeyScroll =
    | { axis: 'x' | 'y'; arrow: number }
    | { axis: 'x' | 'y'; page: number }
    | { axis: 'x' | 'y'; edge: 'start' | 'end' };

/**
 * Scroll by a key like native scroll does. Page keys and Home, End scroll along x when only horizontal direction
 * is allowed. Null for keys that do not scroll.
 */
export function getKeyScroll(event: KeyboardEvent, viewport: Size, direction: Direction): KeyScroll | null {
    const { target, key, shiftKey } = event;
    if (event.altKey || event.ctrlKey || event.metaKey) {
        return null;
    }
    if (
        target instanceof HTMLElement &&
        (EDITABLE_NODES.includes(target.nodeName.toLowerCase()) || target.isContentEditable)
    ) {
        return null;
    }
    const mainAxis = direction === 'horizontal' ? 'x' : 'y';
    const page = (direction === 'horizontal' ? viewport.width : viewport.height) * PAGE_OVERLAP;
    switch (key) {
        case 'ArrowDown':
            return { axis: 'y', arrow: LINE_PX };
        case 'ArrowUp':
            return { axis: 'y', arrow: -LINE_PX };
        case 'ArrowRight':
            return { axis: 'x', arrow: LINE_PX };
        case 'ArrowLeft':
            return { axis: 'x', arrow: -LINE_PX };
        case 'PageDown':
            return { axis: mainAxis, page };
        case 'PageUp':
            return { axis: mainAxis, page: -page };
        case ' ':
            // Space presses a focused button
            return target instanceof HTMLButtonElement ? null : { axis: mainAxis, page: shiftKey ? -page : page };
        case 'Home':
            return { axis: mainAxis, edge: 'start' };
        case 'End':
            return { axis: mainAxis, edge: 'end' };
        default:
            return null;
    }
}
