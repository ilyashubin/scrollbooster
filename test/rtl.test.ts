/**
 * Right-to-left viewport: content starts at the right edge. Position is logical, `x` is the distance from the
 * start edge and grows to the left, so code written for left-to-right works unchanged.
 */
import { describe, expect, it } from 'vitest';
import type { ScrollBoosterOptions, ScrollMode } from '../src/index.ts';
import { mount, nextRender, roundedPosition, tick, wheel } from './helpers.ts';

function mountRtl(options: Partial<ScrollBoosterOptions> = {}) {
    const mounted = mount(({ viewport }) => {
        viewport.style.direction = 'rtl';
        return options;
    });
    // Distance from the right edge of content to the right edge of viewport, the start edges in right-to-left
    const offset = () =>
        Math.round(mounted.content.getBoundingClientRect().right - mounted.viewport.getBoundingClientRect().right);
    return { ...mounted, offset };
}

describe.each(['transform', 'native'] as ScrollMode[])('right-to-left viewport, scrollMode: %s', (scrollMode) => {
    it('starts at the right edge of content', () => {
        const { sb, offset } = mountRtl({ scrollMode });
        tick();

        expect(offset()).toBe(0);
        expect(sb.getState()).toMatchObject({
            position: { x: 0, y: 0 },
            maxPosition: { x: 700, y: 700 },
            borderCollision: { left: false, right: true },
        });
    });

    it('drag to the right moves towards the end of content', () => {
        const { sb, pointer, offset } = mountRtl({ scrollMode, bounce: false });

        pointer.mouseDrag([50, 150], [250, 150], { release: false });
        tick(30);

        expect(roundedPosition(sb, 0)).toEqual({ x: 200, y: 0 });
        expect(offset()).toBe(200);
    });

    it('drag to the left stops at the start edge', () => {
        const { sb, pointer, offset } = mountRtl({ scrollMode, bounce: false });

        pointer.mouseDrag([250, 150], [50, 150]);
        tick(100);

        expect(roundedPosition(sb)).toEqual({ x: 0, y: 0 });
        expect(offset()).toBe(0);
    });

    it('setPosition at the end shows the left edge of content', () => {
        const { sb, viewport, content } = mountRtl({ scrollMode });

        sb.setPosition({ x: 700 });
        tick();

        expect(content.getBoundingClientRect().left).toBe(viewport.getBoundingClientRect().left);
        expect(sb.getState().borderCollision).toMatchObject({ left: true, right: false });
    });

    it('wheel to the left moves towards the end of content', () => {
        const { sb, viewport, offset } = mountRtl({ scrollMode });

        expect(wheel(viewport, 100, 0).defaultPrevented).toBe(false);
        expect(wheel(viewport, -100, 0).defaultPrevented).toBe(true);
        tick();

        expect(roundedPosition(sb)).toEqual({ x: 100, y: 0 });
        expect(offset()).toBe(100);
    });
});

describe('right-to-left viewport', () => {
    it('native mode writes negative scrollLeft', () => {
        const { sb, viewport } = mountRtl({ scrollMode: 'native' });

        sb.setPosition({ x: 300 });
        tick();

        expect(viewport.scrollLeft).toBe(-300);
    });

    it('native mode follows scroll by the browser', async () => {
        const { sb, viewport } = mountRtl({ scrollMode: 'native' });

        viewport.scrollLeft = -250;
        await nextRender();

        expect(roundedPosition(sb)).toEqual({ x: 250, y: 0 });
    });

    it('keeps scroll position of already scrolled viewport', () => {
        const { sb } = mount(({ viewport }) => {
            viewport.style.direction = 'rtl';
            viewport.scrollLeft = -150;
            return { scrollMode: 'native' };
        });

        expect(roundedPosition(sb)).toEqual({ x: 150, y: 0 });
    });

    it('transform mode moves native scroll by the browser into transform', async () => {
        const { sb, viewport, offset } = mountRtl({ scrollMode: 'transform' });

        viewport.scrollLeft = -250;
        await nextRender();

        expect(viewport.scrollLeft).toBe(0);
        expect(roundedPosition(sb)).toEqual({ x: 250, y: 0 });
        expect(offset()).toBe(250);
    });

    it('transform mode reveals focused element at the end of content', async () => {
        const { sb, viewport, content } = mountRtl({ scrollMode: 'transform' });
        const input = document.createElement('input');
        input.style.cssText = 'position: absolute; left: 100px; top: 0; width: 50px; height: 20px;';
        content.style.position = 'relative';
        content.append(input);

        input.focus();
        await nextRender();

        const box = viewport.getBoundingClientRect();
        const rect = input.getBoundingClientRect();
        expect(rect.left).toBeGreaterThanOrEqual(box.left);
        expect(rect.right).toBeLessThanOrEqual(box.right);
        expect(sb.getState().position.x).toBeGreaterThan(0);
    });

    it('follows direction change on updateMetrics', () => {
        const { sb, viewport, content } = mount({ scrollMode: 'transform' });
        sb.setPosition({ x: 100 });
        tick();

        viewport.style.direction = 'rtl';
        sb.updateMetrics();
        tick();

        expect(roundedPosition(sb)).toEqual({ x: 100, y: 0 });
        expect(Math.round(content.getBoundingClientRect().right - viewport.getBoundingClientRect().right)).toBe(100);
    });
});
