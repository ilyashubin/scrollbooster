import type { Direction, Size } from './types';

// Arrow key step, as in browsers
const LINE_PX = 40;

// Page keys scroll by a viewport size, keeping a strip of the previous page in view
const PAGE_OVERLAP = 0.875;

// Keys in these elements edit or choose their value
const EDITABLE_NODES = ['input', 'textarea', 'select'];

/**
 * Scroll by `delta` of the public position, or to the start or end edge
 */
export type KeyScroll = { axis: 'x' | 'y'; delta: number } | { axis: 'x' | 'y'; edge: 'start' | 'end' };

/**
 * Scroll by a key like native scroll does. Arrows follow the screen, so left and right swap in a right-to-left
 * viewport, page keys go forward and back from the start edge. Page keys and Home, End scroll along x when only
 * horizontal direction is allowed. Null for keys that do not scroll.
 */
export function getKeyScroll(
    event: KeyboardEvent,
    viewport: Size,
    direction: Direction,
    isRtl: boolean
): KeyScroll | null {
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
    const right = isRtl ? -LINE_PX : LINE_PX;
    switch (key) {
        case 'ArrowDown':
            return { axis: 'y', delta: LINE_PX };
        case 'ArrowUp':
            return { axis: 'y', delta: -LINE_PX };
        case 'ArrowRight':
            return { axis: 'x', delta: right };
        case 'ArrowLeft':
            return { axis: 'x', delta: -right };
        case 'PageDown':
            return { axis: mainAxis, delta: page };
        case 'PageUp':
            return { axis: mainAxis, delta: -page };
        case ' ':
            // Space presses a focused button
            return target instanceof HTMLButtonElement ? null : { axis: mainAxis, delta: shiftKey ? -page : page };
        case 'Home':
            return { axis: mainAxis, edge: 'start' };
        case 'End':
            return { axis: mainAxis, edge: 'end' };
        default:
            return null;
    }
}
