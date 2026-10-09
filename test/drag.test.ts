import { describe, expect, it, vi } from 'vitest';
import { mount, roundedPosition as position, round, tick, wheel } from './helpers.ts';

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

    it('keeps default mousedown, so a press moves focus', () => {
        const { pointer } = mount();

        expect(pointer.mouseDown(100, 100).defaultPrevented).toBe(false);
    });

    it.each(['selectstart', 'dragstart'])('prevents %s only while dragging', (type) => {
        const { pointer, content } = mount();
        const dispatch = () => {
            const event = new Event(type, { bubbles: true, cancelable: true });
            content.dispatchEvent(event);
            return event.defaultPrevented;
        };

        expect(dispatch()).toBe(false);
        pointer.mouseDown(100, 100);
        expect(dispatch()).toBe(true);
        pointer.mouseUp(100, 100);
        expect(dispatch()).toBe(false);
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

        expect(sb.getState().isDragging).toBe(false);
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

    it('reports isDragging only while pointer is pressed and moved past the click threshold', () => {
        const { sb, pointer } = mount();

        pointer.mouseDown(200, 200);
        expect(sb.getState().isDragging).toBe(false);

        pointer.mouseMove(195, 200);
        expect(sb.getState().isDragging).toBe(false);

        pointer.mouseMove(150, 200);
        expect(sb.getState().isDragging).toBe(true);

        pointer.mouseUp(150, 200);
        expect(sb.getState().isDragging).toBe(false);
    });

    it('ignores movement along disabled direction for isDragging', () => {
        const { sb, pointer } = mount({ direction: 'horizontal' });

        pointer.mouseDown(200, 200);
        pointer.mouseMove(200, 100);

        expect(sb.getState().isDragging).toBe(false);
    });

    it('resets dragOffset and dragAngle on release, onPointerUp gets the final ones', () => {
        const onPointerUp = vi.fn();
        const { sb, pointer } = mount({ onPointerUp });

        pointer.mouseDrag([200, 200], [150, 200]);

        expect(onPointerUp.mock.calls[0][0]).toMatchObject({
            isDragging: false,
            dragOffset: { x: -50, y: 0 },
            dragAngle: -90,
        });
        expect(sb.getState()).toMatchObject({ dragOffset: { x: 0, y: 0 }, dragAngle: 0 });
    });

    it('calls onPointerDown only for a press that starts dragging', () => {
        const onPointerDown = vi.fn();
        const { pointer } = mount(({ content }) => ({
            onPointerDown,
            shouldDrag: (_, event) => event.target === content,
        }));

        pointer.mouseDown(100, 100, { button: 2, buttons: 2 });
        pointer.mouseDown(100, 100, {}, document.body);
        expect(onPointerDown).not.toHaveBeenCalled();

        pointer.mouseDown(100, 100);
        expect(onPointerDown).toHaveBeenCalledTimes(1);
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

    it('ends the drag on a move without pressed buttons: the release went past the page', () => {
        const onPointerUp = vi.fn();
        const onClick = vi.fn();
        const { sb, pointer, viewport } = mount({ onPointerUp, onClick });

        pointer.mouseDrag([200, 200], [150, 200], { release: false });
        pointer.mouseMove(140, 200, { buttons: 0 });

        expect(sb.getState().isDragging).toBe(false);
        expect(onPointerUp).toHaveBeenCalledTimes(1);
        expect(onPointerUp.mock.calls[0][1].type).toBe('pointermove');
        expect(onPointerUp.mock.calls[0][0].dragOffset).toEqual({ x: -50, y: 0 });
        // No click follows such a release, the next one is not prevented
        expect(pointer.click(100, 100).defaultPrevented).toBe(false);
        tick(100);
        const { x } = sb.getState().position;
        wheel(viewport, 0, 30);
        tick(100);
        expect(sb.getState().position).toEqual({ x, y: 30 });
    });

    it('ends the drag when the main button is released while another one is held', () => {
        const onPointerUp = vi.fn();
        const { sb, pointer } = mount({ onPointerUp });

        pointer.mouseDrag([200, 200], [150, 200], { release: false });
        pointer.mouseMove(150, 200, { buttons: 2 });
        pointer.mouseMove(100, 200, { buttons: 2 });

        expect(sb.getState().isDragging).toBe(false);
        expect(onPointerUp).toHaveBeenCalledTimes(1);
        expect(onPointerUp.mock.calls[0][0].dragOffset).toEqual({ x: -50, y: 0 });
        // Release of the main button clicks
        expect(pointer.click(150, 200).defaultPrevented).toBe(true);
    });

    it('ignores pointerdown without the main button pressed', () => {
        const onPointerDown = vi.fn();
        const { sb, pointer } = mount({ onPointerDown });

        pointer.mouseDown(200, 200, { buttons: 0 });
        pointer.mouseMove(100, 200);

        expect(onPointerDown).not.toHaveBeenCalled();
        expect(sb.getState().isDragging).toBe(false);
    });

    it('does not call onPointerUp for release without drag', () => {
        const onPointerUp = vi.fn();
        const { pointer } = mount({ onPointerUp });

        pointer.mouseUp(100, 100);

        expect(onPointerUp).not.toHaveBeenCalled();
    });

    it('calls pointer callbacks with state and event', () => {
        const onPointerDown = vi.fn();
        const onPointerMove = vi.fn();
        const onPointerUp = vi.fn();
        const { pointer } = mount({ onPointerDown, onPointerMove, onPointerUp });

        pointer.mouseDrag([200, 200], [150, 200], { steps: 2 });

        expect(onPointerDown).toHaveBeenCalledTimes(1);
        expect(onPointerMove).toHaveBeenCalledTimes(2);
        expect(onPointerUp).toHaveBeenCalledTimes(1);
        expect(onPointerDown.mock.calls[0][1]).toBeInstanceOf(PointerEvent);
        expect(onPointerDown.mock.calls[0]).toHaveLength(2);
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

    it('passes touch PointerEvent to callbacks', () => {
        const onPointerDown = vi.fn();
        const { pointer } = mount({ onPointerDown });

        pointer.touchStart(100, 100);

        expect(onPointerDown.mock.calls[0]).toHaveLength(2);
        expect(onPointerDown.mock.calls[0][1].pointerType).toBe('touch');
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

    it('starts a new drag when release of the previous touch was lost', () => {
        const onPointerUp = vi.fn();
        const { sb, pointer } = mount({ onPointerUp });

        pointer.touchStart(200, 200, { id: 10 });
        pointer.touchMove(150, 200, { id: 10 });
        tick(100);
        // pointerup of finger 10 never arrives, the next touch is primary again
        const next = { id: 11, isPrimary: true };
        pointer.touchStart(200, 200, next);
        pointer.touchMove(100, 200, next);
        tick(100);
        expect(position(sb)).toEqual({ x: 150, y: 0 });

        // Late release of the lost finger does not end the new drag
        pointer.touchEnd(150, 200, { id: 10 });
        expect(sb.getState().isDragging).toBe(true);
        expect(onPointerUp).not.toHaveBeenCalled();

        pointer.touchEnd(100, 200, next);
        expect(onPointerUp).toHaveBeenCalledTimes(1);
    });

    it('a touch replaces a mouse press whose release was lost', () => {
        const { sb, pointer } = mount();

        pointer.mouseDown(200, 200);
        // pointerup of the mouse never arrives
        pointer.touchDrag([200, 200], [100, 200], { release: false });
        tick(100);

        expect(position(sb)).toEqual({ x: 100, y: 0 });
    });

    // Sequence from Safari on iOS 18.7: the long press opens the link preview
    it('keeps dragging after a long press on a link', () => {
        const onPointerDown = vi.fn();
        const { sb, pointer, content } = mount({ onPointerDown });
        const link = document.createElement('a');
        link.href = '#preview';
        link.textContent = 'Link with preview';
        content.prepend(link);

        pointer.touchStart(10, 10, { target: link });
        pointer.touchCancel(10, 10);
        pointer.mouseDown(10, 10, { buttons: 0 }, link);
        const dragstart = new Event('dragstart', { bubbles: true, cancelable: true });
        link.dispatchEvent(dragstart);
        expect(dragstart.defaultPrevented).toBe(false);
        expect(onPointerDown).toHaveBeenCalledTimes(1);

        pointer.touchDrag([200, 200], [100, 200], { release: false });
        tick(100);
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

        expect(sb.getState().isDragging).toBe(false);
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
    it('shouldDrag: false prevents drag and receives state and event', () => {
        const shouldDrag = vi.fn(() => false);
        const { sb, pointer } = mount({ shouldDrag });

        pointer.mouseDrag([200, 200], [100, 100]);
        tick(10);

        expect(position(sb)).toEqual({ x: 0, y: 0 });
        expect(shouldDrag).toHaveBeenCalledWith(
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

        expect(sb.getState().isDragging).toBe(false);
    });

    it('inputsFocus: false allows drag from input', () => {
        const { sb, pointer, content } = mount({ inputsFocus: false });
        const input = document.createElement('input');
        content.append(input);

        pointer.mouseDown(10, 10, {}, input);
        pointer.mouseMove(50, 10);

        expect(sb.getState().isDragging).toBe(true);
    });

    it('ignores pointerdown on native scrollbars', () => {
        const { sb, viewport, pointer } = mount({}, { overflow: 'scroll' });
        const scrollbarWidth = viewport.offsetWidth - viewport.clientWidth;
        if (scrollbarWidth === 0) {
            // Overlay scrollbars (headless WebKit) take no layout space
            return;
        }

        pointer.mouseDown(viewport.clientWidth + 1, 10);
        pointer.mouseMove(viewport.clientWidth - 50, 10);

        expect(sb.getState().isDragging).toBe(false);
    });
});

describe('text selection', () => {
    // Paragraph with text from the top left corner of content
    function addText(content: HTMLElement, text = 'Selectable text') {
        const paragraph = document.createElement('p');
        paragraph.style.cssText = 'margin: 0; font: 20px/20px monospace;';
        paragraph.textContent = text;
        content.prepend(paragraph);
        return paragraph;
    }

    const selectStart = (target: Element) => {
        const event = new Event('selectstart', { bubbles: true, cancelable: true });
        target.dispatchEvent(event);
        return event;
    };

    it('textSelection: mouse does not drag from text', () => {
        const { sb, pointer, content } = mount({ textSelection: true });
        const paragraph = addText(content);

        pointer.mouseDown(5, 10, {}, paragraph);
        pointer.mouseMove(50, 10);
        expect(sb.getState().isDragging).toBe(false);
        pointer.mouseUp(50, 10);

        pointer.mouseDown(5, 100, {}, content);
        pointer.mouseMove(50, 100);
        expect(sb.getState().isDragging).toBe(true);
    });

    it('textSelection: mouse drags from an element with text past the end of the text', () => {
        const { sb, pointer, content } = mount({ textSelection: true });
        const paragraph = addText(content, 'Short');

        pointer.mouseDown(250, 10, {}, paragraph);
        pointer.mouseMove(200, 10);

        expect(sb.getState().isDragging).toBe(true);
    });

    it.each([
        ['the element', (paragraph: HTMLElement) => paragraph],
        ['an ancestor', (paragraph: HTMLElement) => paragraph.parentElement as HTMLElement],
    ])('textSelection: mouse drags from text with user-select: none on %s', (_, getElement) => {
        const { sb, pointer, content } = mount({ textSelection: true });
        const paragraph = addText(content);
        getElement(paragraph).style.setProperty('user-select', 'none');
        getElement(paragraph).style.setProperty('-webkit-user-select', 'none');

        pointer.mouseDown(5, 10, {}, paragraph);
        pointer.mouseMove(50, 10);

        expect(sb.getState().isDragging).toBe(true);
    });

    it('textSelection: mouse does not drag from text with user-select: text inside user-select: none', () => {
        const { sb, pointer, content } = mount({ textSelection: true });
        const paragraph = addText(content);
        content.style.setProperty('user-select', 'none');
        content.style.setProperty('-webkit-user-select', 'none');
        paragraph.style.setProperty('user-select', 'text');
        paragraph.style.setProperty('-webkit-user-select', 'text');

        pointer.mouseDown(5, 10, {}, paragraph);
        pointer.mouseMove(50, 10);

        expect(sb.getState().isDragging).toBe(false);
    });

    it('textSelection: touch drags from text', () => {
        const { sb, pointer, content } = mount({ textSelection: true });
        const paragraph = addText(content);

        pointer.touchStart(5, 10, { target: paragraph });
        pointer.touchMove(50, 10);

        expect(sb.getState().isDragging).toBe(true);
    });

    it.each([false, true])('textSelection %s: mouse press that drags drops the selection', (textSelection) => {
        const { pointer, content } = mount({ textSelection });
        const paragraph = addText(content);
        document.getSelection()?.selectAllChildren(paragraph);

        pointer.mouseDown(5, 100);

        expect(document.getSelection()?.toString()).toBe('');
    });

    it('touch press keeps the selection', () => {
        const { pointer, content } = mount();
        const paragraph = addText(content);
        document.getSelection()?.selectAllChildren(paragraph);

        pointer.touchStart(5, 100);

        expect(document.getSelection()?.toString()).toBe('Selectable text');
    });

    it('prevents selection by a long touch press', () => {
        const { pointer, content } = mount();

        pointer.touchStart(5, 10);

        expect(selectStart(content).defaultPrevented).toBe(true);
    });

    it('textSelection: selection by a long touch press ends the press', () => {
        const onPointerUp = vi.fn();
        const { sb, pointer, content } = mount({ textSelection: true, onPointerUp });

        pointer.touchStart(100, 100);
        pointer.touchMove(102, 100);
        expect(selectStart(content).defaultPrevented).toBe(false);
        pointer.touchMove(50, 100);
        tick(10);

        expect(sb.getState().isDragging).toBe(false);
        expect(position(sb)).toEqual({ x: 0, y: 0 });
        expect(onPointerUp).toHaveBeenCalledTimes(1);
        expect(onPointerUp.mock.calls[0][1].type).toBe('pointermove');
    });

    it('textSelection: prevents selection during a touch drag', () => {
        const { sb, pointer, content } = mount({ textSelection: true });

        pointer.touchStart(100, 100);
        pointer.touchMove(50, 100);

        expect(selectStart(content).defaultPrevented).toBe(true);
        expect(sb.getState().isDragging).toBe(true);
    });
});
