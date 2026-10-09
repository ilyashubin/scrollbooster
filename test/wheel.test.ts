import { describe, expect, it, vi } from 'vitest';
import { mount, roundedPosition, tick, wheel } from './helpers.ts';

const fakeTimers = () => vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });

describe('wheel', () => {
    it('moves content by wheel delta and prevents page scroll', () => {
        fakeTimers();
        const { sb, viewport } = mount();

        const event = wheel(viewport, 20, 100);
        tick();

        expect(event.defaultPrevented).toBe(true);
        expect(roundedPosition(sb, 3)).toEqual({ x: 20, y: 100 });
    });

    it('is ignored with wheel: false', () => {
        const onWheel = vi.fn();
        const { sb, viewport } = mount({ wheel: false, onWheel });

        const event = wheel(viewport, 0, 100);
        tick(10);

        expect(roundedPosition(sb)).toEqual({ x: 0, y: 0 });
        expect(onWheel).not.toHaveBeenCalled();
        expect(event.defaultPrevented).toBe(false);
    });

    it('adds up wheel events within one frame', () => {
        fakeTimers();
        const { sb, viewport } = mount();

        wheel(viewport, 0, 30);
        wheel(viewport, 0, 40);
        tick();

        expect(roundedPosition(sb)).toEqual({ x: 0, y: 70 });
    });

    it('applies each delta on one frame only', () => {
        fakeTimers();
        const { sb, viewport } = mount();

        wheel(viewport, 0, 30);
        tick(5);

        expect(roundedPosition(sb)).toEqual({ x: 0, y: 30 });
    });

    it.each([
        ['lines', WheelEvent.DOM_DELTA_LINE, { x: 16, y: 48 }],
        ['pages', WheelEvent.DOM_DELTA_PAGE, { x: 300, y: 600 }],
    ])('converts deltas in %s to pixels', (_, deltaMode, expected) => {
        fakeTimers();
        const { sb, viewport } = mount({}, { contentHeight: 2000 });

        wheel(viewport, 1, 3, deltaMode);
        if (deltaMode === WheelEvent.DOM_DELTA_PAGE) {
            wheel(viewport, 0, -1, deltaMode);
        }
        tick();

        expect(roundedPosition(sb)).toEqual(expected);
    });

    it('stops right after the last wheel event, without inertia', () => {
        fakeTimers();
        const { sb, viewport } = mount();

        wheel(viewport, 0, 100);
        tick();
        vi.advanceTimersByTime(80);
        tick(30);

        expect(roundedPosition(sb)).toEqual({ x: 0, y: 100 });
    });

    it('stops at edges without bounce', () => {
        fakeTimers();
        const { sb, viewport } = mount();

        for (let i = 0; i < 20; i++) {
            wheel(viewport, 0, 100);
            tick();
        }

        expect(roundedPosition(sb)).toEqual({ x: 0, y: 700 });
    });

    it('keeps animating for 80ms after the last wheel event', () => {
        fakeTimers();
        const { sb, viewport } = mount();

        wheel(viewport, 0, 100);
        tick(5);
        expect(sb.getState().isMoving).toBe(true);

        vi.advanceTimersByTime(80);
        tick(5);
        expect(sb.getState().isMoving).toBe(false);
    });

    it('calls onWheel with state before content moves', () => {
        const onWheel = vi.fn();
        const { viewport } = mount({ onWheel });

        const event = wheel(viewport, 0, 100);

        expect(onWheel).toHaveBeenCalledWith(expect.objectContaining({ position: { x: 0, y: 0 } }), event);
    });
});

describe('wheel goes to the page', () => {
    it('when content is at the edge in the direction of the wheel', () => {
        const onWheel = vi.fn();
        const { sb, viewport } = mount({ onWheel });

        const event = wheel(viewport, 0, -100);
        tick();

        expect(event.defaultPrevented).toBe(false);
        expect(onWheel).not.toHaveBeenCalled();
        expect(roundedPosition(sb)).toEqual({ x: 0, y: 0 });
    });

    it('when content is at the edge along the main axis and a smaller cross delta could move it', () => {
        const { sb, viewport } = mount();

        const event = wheel(viewport, 5, -100);
        tick();

        expect(event.defaultPrevented).toBe(false);
        expect(roundedPosition(sb)).toEqual({ x: 0, y: 0 });
    });

    it('when the main axis of the wheel is disabled by direction', () => {
        fakeTimers();
        const { sb, viewport } = mount({ direction: 'horizontal' });

        expect(wheel(viewport, 5, 100).defaultPrevented).toBe(false);
        tick();
        expect(roundedPosition(sb)).toEqual({ x: 0, y: 0 });

        expect(wheel(viewport, 100, 5).defaultPrevented).toBe(true);
        tick();
        expect(roundedPosition(sb)).toEqual({ x: 100, y: 0 });
    });

    it('when content fits the viewport', () => {
        const { viewport } = mount({}, { contentWidth: 200, contentHeight: 200 });

        expect(wheel(viewport, 0, 100).defaultPrevented).toBe(false);
    });

    // Trackpad pinch comes as wheel with ctrlKey, Ctrl+wheel zooms the page
    it('with ctrlKey for zoom', () => {
        const onWheel = vi.fn();
        const { sb, viewport } = mount({ onWheel });

        const event = new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: 10, ctrlKey: true });
        viewport.dispatchEvent(event);
        tick();

        expect(event.defaultPrevented).toBe(false);
        expect(onWheel).not.toHaveBeenCalled();
        expect(sb.getState().position).toEqual({ x: 0, y: 0 });
    });

    it('not until the gesture that reached the edge ends', () => {
        fakeTimers();
        const { sb, viewport } = mount();
        sb.setPosition({ y: 650 });
        tick();

        // Events of one gesture come closer than 80 ms, the edge is reached in the middle of it
        for (let i = 0; i < 3; i++) {
            expect(wheel(viewport, 0, 40).defaultPrevented).toBe(true);
            tick();
            vi.advanceTimersByTime(50);
        }
        expect(roundedPosition(sb)).toEqual({ x: 0, y: 700 });

        vi.advanceTimersByTime(80);
        expect(wheel(viewport, 0, 40).defaultPrevented).toBe(false);
    });

    it('takes the next gesture away from the edge', () => {
        fakeTimers();
        const { sb, viewport } = mount();
        sb.setPosition({ y: 700 });
        tick();

        expect(wheel(viewport, 0, 40).defaultPrevented).toBe(false);
        expect(wheel(viewport, 0, -40).defaultPrevented).toBe(true);
        tick();
        expect(roundedPosition(sb)).toEqual({ x: 0, y: 660 });
    });
});

