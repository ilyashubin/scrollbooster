import { describe, expect, it, vi } from 'vitest';
import { mount, roundedPosition, tick, wheel } from './helpers.js';

describe('wheel', () => {
    it('is ignored without emulateScroll', () => {
        const onWheel = vi.fn();
        const { sb, viewport } = mount({ onWheel });

        const event = wheel(viewport, 0, 100);
        tick(10);

        expect(roundedPosition(sb)).toEqual({ x: 0, y: 0 });
        expect(onWheel).not.toHaveBeenCalled();
        expect(event.defaultPrevented).toBe(false);
    });

    it('emulateScroll: moves content by wheel delta with friction', () => {
        vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
        const { sb, viewport } = mount({ emulateScroll: true });

        wheel(viewport, 20, 100);
        tick();

        expect(roundedPosition(sb, 3)).toEqual({ x: 19, y: 95 });
    });

    it('emulateScroll: stops at edges without bounce', () => {
        vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
        const { sb, viewport } = mount({ emulateScroll: true });

        wheel(viewport, 0, -100);
        tick();
        expect(roundedPosition(sb)).toEqual({ x: 0, y: 0 });

        for (let i = 0; i < 20; i++) {
            wheel(viewport, 0, 100);
            tick();
        }
        expect(roundedPosition(sb)).toEqual({ x: 0, y: 700 });
    });

    it('emulateScroll: keeps animating for 80ms after the last wheel event', () => {
        vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
        const { sb, viewport } = mount({ emulateScroll: true });

        wheel(viewport, 0, 100);
        tick(5);
        expect(sb.isScrolling).toBe(true);
        expect(sb.getState().isMoving).toBe(true);

        vi.advanceTimersByTime(80);
        tick(5);
        expect(sb.isScrolling).toBe(false);
        expect(sb.getState().isMoving).toBe(false);
    });

    it('calls onWheel with state before the wheel is applied', () => {
        const onWheel = vi.fn();
        const { viewport } = mount({ emulateScroll: true, onWheel });

        const event = wheel(viewport, 0, 100);

        expect(onWheel).toHaveBeenCalledWith(expect.objectContaining({ position: { x: -0, y: -0 } }), event);
    });

    it('does not prevent default wheel by default', () => {
        const { viewport } = mount({ emulateScroll: true });

        expect(wheel(viewport, 0, 100).defaultPrevented).toBe(false);
    });

    it('preventDefaultOnEmulateScroll: prevents only wheel in given direction', () => {
        const { viewport } = mount({ emulateScroll: true, preventDefaultOnEmulateScroll: 'horizontal' });

        expect(wheel(viewport, 100, 0).defaultPrevented).toBe(true);
        expect(wheel(viewport, 0, 100).defaultPrevented).toBe(false);
    });
});
