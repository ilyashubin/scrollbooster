import type { Point, ScrollMode, Size } from './types';

export interface Metrics {
    viewport: Size;
    content: Size;
}

const getFullWidth = (elem: HTMLElement): number => Math.max(elem.offsetWidth, elem.scrollWidth);

const getFullHeight = (elem: HTMLElement): number => Math.max(elem.offsetHeight, elem.scrollHeight);

export const textNodeFromPoint = (element: Element, x: number, y: number): Node | null => {
    const range = document.createRange();
    for (const node of element.childNodes) {
        if (node.nodeType !== Node.TEXT_NODE) {
            continue;
        }
        range.selectNodeContents(node);
        const rect = range.getBoundingClientRect();
        if (x >= rect.left && y >= rect.top && x <= rect.right && y <= rect.bottom) {
            return node;
        }
    }
    return null;
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
 * Scroll offset of the smallest distance that shows the element inside viewport, start edge wins for large elements
 */
export function getRevealOffset(viewport: HTMLElement, element: Element): Point {
    const box = viewport.getBoundingClientRect();
    const rect = element.getBoundingClientRect();
    const offset = (start: number, end: number, visibleStart: number, visibleSize: number) => {
        if (start < visibleStart) {
            return start - visibleStart;
        }
        if (end > visibleStart + visibleSize) {
            return Math.min(end - visibleStart - visibleSize, start - visibleStart);
        }
        return 0;
    };
    return {
        x: offset(rect.left, rect.right, box.left + viewport.clientLeft, viewport.clientWidth),
        y: offset(rect.top, rect.bottom, box.top + viewport.clientTop, viewport.clientHeight),
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

/**
 * Render public position with the built-in scroll mode
 */
export function render(viewport: HTMLElement, content: HTMLElement, scrollMode: ScrollMode, position: Point): void {
    if (scrollMode === 'transform') {
        content.style.transform = `translate(${-position.x}px, ${-position.y}px)`;
    }
    if (scrollMode === 'native') {
        viewport.scrollTop = position.y;
        viewport.scrollLeft = position.x;
    }
}
