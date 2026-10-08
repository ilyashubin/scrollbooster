import { describe, expect, it, vi } from 'vitest';
import ScrollBooster from '../src/index.js';
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

    it('logs an error when viewport is not an element', () => {
        const error = vi.spyOn(console, 'error').mockImplementation(() => {});
        // viewport.children is read before validation, so a non-element object with children is needed here
        new ScrollBooster({ viewport: { children: [] } });

        expect(error).toHaveBeenCalledWith(expect.stringContaining('"viewport" config property must be present'));
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
            position: { x: -0, y: -0 },
            dragOffset: { x: 0, y: 0 },
            dragAngle: 0,
            borderCollision: { left: true, right: false, top: true, bottom: false },
        });
    });

    it('stops animation loop when nothing moves', () => {
        mount();
        expect(pendingFrames()).toBe(1);

        tick(2);
        expect(pendingFrames()).toBe(0);
    });
});
