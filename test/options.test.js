import { describe, expect, it, vi } from 'vitest';
import { ScrollBooster } from '../src/index.ts';
import {
    createFixture,
    createPointer,
    mount,
    nextRender,
    pendingFrames,
    roundedPosition,
    tick,
    wheel,
} from './helpers.js';

describe('updateOptions', () => {
    it('merges options and calls onUpdate on the next frame', () => {
        const onUpdate = vi.fn();
        const { sb } = mount({ onUpdate });
        tick(5);
        onUpdate.mockClear();

        sb.updateOptions({ bounce: false, friction: 0.2 });
        expect(sb.props).toMatchObject({ bounce: false, friction: 0.2, direction: 'all' });
        expect(onUpdate).not.toHaveBeenCalled();

        tick();
        expect(onUpdate).toHaveBeenCalledTimes(1);
        expect(pendingFrames()).toBe(0);
    });

    it('applies new direction to next drag', () => {
        const { sb, pointer } = mount();

        sb.updateOptions({ direction: 'vertical' });
        pointer.mouseDrag([200, 200], [100, 100], { release: false });
        tick(100);

        expect(roundedPosition(sb)).toEqual({ x: 0, y: 100 });
    });

    it('measures and observes new content', async () => {
        const { sb, viewport } = mount();
        const bigger = document.createElement('div');
        bigger.style.cssText = 'width: 2000px; height: 2000px;';
        viewport.append(bigger);

        sb.updateOptions({ content: bigger });
        expect(sb.content).toEqual({ width: 2000, height: 2000 });

        bigger.style.height = '3000px';
        await nextRender();
        expect(sb.content).toEqual({ width: 2000, height: 3000 });
    });

    it('moves listeners to new viewport and reads its scroll position', () => {
        const { sb, pointer } = mount();
        const next = createFixture({ contentWidth: 2000 });
        next.viewport.scrollLeft = 100;

        sb.updateOptions({ viewport: next.viewport });

        expect(sb.props.content).toBe(next.content);
        expect(sb.content.width).toBe(2000);
        expect(roundedPosition(sb)).toEqual({ x: 100, y: 0 });

        pointer.mouseDrag([200, 200], [100, 200]);
        tick(100);
        expect(roundedPosition(sb)).toEqual({ x: 100, y: 0 });

        createPointer(next.viewport).mouseDrag([200, 200], [100, 200], { release: false });
        tick(100);
        expect(roundedPosition(sb)).toEqual({ x: 200, y: 0 });
        next.viewport.remove();
    });

    it('throws TypeError and keeps current elements for viewport without content', () => {
        const { sb, viewport } = mount();

        expect(() => sb.updateOptions({ viewport: document.createElement('div') })).toThrow(
            'viewport has no child element'
        );
        expect(sb.props.viewport).toBe(viewport);
    });
});

describe('updateOptions scrollMode', () => {
    function scrolled(scrollMode) {
        const mounted = mount({ scrollMode });
        mounted.sb.setPosition({ x: 100, y: 50 });
        tick();
        return mounted;
    }

    it('transform to native: removes transform and scrolls natively', () => {
        const { sb, content, viewport } = scrolled('transform');

        sb.updateOptions({ scrollMode: 'native' });

        expect(content.style.transform).toBe('');
        expect([viewport.scrollLeft, viewport.scrollTop]).toEqual([100, 50]);
        expect(sb.getState().position).toEqual({ x: 100, y: 50 });
    });

    it('native to transform: resets native scroll and moves content with transform', () => {
        const { sb, content, viewport } = scrolled('native');

        sb.updateOptions({ scrollMode: 'transform' });

        expect([viewport.scrollLeft, viewport.scrollTop]).toEqual([0, 0]);
        expect(content.style.transform).toBe('translate(-100px, -50px)');
        expect(sb.getState().position).toEqual({ x: 100, y: 50 });
    });

    it('transform to none: removes transform', () => {
        const { sb, content } = scrolled('transform');

        sb.updateOptions({ scrollMode: 'none' });
        tick(5);

        expect(content.style.transform).toBe('');
    });

    it('new content: removes transform from previous content', () => {
        const { sb, content, viewport } = scrolled('transform');
        const next = document.createElement('div');
        next.style.cssText = 'width: 1000px; height: 1000px;';
        viewport.append(next);

        sb.updateOptions({ content: next });
        tick();

        expect(content.style.transform).toBe('');
        expect(next.style.transform).toBe('translate(-100px, -50px)');
    });
});

