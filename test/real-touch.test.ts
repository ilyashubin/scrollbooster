/**
 * Real touch input through Chrome DevTools Protocol: touch-action, page scroll by a swipe that the content does
 * not take and pointercancel cannot be reproduced with synthetic events. Chromium only.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { commands, server, userEvent } from 'vitest/browser';
import { ScrollBooster } from '../src/index.ts';
import { type Coords, createFixture, mount, roundedPosition, tick } from './helpers.ts';

// Client coordinates of a point relative to element top left corner
function at(element: Element, x: number, y: number): Coords {
    const rect = element.getBoundingClientRect();
    return [rect.left + x, rect.top + y];
}

/**
 * Swipe from one point to another in equal steps, one animation frame per step
 */
async function swipe(from: Coords, to: Coords, steps = 10) {
    await commands.touch([['start', ...from]], window.innerWidth);
    for (let i = 1; i <= steps; i++) {
        const x = from[0] + ((to[0] - from[0]) * i) / steps;
        const y = from[1] + ((to[1] - from[1]) * i) / steps;
        await commands.touch([['move', x, y]], window.innerWidth);
        tick();
    }
    await commands.touch([['end']], window.innerWidth);
}

// Wait for asynchronous page scroll that follows the gesture
const settle = () => new Promise((resolve) => setTimeout(resolve, 300));

