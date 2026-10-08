import { describe, expect, it, vi } from 'vitest';
import { mount, roundedPosition as position, round, tick } from './helpers.js';

describe('mouse drag', () => {
    it('moves content opposite to pointer while held', () => {
        const { sb, pointer } = mount();

        pointer.mouseDrag([200, 200], [100, 150], { release: false });
        tick(100);

        expect(position(sb)).toEqual({ x: 100, y: 50 });
        expect(sb.getState().isDragging).toBe(true);
        expect(sb.getState().dragOffset).toEqual({ x: -100, y: -50 });
    });

    it('follows pointer with 1 - friction lag per frame', () => {
        const { sb, pointer } = mount();

        pointer.mouseDown(200, 200);
        pointer.mouseMove(100, 200);
        tick();

        expect(round(sb.getState().position.x)).toBe(95);
    });

    it('prevents default mousedown', () => {
        const { pointer } = mount();

        expect(pointer.mouseDown(100, 100).defaultPrevented).toBe(true);
    });

    it('keeps default mousedown with pointerDownPreventDefault: false', () => {
        const { pointer } = mount({ pointerDownPreventDefault: false });

        expect(pointer.mouseDown(100, 100).defaultPrevented).toBe(false);
    });

    it('ignores right mouse button', () => {
        const { sb, pointer } = mount();

        pointer.mouseDown(200, 200, { button: 2 });
        pointer.mouseMove(100, 100);
        tick(10);

        expect(position(sb)).toEqual({ x: 0, y: 0 });
    });

    it('calls pointer callbacks with state, event and isTouch', () => {
        const onPointerDown = vi.fn();
        const onPointerMove = vi.fn();
        const onPointerUp = vi.fn();
        const { pointer } = mount({ onPointerDown, onPointerMove, onPointerUp });

        pointer.mouseDrag([200, 200], [150, 200], { steps: 2 });

        expect(onPointerDown).toHaveBeenCalledTimes(1);
        expect(onPointerMove).toHaveBeenCalledTimes(2);
        expect(onPointerUp).toHaveBeenCalledTimes(1);
        expect(onPointerDown.mock.calls[0][1]).toBeInstanceOf(MouseEvent);
        expect(onPointerDown.mock.calls[0][2]).toBe(false);
        expect(onPointerUp.mock.calls[0][0].dragOffset).toEqual({ x: -50, y: 0 });
    });
});

describe('touch drag', () => {
    it('moves content', () => {
        const { sb, pointer } = mount();

        pointer.touchDrag([200, 200], [100, 150], { release: false });
        tick(100);

        expect(position(sb)).toEqual({ x: 100, y: 50 });
    });

    it('does not prevent default touchstart', () => {
        const { pointer } = mount();

        expect(pointer.touchStart([[100, 100]]).defaultPrevented).toBe(false);
    });

    it('passes isTouch to callbacks', () => {
        const onPointerDown = vi.fn();
        const { pointer } = mount({ onPointerDown });

        pointer.touchStart([[100, 100]]);

        expect(onPointerDown.mock.calls[0][2]).toBe(true);
    });
});

describe('direction', () => {
    // Former test/xonly.test.js
    it('horizontal: moves only along x', () => {
        const { sb, pointer } = mount({ direction: 'horizontal' });

        pointer.mouseDrag([200, 200], [100, 100], { release: false });
        tick(100);

        expect(position(sb)).toEqual({ x: 100, y: 0 });
    });

    // Former test/yonly.test.js
    it('vertical: moves only along y', () => {
        const { sb, pointer } = mount({ direction: 'vertical' });

        pointer.mouseDrag([200, 200], [100, 100], { release: false });
        tick(100);

        expect(position(sb)).toEqual({ x: 0, y: 100 });
    });
});

describe('pointerMode', () => {
    it('mouse: ignores touch', () => {
        const { sb, pointer } = mount({ pointerMode: 'mouse' });

        pointer.touchDrag([200, 200], [100, 100]);
        tick(10);

        expect(position(sb)).toEqual({ x: 0, y: 0 });
    });

    it('touch: ignores mouse', () => {
        const { sb, pointer } = mount({ pointerMode: 'touch' });

        pointer.mouseDrag([200, 200], [100, 100]);
        tick(10);

        expect(position(sb)).toEqual({ x: 0, y: 0 });
    });
});

describe('drag guards', () => {
    it('shouldScroll: false prevents drag and receives state and event', () => {
        const shouldScroll = vi.fn(() => false);
        const { sb, pointer } = mount({ shouldScroll });

        pointer.mouseDrag([200, 200], [100, 100]);
        tick(10);

        expect(position(sb)).toEqual({ x: 0, y: 0 });
        expect(shouldScroll).toHaveBeenCalledWith(
            expect.objectContaining({ position: { x: -0, y: -0 } }),
            expect.any(MouseEvent)
        );
    });

    it.each(['input', 'textarea', 'button', 'select', 'label'])('inputsFocus: does not drag from %s', (tag) => {
        const { sb, pointer, content } = mount();
        const element = document.createElement(tag);
        content.append(element);

        pointer.mouseDown(10, 10, {}, element);
        pointer.mouseMove(0, 0);
        tick(10);

        expect(sb.isDragging).toBe(false);
    });

    it('inputsFocus: false allows drag from input', () => {
        const { sb, pointer, content } = mount({ inputsFocus: false });
        const input = document.createElement('input');
        content.append(input);

        pointer.mouseDown(10, 10, {}, input);

        expect(sb.isDragging).toBe(true);
    });

    it('textSelection: does not drag from text node', () => {
        const { sb, pointer, content } = mount({ textSelection: true });
        const paragraph = document.createElement('p');
        paragraph.style.cssText = 'margin: 0; font: 20px/20px monospace;';
        paragraph.textContent = 'Selectable text';
        content.prepend(paragraph);

        pointer.mouseDown(5, 10, {}, paragraph);
        expect(sb.isDragging).toBe(false);

        pointer.mouseDown(5, 100, {}, content);
        expect(sb.isDragging).toBe(true);
    });

    it('ignores pointerdown on native scrollbars', () => {
        const { sb, viewport, pointer } = mount({}, { overflow: 'scroll' });
        const scrollbarWidth = viewport.offsetWidth - viewport.clientWidth;
        if (scrollbarWidth === 0) {
            // Overlay scrollbars (headless WebKit) take no layout space
            return;
        }

        pointer.mouseDown(viewport.clientWidth + 1, 10);

        expect(sb.isDragging).toBe(false);
    });
});