describe('destroy', () => {
    it('removes pointer, click and wheel listeners', () => {
        const callbacks = {
            onUpdate: vi.fn(),
            onPointerDown: vi.fn(),
            onPointerMove: vi.fn(),
            onPointerUp: vi.fn(),
            onClick: vi.fn(),
            onWheel: vi.fn(),
        };
        const { sb, pointer, viewport } = mount(callbacks);
        tick(5);

        sb.destroy();
        callbacks.onUpdate.mockClear();
        pointer.mouseDrag([200, 200], [100, 100]);
        pointer.click(100, 100);
        pointer.touchDrag([200, 200], [100, 100]);
        wheel(viewport, 0, 100);
        tick(10);

        for (const callback of Object.values(callbacks)) {
            expect(callback).not.toHaveBeenCalled();
        }
        expect(roundedPosition(sb)).toEqual({ x: 0, y: 0 });
    });

    it('stops running animation', () => {
        const onUpdate = vi.fn();
        const { sb, pointer } = mount({ onUpdate });
        pointer.mouseDrag([250, 250], [150, 250], { steps: 5 });

        sb.destroy();
        onUpdate.mockClear();
        tick(10);

        expect(onUpdate).not.toHaveBeenCalled();
        expect(pendingFrames()).toBe(0);
    });

    it('clears wheel timer', () => {
        vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
        const { sb, viewport } = mount();
        wheel(viewport, 0, 100);

        sb.destroy();

        expect(vi.getTimerCount()).toBe(0);
    });

    it('removes capture load listener from content', () => {
        const onUpdate = vi.fn();
        const { sb, content } = mount({ onUpdate });
        const image = document.createElement('img');
        content.append(image);

        sb.destroy();
        onUpdate.mockClear();
        image.dispatchEvent(new Event('load'));

        expect(onUpdate).not.toHaveBeenCalled();
    });

    it('stops observing element sizes', async () => {
        const disconnect = vi.spyOn(ResizeObserver.prototype, 'disconnect');
        const onUpdate = vi.fn();
        const { sb, content } = mount({ onUpdate });

        sb.destroy();
        expect(disconnect).toHaveBeenCalledTimes(1);
        onUpdate.mockClear();
        content.style.height = '2000px';
        await nextRender();

        expect(onUpdate).not.toHaveBeenCalled();
    });

    it('turns further calls into no-ops', () => {
        const onUpdate = vi.fn();
        const { sb } = mount({ onUpdate });
        tick(5);

        sb.destroy();
        onUpdate.mockClear();
        sb.destroy();
        sb.updateOptions({ friction: 0.2 });
        sb.updateMetrics();
        sb.setPosition({ x: 100 });
        sb.scrollTo({ x: 100 });
        sb.startAnimationLoop();
        tick(10);

        expect(onUpdate).not.toHaveBeenCalled();
        expect(pendingFrames()).toBe(0);
        expect(roundedPosition(sb)).toEqual({ x: 0, y: 0 });
    });
});

describe('touch-action', () => {
    it.each([
        ['all', 'pinch-zoom'],
        ['horizontal', 'pan-y pinch-zoom'],
        ['vertical', 'pan-x pinch-zoom'],
    ])('direction %s leaves %s to the browser', (direction, touchAction) => {
        const { viewport } = mount({ direction });

        expect(viewport.style.touchAction).toBe(touchAction);
    });

    it('keeps viewport touch-action with pointerMode: mouse', () => {
        const { viewport } = createFixture();
        viewport.style.touchAction = 'manipulation';
        const sb = new ScrollBooster({ viewport, pointerMode: 'mouse' });

        expect(viewport.style.touchAction).toBe('manipulation');
        sb.destroy();
        viewport.remove();
    });

    it('follows updateOptions', () => {
        const { sb, viewport } = mount();

        sb.updateOptions({ direction: 'vertical' });
        expect(viewport.style.touchAction).toBe('pan-x pinch-zoom');

        sb.updateOptions({ pointerMode: 'mouse' });
        expect(viewport.style.touchAction).toBe('');
    });

    it('restores initial inline value on destroy', () => {
        const { viewport } = createFixture();
        viewport.style.touchAction = 'pan-y';
        const sb = new ScrollBooster({ viewport });

        expect(viewport.style.touchAction).toBe('pinch-zoom');
        sb.destroy();
        expect(viewport.style.touchAction).toBe('pan-y');
        viewport.remove();
    });
});

