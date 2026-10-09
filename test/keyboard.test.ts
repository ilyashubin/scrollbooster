import { describe, expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';
import type { ScrollBoosterOptions } from '../src/index.ts';
import { mount, roundedPosition, tick } from './helpers.ts';

function press(target: Element, key: string, init: KeyboardEventInit = {}) {
    const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init });
    target.dispatchEvent(event);
    return event;
}

// Focusable viewport, as recommended for keyboard users
function mountFocusable(options: Partial<ScrollBoosterOptions> = {}) {
    const mounted = mount(options);
    mounted.viewport.tabIndex = 0;
    return mounted;
}

describe('keyboard', () => {
    it.each([
        ['ArrowDown', 'ArrowUp', { x: 100, y: 140 }, { x: 100, y: 60 }],
        ['ArrowRight', 'ArrowLeft', { x: 140, y: 100 }, { x: 60, y: 100 }],
    ])('%s and %s scroll by 40 px, repeated keys add up', (forward, back, afterForward, afterBack) => {
        const { sb, viewport } = mountFocusable();
        sb.setPosition({ x: 100, y: 100 });
        tick();

        expect(press(viewport, forward).defaultPrevented).toBe(true);
        tick(300);
        expect(sb.getState().position).toEqual(afterForward);

        press(viewport, back);
        tick(2);
        press(viewport, back);
        tick(300);
        expect(sb.getState().position).toEqual(afterBack);
    });

    it('page keys and Space scroll by 7/8 of viewport', () => {
        const { sb, viewport } = mountFocusable();

        press(viewport, 'PageDown');
        tick(300);
        expect(sb.getState().position.y).toBe(262.5);

        press(viewport, ' ');
        tick(300);
        expect(sb.getState().position.y).toBe(525);

        press(viewport, ' ', { shiftKey: true });
        press(viewport, 'PageUp');
        tick(300);
        expect(sb.getState().position.y).toBe(0);
    });

    it('Home and End go to the edges', () => {
        const { sb, viewport } = mountFocusable();

        press(viewport, 'End');
        tick(300);
        expect(sb.getState().position).toEqual({ x: 0, y: 700 });

        press(viewport, 'Home');
        tick(300);
        expect(sb.getState().position).toEqual({ x: 0, y: 0 });
    });

    it('page keys and Home, End scroll along x with horizontal direction', () => {
        const { sb, viewport } = mountFocusable({ direction: 'horizontal' });

        press(viewport, 'PageDown');
        tick(300);
        expect(sb.getState().position.x).toBe(262.5);

        press(viewport, 'End');
        tick(300);
        expect(sb.getState().position.x).toBe(700);
    });

    it('leaves keys to the page when content cannot move', () => {
        const { viewport } = mountFocusable({ direction: 'horizontal' });

        expect(press(viewport, 'ArrowUp').defaultPrevented).toBe(false);
        expect(press(viewport, 'ArrowLeft').defaultPrevented).toBe(false);
        expect(press(viewport, 'ArrowDown').defaultPrevented).toBe(false);
        expect(press(viewport, 'Home').defaultPrevented).toBe(false);
        expect(press(viewport, 'ArrowRight').defaultPrevented).toBe(true);
    });

    it.each([
        ['input', () => document.createElement('input'), 'ArrowDown', {}],
        ['contenteditable', () => Object.assign(document.createElement('div'), { contentEditable: 'true' }), 'End', {}],
        ['button for Space', () => document.createElement('button'), ' ', {}],
        ['modifier', () => document.createElement('a'), 'ArrowDown', { ctrlKey: true }],
    ] as const)('ignores keys in %s', (_, create, key, init) => {
        const { sb, content } = mount();
        const element = create();
        content.prepend(element);

        expect(press(element, key, init).defaultPrevented).toBe(false);
        tick(300);
        expect(sb.getState().position).toEqual({ x: 0, y: 0 });
    });

    it('is off with keyboard: false and while dragging', () => {
        const off = mountFocusable({ keyboard: false });
        expect(press(off.viewport, 'ArrowDown').defaultPrevented).toBe(false);

        const dragging = mountFocusable();
        dragging.pointer.mouseDown(100, 100);
        expect(press(dragging.viewport, 'ArrowDown').defaultPrevented).toBe(false);
    });

    it('arrows follow the screen and page keys the start edge in a right-to-left viewport', () => {
        const { sb, viewport } = mount(({ viewport }) => {
            viewport.style.direction = 'rtl';
            return { direction: 'horizontal' };
        });

        press(viewport, 'ArrowLeft');
        tick(300);
        expect(sb.getState().position.x).toBe(40);

        press(viewport, 'PageDown');
        tick(300);
        expect(sb.getState().position.x).toBe(302.5);

        expect(press(viewport, 'ArrowRight').defaultPrevented).toBe(true);
        press(viewport, 'Home');
        tick(300);
        expect(sb.getState().position.x).toBe(0);
    });

    it('jumps with reduced motion', () => {
        const { sb, viewport } = mountFocusable({ reducedMotion: 'always' });

        press(viewport, 'ArrowDown');
        tick();

        expect(sb.getState().position.y).toBe(40);
    });

    it('follows real key presses on the focused viewport', async () => {
        const { sb, viewport } = mountFocusable();
        viewport.focus();

        await userEvent.keyboard('{ArrowDown}{ArrowDown}');
        tick(300);

        expect(roundedPosition(sb)).toEqual({ x: 0, y: 80 });
    });
});