describe("wheel: 'horizontal'", () => {
    it('scrolls along x with a vertical mouse wheel', () => {
        fakeTimers();
        const { sb, viewport } = mount({ direction: 'horizontal', wheel: 'horizontal' });

        expect(wheel(viewport, 0, 100).defaultPrevented).toBe(true);
        tick();

        expect(roundedPosition(sb)).toEqual({ x: 100, y: 0 });
    });

    it('scrolls along x with a horizontal trackpad swipe', () => {
        fakeTimers();
        const { sb, viewport } = mount({ wheel: 'horizontal' });

        wheel(viewport, 80, 10);
        tick();

        expect(roundedPosition(sb)).toEqual({ x: 80, y: 0 });
    });

    it('never scrolls along y, also with direction: all', () => {
        fakeTimers();
        const { sb, viewport } = mount({ wheel: 'horizontal' });

        wheel(viewport, 10, 60);
        tick();

        expect(roundedPosition(sb)).toEqual({ x: 60, y: 0 });
    });

    it('converts lines and pages along x', () => {
        fakeTimers();
        const { sb, viewport } = mount({ direction: 'horizontal', wheel: 'horizontal' }, { height: 100 });

        wheel(viewport, 0, 3, WheelEvent.DOM_DELTA_LINE);
        wheel(viewport, 0, 1, WheelEvent.DOM_DELTA_PAGE);
        tick();

        // Lines are 16 px, a page is the viewport width
        expect(roundedPosition(sb)).toEqual({ x: 348, y: 0 });
    });

    it('leaves the wheel to the page at the edge of the line', () => {
        const { sb, viewport } = mount({ direction: 'horizontal', wheel: 'horizontal' });

        expect(wheel(viewport, 0, -100).defaultPrevented).toBe(false);
        sb.setPosition({ x: 700 });
        tick();
        expect(wheel(viewport, 0, 100).defaultPrevented).toBe(false);
    });

    it('keeps the default for wheel: true', () => {
        const { viewport } = mount({ direction: 'horizontal' });

        expect(wheel(viewport, 0, 100).defaultPrevented).toBe(false);
    });
});

describe('wheel with nested scrollers', () => {
    it('moves only the inner scroller', () => {
        fakeTimers();
        const outer = mount();
        const inner = mount({}, { width: 200, height: 200, contentWidth: 400, contentHeight: 400 });
        outer.content.append(inner.viewport);

        const event = wheel(inner.content, 0, 100);
        tick();

        expect(event.defaultPrevented).toBe(true);
        expect(roundedPosition(inner.sb)).toEqual({ x: 0, y: 100 });
        expect(roundedPosition(outer.sb)).toEqual({ x: 0, y: 0 });
    });

    it('moves the outer scroller when the inner one is at the edge', () => {
        fakeTimers();
        const outer = mount();
        const inner = mount({}, { width: 200, height: 200, contentWidth: 400, contentHeight: 400 });
        outer.content.append(inner.viewport);
        outer.sb.setPosition({ y: 200 });
        tick();

        const event = wheel(inner.content, 0, -100);
        tick();

        expect(event.defaultPrevented).toBe(true);
        expect(roundedPosition(inner.sb)).toEqual({ x: 0, y: 0 });
        expect(roundedPosition(outer.sb)).toEqual({ x: 0, y: 100 });
    });
});

describe('wheel during drag', () => {
    it('is ignored, content stays under the pointer', () => {
        fakeTimers();
        const { sb, pointer, viewport } = mount();

        pointer.mouseDrag([200, 200], [200, 150], { release: false });
        const event = wheel(viewport, 0, 100);
        tick(100);

        expect(event.defaultPrevented).toBe(false);
        expect(roundedPosition(sb)).toEqual({ x: 0, y: 50 });
    });
});
