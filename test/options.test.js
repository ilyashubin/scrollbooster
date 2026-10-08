import { describe, expect, it, vi } from 'vitest';
import { mount, pendingFrames, roundedPosition, tick } from './helpers.js';

describe('updateOptions', () => {
    it('merges options, calls onUpdate and restarts animation loop', () => {
        const onUpdate = vi.fn();
        const { sb } = mount({ onUpdate });
        tick(5);
        onUpdate.mockClear();

        sb.updateOptions({ bounce: false, friction: 0.2 });

        expect(sb.props).toMatchObject({ bounce: false, friction: 0.2, direction: 'all' });
        expect(onUpdate).toHaveBeenCalledTimes(1);
        expect(pendingFrames()).toBe(1);
    });

    it('applies new direction to next drag', () => {
        const { sb, pointer } = mount();

        sb.updateOptions({ direction: 'vertical' });
        pointer.mouseDrag([200, 200], [100, 100], { release: false });
        tick(100);

        expect(roundedPosition(sb)).toEqual({ x: 0, y: 100 });
    });
});

describe('destroy', () => {
    it('removes pointer, wheel and resize listeners', () => {
        const onUpdate = vi.fn();
        const { sb, pointer, viewport } = mount({ emulateScroll: true, onUpdate });
        tick(5);

        sb.destroy();
        onUpdate.mockClear();
        pointer.mouseDrag([200, 200], [100, 100]);
        viewport.dispatchEvent(new WheelEvent('wheel', { deltaY: 100 }));
        window.dispatchEvent(new Event('resize'));
        tick(10);

        expect(onUpdate).not.toHaveBeenCalled();
        expect(roundedPosition(sb)).toEqual({ x: 0, y: 0 });
    });
});

describe('lockScrollOnDragDirection', () => {
    it('horizontal: touch drag along locked direction moves content and prevents touchmove', () => {
        const { sb, pointer } = mount({ lockScrollOnDragDirection: 'horizontal' });

        pointer.touchStart([[200, 100]]);
        pointer.touchMove([[190, 100]]);
        const move = pointer.touchMove([[100, 100]]);
        tick(100);

        expect(move.defaultPrevented).toBe(true);
        expect(roundedPosition(sb)).toEqual({ x: 100, y: 0 });
    });

    it('horizontal: touch drag across locked direction keeps content and native scroll', () => {
        const { sb, pointer } = mount({ lockScrollOnDragDirection: 'horizontal' });

        pointer.touchStart([[100, 200]]);
        pointer.touchMove([[100, 190]]);
        const move = pointer.touchMove([[100, 100]]);
        tick(100);

        expect(move.defaultPrevented).toBe(false);
        expect(roundedPosition(sb)).toEqual({ x: 0, y: 0 });
    });

    it('horizontal: mouse drag is not locked', () => {
        const { sb, pointer } = mount({ lockScrollOnDragDirection: 'horizontal' });

        pointer.mouseDrag([100, 200], [100, 100], { release: false });
        tick(100);

        expect(roundedPosition(sb)).toEqual({ x: 0, y: 100 });
    });

    it('all: prevents touchmove in any direction', () => {
        const { pointer } = mount({ lockScrollOnDragDirection: 'all' });

        pointer.touchStart([[100, 200]]);

        expect(pointer.touchMove([[100, 150]]).defaultPrevented).toBe(true);
    });

    it('detects drag direction with dragDirectionTolerance', () => {
        const { sb } = mount();

        expect(sb.getDragDirection(sb.getDragAngle(100, 0), 40)).toBe('horizontal');
        expect(sb.getDragDirection(sb.getDragAngle(0, 100), 40)).toBe('vertical');
        // 45° drag: tolerance 40 treats it as horizontal, tolerance 50 as vertical
        expect(sb.getDragDirection(sb.getDragAngle(100, 100), 40)).toBe('horizontal');
        expect(sb.getDragDirection(sb.getDragAngle(100, 100), 50)).toBe('vertical');
    });
});