describe('wheel listener', () => {
    function wheelListeners(callback) {
        const add = vi.spyOn(EventTarget.prototype, 'addEventListener');
        callback();
        return add.mock.calls.filter(([type]) => type === 'wheel').length;
    }

    it('is not added with wheel: false', () => {
        expect(wheelListeners(() => mount({ wheel: false }))).toBe(0);
    });

    it('follows wheel option in updateOptions', () => {
        vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
        const { sb, viewport } = mount({ wheel: false });

        expect(wheelListeners(() => sb.updateOptions({ wheel: true }))).toBe(1);
        wheel(viewport, 0, 100);
        tick(10);
        expect(roundedPosition(sb).y).toBeGreaterThan(0);

        sb.setPosition({ y: 0 });
        vi.advanceTimersByTime(100);
        sb.updateOptions({ wheel: false });
        wheel(viewport, 0, 100);
        tick(10);
        expect(roundedPosition(sb)).toEqual({ x: 0, y: 0 });
    });

    // Vitest browser mode wraps window.addEventListener, so window needs its own spy
    function blockingListeners(callback) {
        const elementListeners = vi.spyOn(EventTarget.prototype, 'addEventListener');
        const windowListeners = vi.spyOn(window, 'addEventListener');
        callback();
        return [...elementListeners.mock.calls, ...windowListeners.mock.calls]
            .filter(([, , options]) => options?.passive === false)
            .map(([type]) => type);
    }

    it('only wheel listener may block scroll', () => {
        expect(blockingListeners(() => mount())).toEqual(['wheel']);
    });

    it('no listener blocks scroll with wheel: false', () => {
        expect(blockingListeners(() => mount({ wheel: false }))).toEqual([]);
    });
});

describe('options validation', () => {
    it('accepts valid options', () => {
        expect(() =>
            mount({
                direction: 'horizontal',
                pointerMode: 'touch',
                scrollMode: 'native',
                reducedMotion: 'never',
                friction: 0.2,
                bounceForce: 0.3,
                wheel: false,
                bounce: false,
                onUpdate() {},
            })
        ).not.toThrow();
    });

    it.each([
        'scrollMethod',
        'preventPointerMoveDefault',
        'lockScrollOnDragDirection',
        'emulateScroll',
        'preventDefaultOnEmulateScroll',
        'dragDirectionTolerance',
    ])('throws for unknown option %s', (key) => {
        expect(() => mount({ [key]: true })).toThrow(new TypeError(`ScrollBooster: unknown option "${key}"`));
    });

    it.each([
        ['direction', 'diagonal', 'one of all, horizontal, vertical'],
        ['direction', undefined, 'one of all, horizontal, vertical'],
        ['pointerMode', 'pen', 'one of all, touch, mouse'],
        ['scrollMode', 'smooth', 'one of transform, native, none'],
        ['scrollMode', undefined, 'one of transform, native, none'],
        ['reducedMotion', true, 'one of auto, always, never'],
        ['friction', 0, 'a number between 0 and 1'],
        ['friction', 1, 'a number between 0 and 1'],
        ['bounceForce', '0.1', 'a number between 0 and 1'],
        ['wheel', 'auto', 'a boolean'],
        ['bounce', 'yes', 'a boolean'],
        ['onUpdate', null, 'a function'],
        ['content', '.content', 'an HTMLElement'],
    ])('throws for %s: %s', (key, value, expected) => {
        expect(() => mount({ [key]: value })).toThrow(
            new TypeError(`ScrollBooster: option "${key}" must be ${expected}`)
        );
    });

    it('updateOptions throws and applies nothing when any option is invalid', () => {
        const { sb } = mount();

        expect(() => sb.updateOptions({ friction: 0.2, direction: 'diagonal' })).toThrow(TypeError);
        expect(() => sb.updateOptions({ friction: 0.2, bounse: false })).toThrow('unknown option "bounse"');
        expect(sb.props).toMatchObject({ friction: 0.05, direction: 'all' });
    });
});