describe.runIf(server.browser === 'chromium')('real touch', () => {
    // Page taller than the window, so a swipe that the content does not take scrolls the page
    let spacer: HTMLElement;
    beforeEach(() => {
        spacer = document.createElement('div');
        spacer.style.height = '3000px';
    });
    // Page fling after a swipe outlives the test, the next test must not see it
    afterEach(async () => {
        let scrollY: number;
        do {
            scrollY = window.scrollY;
            await settle();
        } while (window.scrollY !== scrollY);
        spacer.remove();
        window.scrollTo(0, 0);
    });

    it('swipe along direction drags content and not the page', async () => {
        const onPointerUp = vi.fn();
        const { sb, viewport } = mount({ direction: 'horizontal', onPointerUp });
        document.body.append(spacer);

        await swipe(at(viewport, 250, 150), at(viewport, 50, 150));
        await settle();

        expect(onPointerUp).toHaveBeenCalledTimes(1);
        expect(onPointerUp.mock.calls[0][1].type).toBe('pointerup');
        expect(onPointerUp.mock.calls[0][0].dragOffset).toEqual({ x: -200, y: 0 });
        expect(sb.getState().position.x).toBeGreaterThan(0);
        expect(sb.getState().position.y).toBe(0);
        expect(window.scrollY).toBe(0);
    });

    it('swipe drags content on both axes with direction all', async () => {
        const onPointerUp = vi.fn();
        const { sb, viewport } = mount({ onPointerUp });
        document.body.append(spacer);

        await swipe(at(viewport, 250, 250), at(viewport, 100, 50));
        await settle();

        expect(onPointerUp.mock.calls[0][1].type).toBe('pointerup');
        expect(onPointerUp.mock.calls[0][0].dragOffset).toEqual({ x: -150, y: -200 });
        expect(sb.getState().position.x).toBeGreaterThan(0);
        expect(sb.getState().position.y).toBeGreaterThan(0);
        expect(window.scrollY).toBe(0);
    });

    it('swipe across direction scrolls the page and cancels the press', async () => {
        const onPointerUp = vi.fn();
        const { sb, viewport } = mount({ direction: 'horizontal', onPointerUp });
        document.body.append(spacer);

        await swipe(at(viewport, 150, 250), at(viewport, 150, 50));
        await settle();

        expect(onPointerUp).toHaveBeenCalledTimes(1);
        expect(onPointerUp.mock.calls[0][1].type).toBe('pointercancel');
        expect(sb.getState().isDragging).toBe(false);
        expect(roundedPosition(sb)).toEqual({ x: 0, y: 0 });
        expect(window.scrollY).toBeGreaterThan(0);
    });

    it('pointerMode mouse leaves touch to the browser', async () => {
        const onPointerDown = vi.fn();
        const { sb, viewport } = mount({ pointerMode: 'mouse', onPointerDown });
        document.body.append(spacer);

        await swipe(at(viewport, 150, 250), at(viewport, 150, 50));
        await settle();

        expect(onPointerDown).not.toHaveBeenCalled();
        expect(roundedPosition(sb)).toEqual({ x: 0, y: 0 });
        expect(window.scrollY).toBeGreaterThan(0);
    });

    // touch-action of the row and the outer viewport intersect to pinch-zoom, both axes come as pointer events
    it.each([
        ['horizontal', [150, 50], [30, 50], 'row'],
        ['vertical', [100, 90], [100, 10], 'outer'],
    ] as const)('%s swipe on a nested row moves the %s', async (_, from, to, moved) => {
        const outer = mount({ direction: 'vertical' });
        const row = createFixture({ width: 200, height: 100, contentWidth: 1000, contentHeight: 100 });
        outer.content.prepend(row.viewport);
        const inner = new ScrollBooster({ viewport: row.viewport, direction: 'horizontal' });
        document.body.append(spacer);

        await swipe(at(row.viewport, from[0], from[1]), at(row.viewport, to[0], to[1]));
        await settle();
        inner.destroy();

        const [movedSb, still] = moved === 'row' ? [inner, outer.sb] : [outer.sb, inner];
        const { x, y } = movedSb.getState().position;
        expect(x + y).toBeGreaterThan(50);
        expect(roundedPosition(still)).toEqual({ x: 0, y: 0 });
        expect(window.scrollY).toBe(0);
    });

    it('pointerMode mouse with native mode leaves touch scroll of content to the browser', async () => {
        const onPointerDown = vi.fn();
        const { sb, viewport } = mount(
            { pointerMode: 'mouse', scrollMode: 'native', onPointerDown },
            { overflow: 'auto' }
        );

        await swipe(at(viewport, 150, 250), at(viewport, 150, 50));
        // Native fling of the viewport ends
        let scrollTop: number;
        do {
            scrollTop = viewport.scrollTop;
            await settle();
        } while (viewport.scrollTop !== scrollTop);
        tick();

        expect(onPointerDown).not.toHaveBeenCalled();
        expect(viewport.scrollTop).toBeGreaterThan(100);
        expect(sb.getState().position.y).toBe(viewport.scrollTop);
    });

    it('tap reaches content element', async () => {
        const onClick = vi.fn();
        const { content, viewport } = mount({ onClick });
        const onContentClick = vi.fn();
        content.addEventListener('click', onContentClick);

        await commands.touch([['start', ...at(viewport, 150, 150)], ['end']], window.innerWidth);

        expect(onContentClick).toHaveBeenCalledTimes(1);
        expect(onClick).toHaveBeenCalledTimes(1);
        expect(onClick.mock.calls[0][1].defaultPrevented).toBe(false);
    });

    // Browser still recognizes a tap within its touch slop, larger than the click threshold
    it('prevents tap click after drag past click threshold', async () => {
        const onClick = vi.fn();
        const { viewport } = mount({ onClick });

        await swipe(at(viewport, 150, 150), at(viewport, 140, 150), 2);
        await settle();

        expect(onClick).toHaveBeenCalledTimes(1);
        expect(onClick.mock.calls[0][1].defaultPrevented).toBe(true);
    });

    it('drag within tap distance does not click the element under the finger', async () => {
        const onClick = vi.fn();
        const { content, viewport } = mount({ onClick });
        const onContentClick = vi.fn();
        content.addEventListener('click', onContentClick);

        await swipe(at(viewport, 150, 150), at(viewport, 140, 150), 2);
        await settle();

        expect(onContentClick).not.toHaveBeenCalled();
        expect(onClick).toHaveBeenCalledTimes(1);
        expect(onClick.mock.calls[0][1].target).toBe(content);
    });

    it('keyboard activates a link after swipe', async () => {
        const { content, viewport } = mount();
        const link = document.createElement('a');
        link.href = '#swiped';
        link.textContent = 'Link';
        content.prepend(link);

        await swipe(at(viewport, 250, 150), at(viewport, 50, 150));
        await settle();
        link.focus();
        await userEvent.keyboard('{Enter}');

        expect(location.hash).toBe('#swiped');
        history.replaceState(null, '', location.pathname + location.search);
    });
});
