/**
 * An instance inside the content of another one: past the click threshold the gesture goes to one of them,
 * like native scroll goes to one scroller
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ScrollBooster, type ScrollBoosterOptions } from '../src/index.ts';
import { createFixture, createPointer, mount, roundedPosition, tick } from './helpers.ts';

let inner: ScrollBooster | undefined;
afterEach(() => {
    inner?.destroy();
    inner = undefined;
});

// Row 200×100 with content 1000 px wide at the top of the outer content
function mountNested(outerOptions: Partial<ScrollBoosterOptions>, innerOptions: Partial<ScrollBoosterOptions> = {}) {
    const outer = mount(outerOptions);
    const row = createFixture({ width: 200, height: 100, contentWidth: 1000, contentHeight: 100 });
    outer.content.prepend(row.viewport);
    inner = new ScrollBooster({ viewport: row.viewport, direction: 'horizontal', ...innerOptions });
    return { outer, inner, row: row.viewport, pointer: createPointer(row.viewport) };
}

describe('nested instances', () => {
    it('horizontal drag on the row moves only the row', () => {
        const onPointerDown = vi.fn();
        const onPointerUp = vi.fn();
        const { outer, inner, pointer } = mountNested({ direction: 'all', onPointerDown, onPointerUp });

        pointer.mouseDrag([150, 50], [50, 40], { release: false });
        tick(20);

        expect(roundedPosition(inner).x).toBeGreaterThan(90);
        expect(roundedPosition(outer.sb)).toEqual({ x: 0, y: 0 });
        // The outer press ends when the row takes the gesture, callbacks stay in pairs
        expect(onPointerDown).toHaveBeenCalledTimes(1);
        expect(onPointerUp).toHaveBeenCalledTimes(1);
        expect(onPointerUp.mock.calls[0][1].type).toBe('pointermove');
        expect(outer.sb.getState().isDragging).toBe(false);
    });

    it('vertical drag on the row moves the outer content', () => {
        const onPointerUp = vi.fn();
        const { outer, inner, pointer } = mountNested({ direction: 'vertical' }, { onPointerUp });

        pointer.mouseDrag([150, 80], [140, 10], { release: false });
        tick(20);

        expect(roundedPosition(outer.sb).y).toBeGreaterThan(60);
        expect(roundedPosition(inner)).toEqual({ x: 0, y: 0 });
        expect(onPointerUp).toHaveBeenCalledTimes(1);
    });

    it('row at its edge passes the gesture to the outer content', () => {
        const { outer, inner, pointer, row } = mountNested({ direction: 'all' });
        // Row stays in the visible part of the outer viewport
        row.style.marginLeft = '350px';
        outer.sb.setPosition({ x: 300 });
        tick();

        // Row is at its start, a drag to the right cannot move it
        pointer.mouseDrag([50, 50], [150, 50], { release: false });
        tick(20);

        expect(roundedPosition(inner)).toEqual({ x: 0, y: 0 });
        expect(roundedPosition(outer.sb).x).toBeLessThan(250);
    });

    it('right-to-left row at its start passes a drag to the left to the outer content', () => {
        const { outer, inner, pointer, row } = mountNested({ direction: 'all' });
        row.style.direction = 'rtl';
        inner.updateMetrics();
        outer.sb.setPosition({ x: 100 });
        tick();

        pointer.mouseDrag([150, 50], [50, 50], { release: false });
        tick(20);

        expect(roundedPosition(inner)).toEqual({ x: 0, y: 0 });
        expect(roundedPosition(outer.sb).x).toBeGreaterThan(150);
    });

    it('row keeps the gesture at its edge when the outer content cannot take the axis', () => {
        const { outer, inner, pointer } = mountNested({ direction: 'vertical' });

        pointer.mouseDrag([50, 50], [150, 50], { release: false });
        tick(20);

        // Bounce beyond the start edge of the row, with the rubber band resistance
        expect(roundedPosition(inner).x).toBeLessThan(-20);
        expect(roundedPosition(outer.sb)).toEqual({ x: 0, y: 0 });
    });

    it('click after a drag of the row reaches only the row', () => {
        const outerClick = vi.fn();
        const innerClick = vi.fn();
        const { pointer, row } = mountNested({ direction: 'all', onClick: outerClick }, { onClick: innerClick });
        const rowContent = row.firstElementChild as HTMLElement;

        pointer.touchDrag([150, 50], [140, 50], { steps: 2 });
        const event = new MouseEvent('click', { bubbles: true, cancelable: true, detail: 1 });
        rowContent.dispatchEvent(event);

        expect(event.defaultPrevented).toBe(true);
        expect(innerClick).toHaveBeenCalledTimes(1);
        expect(outerClick).not.toHaveBeenCalled();
    });

    it('holds both contents until the click threshold', () => {
        const { outer, inner, pointer } = mountNested({ direction: 'all' });

        pointer.mouseDown(150, 50);
        pointer.mouseMove(146, 47);
        tick(5);

        expect(roundedPosition(inner)).toEqual({ x: 0, y: 0 });
        expect(roundedPosition(outer.sb)).toEqual({ x: 0, y: 0 });
    });

    it('outer content alone takes a drag outside the row', () => {
        const { outer, inner } = mountNested({ direction: 'all' });
        const pointer = createPointer(outer.viewport);

        pointer.mouseDrag([150, 250], [100, 150], { release: false });
        tick(20);

        expect(roundedPosition(outer.sb)).toEqual({ x: 50, y: 100 });
        expect(roundedPosition(inner)).toEqual({ x: 0, y: 0 });
    });
});
