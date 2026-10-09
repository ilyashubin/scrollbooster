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

    // A touch drag within the tap distance of the browser clicks the element under the finger
    it('stops click after drag before handlers of content elements', () => {
        const onClick = vi.fn();
        const { pointer, content } = mount({ onClick });
        const onContentClick = vi.fn();
        content.addEventListener('click', onContentClick);

        pointer.touchDrag([100, 100], [110, 100], { steps: 2 });
        const event = new MouseEvent('click', { bubbles: true, cancelable: true, detail: 1 });
        content.dispatchEvent(event);

        expect(event.defaultPrevented).toBe(true);
        expect(onContentClick).not.toHaveBeenCalled();
        expect(onClick).toHaveBeenCalledTimes(1);
        expect(onClick).toHaveBeenCalledWith(expect.anything(), event);
    });

    it('passes click to content handlers before onClick', () => {
        const calls: string[] = [];
        const { content } = mount({ onClick: (_state, event) => calls.push(`onClick ${event.defaultPrevented}`) });
        content.addEventListener('click', (event) => {
            calls.push('content');
            event.preventDefault();
        });

        content.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, detail: 1 }));

        expect(calls).toEqual(['content', 'onClick true']);
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

    // A touch drag past the tap distance ends without click. Keyboard activation and element.click() dispatch
    // click with detail 0, it never ends a drag.
    it('passes click without pointer through after drag that had no click', () => {
        const onClick = vi.fn();
        const { pointer, content } = mount({ onClick });

        pointer.touchDrag([100, 100], [150, 100]);
        const event = new MouseEvent('click', { bubbles: true, cancelable: true, detail: 0 });
        content.dispatchEvent(event);

        expect(event.defaultPrevented).toBe(false);
        expect(onClick).toHaveBeenCalledWith(expect.anything(), event);
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
