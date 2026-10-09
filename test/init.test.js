import { describe, expect, it, vi } from 'vitest';
import ScrollBooster from '../src/index.ts';
import { createFixture, mount, pendingFrames, tick } from './helpers.js';

describe('init', () => {
    it('reads viewport and content metrics', () => {
        const { sb } = mount({}, { width: 300, height: 200, contentWidth: 1000, contentHeight: 800 });

        expect(sb.viewport).toEqual({ width: 300, height: 200 });
        expect(sb.content).toEqual({ width: 1000, height: 800 });
        expect(sb.edgeX).toEqual({ from: -700, to: 0 });
        expect(sb.edgeY).toEqual({ from: -600, to: 0 });
    });

    it('uses first viewport child as content by default', () => {
        const { sb, content } = mount();

        expect(sb.props.content).toBe(content);
    });

    it('accepts explicit content element', () => {
        const { viewport } = createFixture();
        const inner = document.createElement('div');
        viewport.firstElementChild.append(inner);
        const sb = new ScrollBooster({ viewport, content: inner });

        expect(sb.props.content).toBe(inner);
        sb.destroy();
        viewport.remove();
    });

    it('has zero edges when content is smaller than viewport', () => {
        const { sb } = mount({}, { contentWidth: 100, contentHeight: 100 });

        expect(sb.edgeX).toEqual({ from: 0, to: 0 });
        expect(sb.edgeY).toEqual({ from: 0, to: 0 });
    });

    it('applies default options', () => {
        const { sb } = mount();

        expect(sb.props).toMatchObject({
            direction: 'all',
            pointerMode: 'all',
            scrollMode: undefined,
            bounce: true,
            bounceForce: 0.1,
            friction: 0.05,
            textSelection: false,
            inputsFocus: true,
            emulateScroll: false,
            preventDefaultOnEmulateScroll: false,
            lockScrollOnDragDirection: false,
            pointerDownPreventDefault: true,
            dragDirectionTolerance: 40,
        });
    });

    it.each([
        ['without options', undefined, 'options must be an object'],
        ['without viewport', {}, 'option "viewport" must be an HTMLElement'],
        ['with non-element viewport', { viewport: { children: [] } }, 'option "viewport" must be an HTMLElement'],
    ])('throws TypeError %s', (_, options, message) => {
        expect(() => new ScrollBooster(options)).toThrow(new TypeError(`ScrollBooster: ${message}`));
    });

    it('throws TypeError when viewport has no child element', () => {
        const viewport = document.createElement('div');
        document.body.append(viewport);

        expect(() => new ScrollBooster({ viewport })).toThrow('viewport has no child element');
        viewport.remove();
    });

    it.each([
        ['viewport itself', ({ viewport }) => viewport],
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
});
