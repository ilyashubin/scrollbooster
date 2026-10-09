import { describe, expect, it, vi } from 'vitest';
import { mount, tick } from './helpers.ts';

describe('click', () => {
    it('passes click through when pointer moved 5px or less', () => {
        const onClick = vi.fn();
        const { pointer } = mount({ onClick });

        pointer.mouseDrag([100, 100], [105, 100], { steps: 1 });
        const event = pointer.click(105, 100);

        expect(event.defaultPrevented).toBe(false);
        expect(onClick).toHaveBeenCalledWith(
            expect.objectContaining({ isDragging: false, dragOffset: { x: 0, y: 0 } }),
            event
        );
    });

    it('prevents click and stops propagation after drag over 5px', () => {
        const onClick = vi.fn();
        const { pointer } = mount({ onClick });
        const outer = vi.fn();
        document.body.addEventListener('click', outer);

        pointer.mouseDrag([100, 100], [106, 100], { steps: 1 });
        const event = pointer.click(106, 100);
        document.body.removeEventListener('click', outer);

        expect(event.defaultPrevented).toBe(true);
        expect(outer).not.toHaveBeenCalled();
        expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('ignores drag offset along disabled direction', () => {
        const { pointer } = mount({ direction: 'horizontal' });

        pointer.mouseDrag([100, 100], [100, 150], { steps: 1 });

        expect(pointer.click(100, 150).defaultPrevented).toBe(false);
    });

    it('prevents only the first click after drag', () => {
        const { pointer } = mount();

        pointer.mouseDrag([100, 100], [150, 100], { steps: 2 });

        expect(pointer.click(150, 100).defaultPrevented).toBe(true);
        expect(pointer.click(150, 100).defaultPrevented).toBe(false);
    });

    it('resets drag offset on next pointerdown', () => {
        const { pointer } = mount();

        pointer.mouseDrag([100, 100], [150, 100], { steps: 2 });
        pointer.mouseDown(150, 100);
        pointer.mouseUp(150, 100);
        tick();

        expect(pointer.click(150, 100).defaultPrevented).toBe(false);
    });
});
