import type { Point, ScrollAlign, ScrollMode, Size } from './types';

export interface Metrics {
    viewport: Size;
    content: Size;
}

const getFullWidth = (elem: HTMLElement): number => Math.max(elem.offsetWidth, elem.scrollWidth);

const getFullHeight = (elem: HTMLElement): number => Math.max(elem.offsetHeight, elem.scrollHeight);

// Selection is disabled by user-select: none of the element or an ancestor, other values than auto enable it.
// Firefox and WebKit compute auto for descendants of user-select: none, so ancestors are checked too.
const isSelectable = (element: Element): boolean => {
    for (let node: Element | null = element; node; node = node.parentElement) {
        const style = getComputedStyle(node);
        // WebKit supports only the prefixed property
        const value = style.userSelect || style.webkitUserSelect;
        if (value === 'none') {
            return false;
        }
        if (value && value !== 'auto') {
            return true;
        }
    }
    return true;
};

/**
 * Check if the point is over selectable text of the element itself, not of its descendants
 */
export const isTextAtPoint = (element: Element, x: number, y: number): boolean => {
    const range = document.createRange();
    for (const node of element.childNodes) {
        if (node.nodeType !== Node.TEXT_NODE) {
            continue;
        }
        range.selectNodeContents(node);
        const rect = range.getBoundingClientRect();
        if (x >= rect.left && y >= rect.top && x <= rect.right && y <= rect.bottom) {
            return isSelectable(element);
        }
    }
    return false;
};

export const clearTextSelection = (): void => {
    window.getSelection()?.removeAllRanges();
};

let reducedMotionQuery: MediaQueryList | undefined;

export const prefersReducedMotion = (): boolean => {
    if (typeof matchMedia !== 'function') {
        return false;
    }
    reducedMotionQuery ??= matchMedia('(prefers-reduced-motion: reduce)');
    return reducedMotionQuery.matches;
};

/**
 * Scroll offset in the DOM that aligns the element in viewport. `'nearest'` scrolls the smallest distance that
 * shows it, start edge wins for large elements. Start and end of the x axis swap in a right-to-left viewport.
 */
export function getRevealOffset(viewport: HTMLElement, element: Element, align: ScrollAlign, isRtl: boolean): Point {
    const box = viewport.getBoundingClientRect();
    const rect = element.getBoundingClientRect();
    const offset = (start: number, end: number, visibleStart: number, visibleSize: number, side: ScrollAlign) => {
        const visibleEnd = visibleStart + visibleSize;
        if (side === 'start') {
            return start - visibleStart;
        }
        if (side === 'end') {
            return end - visibleEnd;
        }
        if (side === 'center') {
            return (start + end - visibleStart - visibleEnd) / 2;
        }
        if (start < visibleStart) {
            return start - visibleStart;
        }
        if (end > visibleEnd) {
            return Math.min(end - visibleEnd, start - visibleStart);
        }
        return 0;
    };
    const sideX = isRtl && align === 'start' ? 'end' : isRtl && align === 'end' ? 'start' : align;
    return {
        x: offset(rect.left, rect.right, box.left + viewport.clientLeft, viewport.clientWidth, sideX),
        y: offset(rect.top, rect.bottom, box.top + viewport.clientTop, viewport.clientHeight, align),
    };
}

export const isSameSize = (a: Size, b: Size): boolean => a.width === b.width && a.height === b.height;

/**
 * Read current sizes of viewport and content
 */
export function measure(viewport: HTMLElement, content: HTMLElement): Metrics {
    return {
        viewport: { width: viewport.clientWidth, height: viewport.clientHeight },
        content: { width: getFullWidth(content), height: getFullHeight(content) },
    };
}

export const isRightToLeft = (viewport: HTMLElement): boolean => getComputedStyle(viewport).direction === 'rtl';

/**
 * Convert between public position and scroll offset in the DOM. Public `x` is the distance from the start edge of
 * the line, so it grows to the left in a right-to-left viewport, like negative `scrollLeft`.
 */
export const mirrorX = (point: Point, isRtl: boolean): Point => (isRtl ? { x: -point.x || 0, y: point.y } : point);

/**
 * Set native scroll of the viewport at once. Assigned `scrollLeft` and `scrollTop` follow CSS
 * `scroll-behavior: smooth` and would animate every frame of a drag.
 */
export function setNativeScroll(viewport: HTMLElement, left: number, top: number): void {
    // Also skips the call in jsdom, it has no scrollTo() on elements
    if (viewport.scrollLeft !== left || viewport.scrollTop !== top) {
        viewport.scrollTo({ left, top, behavior: 'instant' });
    }
}

/**
 * Render scroll offset with the built-in scroll mode, `x` grows to the right. The `translate` property keeps
 * `transform` of the content to the page, it applies before it, so a scaled content is not moved by scaled offsets.
 */
export function render(viewport: HTMLElement, content: HTMLElement, scrollMode: ScrollMode, scroll: Point): void {
    if (scrollMode === 'transform') {
        content.style.translate = `${-scroll.x}px ${-scroll.y}px`;
    }
    if (scrollMode === 'native') {
        setNativeScroll(viewport, scroll.x, scroll.y);
    }
}
