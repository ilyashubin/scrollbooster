import { describe, expect, it } from 'vitest';
import type { ScrollAlign, ScrollMode } from '../src/index.ts';
import { mount, tick } from './helpers.ts';

// Element 100×50 at given content coordinates
function addItem(content: HTMLElement, x: number, y: number) {
    const item = document.createElement('div');
    item.style.cssText = `position: absolute; left: ${x}px; top: ${y}px; width: 100px; height: 50px;`;
    content.style.position = 'relative';
    content.append(item);
    return item;
}

// Element position relative to viewport client area
function offsetIn(viewport: HTMLElement, element: Element) {
    const box = viewport.getBoundingClientRect();
    const rect = element.getBoundingClientRect();
    return { left: Math.round(rect.left - box.left) || 0, top: Math.round(rect.top - box.top) || 0 };
}

describe.each(['transform', 'native'] as ScrollMode[])('scrollIntoView, scrollMode: %s', (scrollMode) => {
    it.each([
        ['nearest', { left: 200, top: 250 }],
        ['start', { left: 0, top: 0 }],
        ['center', { left: 100, top: 125 }],
        ['end', { left: 200, top: 250 }],
    ] as [ScrollAlign, { left: number; top: number }][])('smoothly aligns element, align: %s', (align, expected) => {
        const { sb, viewport, content } = mount({ scrollMode });
        const item = addItem(content, 500, 600);

        sb.scrollIntoView(item, { align });
        tick();
        expect(sb.getState().isMoving).toBe(true);
        tick(300);

        expect(offsetIn(viewport, item)).toEqual(expected);
    });

    it('nearest keeps a visible element in place', () => {
        const { sb, content } = mount({ scrollMode });
        const item = addItem(content, 50, 50);

        sb.scrollIntoView(item);
        tick(300);

        expect(sb.getState().position).toEqual({ x: 0, y: 0 });
    });
});

describe('scrollIntoView', () => {
    it('stops at edges', () => {
        const { sb, content } = mount();
        const item = addItem(content, 900, 0);

        sb.scrollIntoView(item, { align: 'start' });
        tick(300);

        expect(sb.getState().position).toEqual({ x: 700, y: 0 });
    });

    it('moves only along allowed direction', () => {
        const { sb, content } = mount({ direction: 'horizontal' });
        const item = addItem(content, 500, 600);

        sb.scrollIntoView(item);
        tick(300);

        expect(sb.getState().position).toEqual({ x: 300, y: 0 });
    });

    it('measures from the current position during a running scroll', () => {
        const { sb, viewport, content } = mount();
        const item = addItem(content, 500, 0);
        sb.scrollTo({ x: 700 });
        tick(5);

        sb.scrollIntoView(item, { align: 'start' });
        tick(300);

        expect(offsetIn(viewport, item).left).toBe(0);
    });

    it('jumps with reduced motion', () => {
        const { sb, viewport, content } = mount({ reducedMotion: 'always' });
        const item = addItem(content, 500, 600);

        sb.scrollIntoView(item, { align: 'start' });
        tick();

        expect(offsetIn(viewport, item)).toEqual({ left: 0, top: 0 });
    });

    it('aligns start with the right edge in a right-to-left viewport', () => {
        const { sb, viewport, content } = mount(({ viewport }) => {
            viewport.style.direction = 'rtl';
            return {};
        });
        const item = addItem(content, 300, 0);

        sb.scrollIntoView(item, { align: 'start' });
        tick(300);

        // Right edge of the item, 600 px from the right edge of content, at the right edge of viewport
        expect(offsetIn(viewport, item).left).toBe(200);
        expect(sb.getState().position.x).toBe(600);
    });

    it('does nothing while dragging', () => {
        const { sb, content, pointer } = mount();
        const item = addItem(content, 500, 600);
        pointer.mouseDown(100, 100);

        sb.scrollIntoView(item);
        tick(100);

        expect(sb.getState().position).toEqual({ x: 0, y: 0 });
    });

    it('throws for an element outside the content and for unknown align', () => {
        const { sb, content } = mount();
        const item = addItem(content, 0, 0);

        expect(() => sb.scrollIntoView(document.body)).toThrow(TypeError);
        // @ts-expect-error unknown align
        expect(() => sb.scrollIntoView(item, { align: 'middle' })).toThrow(TypeError);
    });
});
