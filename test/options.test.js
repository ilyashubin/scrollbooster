import { describe, expect, it, vi } from 'vitest';
import ScrollBooster from '../src/index.ts';
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

    it('logs an error and keeps current elements for invalid viewport', () => {
        const error = vi.spyOn(console, 'error').mockImplementation(() => {});
        const { sb, viewport } = mount();

        sb.updateOptions({ viewport: document.createElement('div') });

        expect(error).toHaveBeenCalledWith(expect.stringContaining('Viewport does not have any content'));
        expect(sb.props.viewport).toBe(viewport);
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
        const { sb, pointer, viewport } = mount({ emulateScroll: true, ...callbacks });
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
        const { sb, viewport } = mount({ emulateScroll: true });
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

describe('lockScrollOnDragDirection', () => {
    it('horizontal: touch drag along locked direction moves content, vertical pan stays native', () => {
        const { sb, pointer, viewport } = mount({ lockScrollOnDragDirection: 'horizontal' });

        pointer.touchStart(200, 100);
        pointer.touchMove(190, 100);
        pointer.touchMove(100, 100);
        tick(100);

        expect(viewport.style.touchAction).toBe('pan-y pinch-zoom');
        expect(roundedPosition(sb)).toEqual({ x: 100, y: 0 });
    });

    it('horizontal: touch drag across locked direction keeps content', () => {
        const { sb, pointer } = mount({ lockScrollOnDragDirection: 'horizontal' });

        pointer.touchStart(100, 200);
        pointer.touchMove(100, 190);
        pointer.touchMove(100, 100);
        tick(100);

        expect(roundedPosition(sb)).toEqual({ x: 0, y: 0 });
    });

    it('horizontal: mouse drag is not locked', () => {
        const { sb, pointer } = mount({ lockScrollOnDragDirection: 'horizontal' });

        pointer.mouseDrag([100, 200], [100, 100], { release: false });
        tick(100);

        expect(roundedPosition(sb)).toEqual({ x: 0, y: 100 });
    });

    it('all: disables native touch gestures on viewport only', () => {
        const addListener = vi.spyOn(window, 'addEventListener');
        const { viewport } = mount({ lockScrollOnDragDirection: 'all' });

        expect(viewport.style.touchAction).toBe('none');
        expect(getComputedStyle(document.body).touchAction).toBe('auto');
        expect(addListener.mock.calls.map(([type]) => type)).not.toContain('touchmove');
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

describe('touch-action', () => {
    it.each([
        ['all', 'pinch-zoom'],
        ['horizontal', 'pan-y pinch-zoom'],
        ['vertical', 'pan-x pinch-zoom'],
    ])('direction %s leaves %s to the browser', (direction, touchAction) => {
        const { viewport } = mount({ direction });

        expect(viewport.style.touchAction).toBe(touchAction);
    });

    it('lockScrollOnDragDirection takes precedence over direction', () => {
        const { viewport } = mount({ direction: 'horizontal', lockScrollOnDragDirection: 'vertical' });

        expect(viewport.style.touchAction).toBe('pan-x pinch-zoom');
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
    // Vitest browser mode wraps window.addEventListener, so window needs its own spy
    function blockingListeners(callback) {
        const elementListeners = vi.spyOn(EventTarget.prototype, 'addEventListener');
        const windowListeners = vi.spyOn(window, 'addEventListener');
        callback();
        return [...elementListeners.mock.calls, ...windowListeners.mock.calls]
            .filter(([, , options]) => options?.passive === false)
            .map(([type]) => type);
    }

    it('is passive and no touch listeners block scroll by default', () => {
        expect(blockingListeners(() => mount({ emulateScroll: true }))).toEqual([]);
    });

    it('stays passive with preventDefaultOnEmulateScroll but without emulateScroll', () => {
        expect(blockingListeners(() => mount({ preventDefaultOnEmulateScroll: 'vertical' }))).toEqual([]);
    });

    it('is not passive with preventDefaultOnEmulateScroll', () => {
        expect(
            blockingListeners(() => mount({ emulateScroll: true, preventDefaultOnEmulateScroll: 'vertical' }))
        ).toEqual(['wheel']);
    });

    it('becomes not passive when preventDefaultOnEmulateScroll is enabled later', () => {
        vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
        const { sb, viewport } = mount({ emulateScroll: true });
        expect(wheel(viewport, 0, 100).defaultPrevented).toBe(false);

        sb.updateOptions({ preventDefaultOnEmulateScroll: 'vertical' });

        expect(wheel(viewport, 0, 100).defaultPrevented).toBe(true);
    });
});
