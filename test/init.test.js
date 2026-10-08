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
            preventPointerMoveDefault: true,
            lockScrollOnDragDirection: false,
            pointerDownPreventDefault: true,
            dragDirectionTolerance: 40,
        });
    });

    it.each([
        ['without options', undefined],
        ['without viewport', {}],
        ['with non-element viewport', { viewport: { children: [] } }],
    ])('logs an error instead of throwing %s', (_, options) => {
        const error = vi.spyOn(console, 'error').mockImplementation(() => {});

        expect(() => new ScrollBooster(options)).not.toThrow();
        expect(error).toHaveBeenCalledWith(expect.stringContaining('"viewport" config property must be present'));
    });

    it('keeps instance with invalid options inert', () => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
        const sb = new ScrollBooster({});

        expect(() => {
            sb.updateOptions({ friction: 0.1 });
            sb.updateMetrics();
            sb.setPosition({ x: 10 });
            sb.scrollTo({ x: 10 });
            sb.destroy();
        }).not.toThrow();
        expect(pendingFrames()).toBe(0);
    });

    it('logs an error when viewport has no content', () => {
        const error = vi.spyOn(console, 'error').mockImplementation(() => {});
        const viewport = document.createElement('div');
        document.body.append(viewport);
        new ScrollBooster({ viewport });

        expect(error).toHaveBeenCalledWith(expect.stringContaining('Viewport does not have any content'));
        viewport.remove();
    });

    it('calls onUpdate synchronously with initial state', () => {
        const onUpdate = vi.fn();
        mount({ onUpdate });

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
