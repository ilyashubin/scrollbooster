/**
 * Known bugs from the modernization plan (Б1–Б13), written as tests of the expected behavior.
 * `it.fails` passes while the bug exists; when a fix lands, the test starts failing
 * and must be switched to `it` and moved to the relevant test file.
 */
import { describe, expect, it, vi } from 'vitest';
import ScrollBooster from '../src/index.ts';
import { createFixture, mount, roundedPosition, tick } from './helpers.js';

// Drag at constant speed (px/s) for given duration and release, at given refresh rate
function flingAt(frameRate, { speed = 1000, duration = 200 } = {}) {
    const frameDuration = 1000 / frameRate;
    const { sb, pointer } = mount();
    const frames = Math.round(duration / frameDuration);
    const distance = (speed * duration) / 1000;
    pointer.mouseDrag([250, 150], [250 - distance, 150], { steps: frames, frameDuration });
    tick(Math.round(1000 / frameDuration), frameDuration);
    return sb.getState().position.x;
}

describe('known bugs', () => {
    it.fails('Б1: constructor without viewport reports error instead of throwing TypeError', () => {
        vi.spyOn(console, 'error').mockImplementation(() => {});

        expect(() => new ScrollBooster({})).not.toThrow();
    });

    it.fails('Б2: destroy removes capture load listener from content', () => {
        const onUpdate = vi.fn();
        const { sb, content } = mount({ onUpdate });
        const image = document.createElement('img');
        content.append(image);

        sb.destroy();
        onUpdate.mockClear();
        image.dispatchEvent(new Event('load'));

        expect(onUpdate).not.toHaveBeenCalled();
    });

    it.fails('Б3: destroy during inertia stops animation', () => {
        const onUpdate = vi.fn();
        const { sb, pointer } = mount({ onUpdate });
        pointer.mouseDrag([250, 250], [150, 250], { steps: 5 });

        sb.destroy();
        onUpdate.mockClear();
        tick(10);

        expect(onUpdate).not.toHaveBeenCalled();
    });

    it.fails('Б4: lockScrollOnDragDirection "all" does not block page touch scroll outside of drag', () => {
        mount({ lockScrollOnDragDirection: 'all' });
        const event = new Event('touchmove', { bubbles: true, cancelable: true });
        Object.defineProperty(event, 'touches', { value: [{ clientX: 0, clientY: 0, pageX: 0, pageY: 0 }] });

        document.body.dispatchEvent(event);

        expect(event.defaultPrevented).toBe(false);
    });

    it.fails('Б5: inertia travels the same distance at 60 Hz and 120 Hz', () => {
        const at60 = flingAt(60);
        const at120 = flingAt(120);

        expect(Math.abs(at120 - at60) / at60).toBeLessThan(0.05);
    });

    // Expected semantics depend on open question В3 in the plan
    it.fails('Б6: isDragging is false after release', () => {
        const { sb, pointer } = mount();

        pointer.mouseDrag([200, 200], [100, 200]);

        expect(sb.getState().isDragging).toBe(false);
    });

    it.fails('Б7: middle mouse button does not start drag', () => {
        const { sb, pointer } = mount();

        pointer.mouseDown(200, 200, { button: 1 });
        pointer.mouseMove(100, 100);
        tick(10);

        expect(roundedPosition(sb)).toEqual({ x: 0, y: 0 });
    });

    it.fails('Б8: lifting second finger does not end drag', () => {
        const { sb, pointer } = mount();

        pointer.touchStart([[200, 200]]);
        pointer.touchMove([[150, 200]]);
        // Second finger lifted, first finger is still on the screen
        pointer.touchEnd([[150, 200]]);
        pointer.touchMove([[100, 200]]);
        tick(100);

        expect(roundedPosition(sb)).toEqual({ x: 100, y: 0 });
    });

    it.fails('Б9: mouse move without drag does not call onPointerMove', () => {
        const onPointerMove = vi.fn();
        const { pointer } = mount({ onPointerMove });

        pointer.mouseMove(100, 100);

        expect(onPointerMove).not.toHaveBeenCalled();
    });

    it.fails('Б10: no non-passive wheel and window touchmove listeners without features that need them', () => {
        // Vitest browser mode wraps window.addEventListener, so window needs its own spy
        const elementListeners = vi.spyOn(EventTarget.prototype, 'addEventListener');
        const windowListeners = vi.spyOn(window, 'addEventListener');
        mount({ emulateScroll: false });

        const blocking = [...elementListeners.mock.calls, ...windowListeners.mock.calls]
            .filter(([type, , options]) => ['wheel', 'touchmove'].includes(type) && options?.passive === false)
            .map(([type]) => type);

        expect(blocking).toEqual([]);
    });

    it.fails('Б11: updateOptions with new content updates metrics', () => {
        const { sb, viewport } = mount();
        const bigger = document.createElement('div');
        bigger.style.cssText = 'width: 2000px; height: 2000px;';
        viewport.append(bigger);

        sb.updateOptions({ content: bigger });

        expect(sb.content).toEqual({ width: 2000, height: 2000 });
    });

    it.fails('Б12: content resize is picked up without window resize', async () => {
        const { sb, content } = mount();

        content.style.height = '2000px';
        await new Promise((resolve) => setTimeout(resolve, 100));

        expect(sb.content.height).toBe(2000);
    });

    it.fails('Б13: init keeps current scroll position of already scrolled viewport', () => {
        const { viewport } = createFixture();
        viewport.scrollTop = 200;
        const sb = new ScrollBooster({ viewport, scrollMode: 'native' });
        tick(5);

        expect(viewport.scrollTop).toBe(200);
        expect(sb.getState().position.y).toBe(200);
        sb.destroy();
        viewport.remove();
    });
});
