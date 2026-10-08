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

    it.each([
        ['middle', 1, 4],
        ['right', 2, 2],
        ['back', 3, 8],
        ['forward', 4, 16],
    ])('ignores %s mouse button', (_, button, buttons) => {
        const { sb, pointer } = mount();

        pointer.mouseDown(200, 200, { button, buttons });
        pointer.mouseMove(100, 100, { buttons });
        tick(10);

        expect(sb.isDragging).toBe(false);
        expect(position(sb)).toEqual({ x: 0, y: 0 });
    });

    it('keeps dragging when pointer leaves viewport', () => {
        const { sb, pointer } = mount();

        pointer.mouseDown(250, 250);
        pointer.mouseMove(250, 150);
        pointer.mouseMove(250, -50);
        tick(100);

        expect(position(sb)).toEqual({ x: 0, y: 300 });
    });

    it('captures pointer on viewport only after click threshold', () => {
        const capture = vi.spyOn(Element.prototype, 'setPointerCapture');
        const { pointer, viewport } = mount();

        pointer.mouseDown(200, 200);
        pointer.mouseMove(204, 200);
        expect(capture).not.toHaveBeenCalled();

        pointer.mouseMove(210, 200);
        pointer.mouseMove(220, 200);
        expect(capture).toHaveBeenCalledTimes(1);
        expect(capture.mock.contexts[0]).toBe(viewport);
        expect(capture).toHaveBeenCalledWith(1);
    });

    it('does not call onPointerMove without drag', () => {
        const onPointerMove = vi.fn();
        const { pointer } = mount({ onPointerMove });

        pointer.mouseMove(100, 100, { buttons: 0 });
        pointer.mouseDrag([200, 200], [150, 200], { steps: 2 });
        onPointerMove.mockClear();
        pointer.mouseMove(100, 100, { buttons: 0 });

        expect(onPointerMove).not.toHaveBeenCalled();
    });

    it('does not call onPointerUp for release without drag', () => {
        const onPointerUp = vi.fn();
        const { pointer } = mount({ onPointerUp });

        pointer.mouseUp(100, 100);

        expect(onPointerUp).not.toHaveBeenCalled();
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
        expect(onPointerDown.mock.calls[0][1]).toBeInstanceOf(PointerEvent);
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

    it('does not prevent default pointerdown', () => {
        const { pointer } = mount();

        expect(pointer.touchStart(100, 100).defaultPrevented).toBe(false);
    });

    it('passes isTouch to callbacks', () => {
        const onPointerDown = vi.fn();
        const { pointer } = mount({ onPointerDown });

        pointer.touchStart(100, 100);

        expect(onPointerDown.mock.calls[0][2]).toBe(true);
    });

    it('ignores second finger', () => {
        const onPointerDown = vi.fn();
        const onPointerUp = vi.fn();
        const { sb, pointer } = mount({ onPointerDown, onPointerUp });
        const second = { id: 11 };

        pointer.touchStart(200, 200);
        pointer.touchMove(150, 200);
        pointer.touchStart(50, 50, second);
        pointer.touchMove(0, 0, second);
        tick(100);
        expect(position(sb)).toEqual({ x: 50, y: 0 });

        pointer.touchEnd(0, 0, second);
        pointer.touchMove(100, 200);
        tick(100);

        expect(onPointerDown).toHaveBeenCalledTimes(1);
        expect(onPointerUp).not.toHaveBeenCalled();
        expect(position(sb)).toEqual({ x: 100, y: 0 });
    });

    it('drags with a finger that is not primary on the page', () => {
        const { sb, pointer } = mount();

        // First finger rests outside of viewport
        const finger = { id: 11, isPrimary: false };
        pointer.touchStart(200, 200, finger);
        pointer.touchMove(150, 200, finger);
        pointer.touchMove(100, 200, finger);
        tick(100);

        expect(position(sb)).toEqual({ x: 100, y: 0 });
    });

    it('ends drag on pointercancel and keeps inertia', () => {
        const onPointerUp = vi.fn();
        const onPointerMove = vi.fn();
        const { sb, pointer } = mount({ onPointerUp, onPointerMove });

        pointer.touchDrag([250, 200], [150, 200], { steps: 5, release: false });
        pointer.touchCancel(150, 200);
        onPointerMove.mockClear();
        pointer.touchMove(50, 200);
        tick(100);

        expect(sb.isDragging).toBe(false);
        expect(onPointerUp).toHaveBeenCalledTimes(1);
        expect(onPointerUp.mock.calls[0][1].type).toBe('pointercancel');
        expect(onPointerMove).not.toHaveBeenCalled();
        expect(sb.getState().position.x).toBeGreaterThan(100);
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
            expect.objectContaining({ position: { x: 0, y: 0 } }),
            expect.any(PointerEvent)
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
