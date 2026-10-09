import { describe, expect, it, vi } from 'vitest';
import { ScrollBooster } from '../src/index.ts';
import { createFixture, type Fixture, mount, pendingFrames, tick } from './helpers.ts';

describe('init', () => {
    it('reads viewport and content metrics', () => {
        const { sb } = mount({}, { width: 300, height: 200, contentWidth: 1000, contentHeight: 800 });

        expect(sb.getState()).toMatchObject({
            viewport: { width: 300, height: 200 },
            content: { width: 1000, height: 800 },
            maxPosition: { x: 700, y: 600 },
        });
    });

    it('uses first viewport child as content by default', () => {
        const { sb, content } = mount();

        sb.setPosition({ x: 10 });
        tick();

        expect(getComputedStyle(content).translate).toBe('-10px');
    });

    it('accepts explicit content element', () => {
        const { viewport } = createFixture();
        const inner = document.createElement('div');
        viewport.firstElementChild?.append(inner);
        inner.style.cssText = 'width: 2000px; height: 100px;';
        const sb = new ScrollBooster({ viewport, content: inner });
        sb.setPosition({ x: 10 });
        tick();

        expect(getComputedStyle(inner).translate).toBe('-10px');
        expect(sb.getState().content).toEqual({ width: 2000, height: 100 });
        sb.destroy();
        viewport.remove();
    });

    it('has zero edges when content is smaller than viewport', () => {
        const { sb } = mount({}, { contentWidth: 100, contentHeight: 100 });

        expect(sb.getState().maxPosition).toEqual({ x: 0, y: 0 });
    });

    it.each([
        ['without options', undefined, 'options must be an object'],
        ['without viewport', {}, 'option "viewport" must be an HTMLElement'],
        ['with non-element viewport', { viewport: { children: [] } }, 'option "viewport" must be an HTMLElement'],
    ])('throws TypeError %s', (_, options, message) => {
        // @ts-expect-error invalid options
        expect(() => new ScrollBooster(options)).toThrow(new TypeError(`ScrollBooster: ${message}`));
    });

    it('throws TypeError when viewport has no child HTMLElement', () => {
        const viewport = document.createElement('div');
        document.body.append(viewport);

        expect(() => new ScrollBooster({ viewport })).toThrow('first child of viewport is not an HTMLElement');
        viewport.remove();
    });

    it.each([
        ['viewport itself', ({ viewport }: Fixture) => viewport],
        ['element outside viewport', () => document.body],
    ])('throws TypeError when content is %s', (_, getContent) => {
        const fixture = createFixture();

        expect(() => new ScrollBooster({ viewport: fixture.viewport, content: getContent(fixture) })).toThrow(
            'option "content" must be an element inside "viewport"'
        );
        fixture.viewport.remove();
    });

    it('adds no listeners when options are invalid', () => {
        const addListener = vi.spyOn(EventTarget.prototype, 'addEventListener');
        const { viewport } = createFixture();

        // @ts-expect-error invalid direction
        expect(() => new ScrollBooster({ viewport, direction: 'diagonal' })).toThrow(TypeError);
        expect(addListener).not.toHaveBeenCalled();
        expect(pendingFrames()).toBe(0);
        viewport.remove();
    });

    it('calls onUpdate with initial state on the first frame, not in the constructor', () => {
        const onUpdate = vi.fn();
        mount({ onUpdate });
        expect(onUpdate).not.toHaveBeenCalled();

        tick();
        expect(onUpdate).toHaveBeenCalledTimes(1);
        expect(onUpdate.mock.calls[0][0]).toEqual({
            isMoving: false,
            isDragging: false,
            position: { x: 0, y: 0 },
            dragOffset: { x: 0, y: 0 },
            dragAngle: 0,
            borderCollision: { left: true, right: false, top: true, bottom: false },
            viewport: { width: 300, height: 300 },
            content: { width: 1000, height: 1000 },
            maxPosition: { x: 700, y: 700 },
        });
    });

    it('keeps scroll position of already scrolled viewport', () => {
        const { viewport } = createFixture();
        viewport.scrollTop = 200;
        viewport.scrollLeft = 100;
        const onUpdate = vi.fn();
        const sb = new ScrollBooster({ viewport, scrollMode: 'native', onUpdate });
        tick(5);

        expect(onUpdate.mock.calls[0][0].position).toEqual({ x: 100, y: 200 });
        expect(sb.getState().position).toEqual({ x: 100, y: 200 });
        expect(viewport.scrollTop).toBe(200);
        expect(viewport.scrollLeft).toBe(100);
        sb.destroy();
        viewport.remove();
    });

    it('stops animation loop when nothing moves', () => {
        mount();
        expect(pendingFrames()).toBe(1);

        tick(2);
        expect(pendingFrames()).toBe(0);
    });

    // Component tests of applications run in jsdom, it has no ResizeObserver
    it('works without ResizeObserver', () => {
        vi.stubGlobal('ResizeObserver', undefined);
        try {
            const { sb, content } = mount();
            content.style.width = '2000px';
            sb.updateMetrics();
            sb.setPosition({ x: 1500 });
            tick();
            expect(sb.getState().position.x).toBe(1500);
            sb.destroy();
        } finally {
            vi.unstubAllGlobals();
        }
    });
});
