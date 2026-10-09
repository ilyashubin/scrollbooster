/**
 * Real mouse input through Playwright: browser default actions, pointer capture, click targets and page scroll
 * by wheel cannot be reproduced with synthetic events.
 */
import { describe, expect, it, vi } from 'vitest';
import { commands } from 'vitest/browser';
import type { MouseStep } from './commands/mouse.ts';
import { type Coords, mount, roundedPosition, tick } from './helpers.ts';

// Client coordinates of a point relative to element top left corner
function at(element: Element, x: number, y: number): Coords {
    const rect = element.getBoundingClientRect();
    return [rect.left + x, rect.top + y];
}

function drag(from: Coords, to: Coords, steps = 10) {
    const moves = Array.from(
        { length: steps },
        (_, i): MouseStep => [
            'move',
            from[0] + ((to[0] - from[0]) * (i + 1)) / steps,
            from[1] + ((to[1] - from[1]) * (i + 1)) / steps,
        ]
    );
    return commands.mouse([['move', ...from], ['down'], ...moves, ['up']], window.innerWidth);
}

function click(point: Coords) {
    return commands.mouse([['move', ...point], ['down'], ['up']], window.innerWidth);
}

// Row across the whole content, so pointerdown and pointerup land on it before and after drag
function addRow(content: HTMLElement) {
    const row = document.createElement('div');
    row.style.cssText = 'height: 100px; background: #ddd; font: 20px/100px monospace;';
    row.textContent = 'Some text in a row that can be selected';
    content.prepend(row);
    return row;
}

describe('real mouse', () => {
    it('click without movement reaches content element', async () => {
        const { content } = mount();
        const row = addRow(content);
        const onRowClick = vi.fn();
        row.addEventListener('click', onRowClick);

        await click(at(row, 150, 50));

        expect(onRowClick).toHaveBeenCalledTimes(1);
    });

    it('click with movement within click threshold reaches content element', async () => {
        const { content } = mount();
        const row = addRow(content);
        const onRowClick = vi.fn();
        row.addEventListener('click', onRowClick);

        const [x, y] = at(row, 150, 50);
        await commands.mouse(
            [['move', x, y], ['down'], ['move', x + 2, y], ['move', x + 4, y + 1], ['up']],
            window.innerWidth
        );

        expect(onRowClick).toHaveBeenCalledTimes(1);
    });

    it('click after drag goes to viewport and is prevented', async () => {
        const onClick = vi.fn();
        const { content, viewport } = mount({ onClick });
        const row = addRow(content);
        const onRowClick = vi.fn();
        row.addEventListener('click', onRowClick);

        await drag(at(row, 250, 50), at(row, 150, 50));

        expect(onRowClick).not.toHaveBeenCalled();
        expect(onClick).toHaveBeenCalledTimes(1);
        expect(onClick.mock.calls[0][1].target).toBe(viewport);
        expect(onClick.mock.calls[0][1].defaultPrevented).toBe(true);
    });

    it('drag does not select text', async () => {
        const { content } = mount();
        const row = addRow(content);

        await drag(at(row, 250, 50), at(row, 50, 50));

        expect(document.getSelection()?.toString()).toBe('');
    });

    it.each([
        [
            'image',
            () => {
                const image = document.createElement('img');
                image.src = `data:image/svg+xml,${encodeURIComponent(
                    '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="100"><rect width="300" height="100"/></svg>'
                )}`;
                return image;
            },
        ],
        [
            'link',
            () => {
                const link = document.createElement('a');
                link.href = '#link';
                link.textContent = 'Link that can be dragged natively';
                return link;
            },
        ],
    ])('drag from %s does not start native drag', async (_, create) => {
        const onPointerUp = vi.fn();
        const { content } = mount({ onPointerUp });
        const element = create();
        element.style.cssText = 'display: block; width: 300px; height: 100px; font: 20px/100px monospace;';
        content.prepend(element);
        if (element instanceof HTMLImageElement) {
            await element.decode();
        }

        await drag(at(element, 250, 50), at(element, 50, 50));

        expect(onPointerUp).toHaveBeenCalledTimes(1);
        expect(onPointerUp.mock.calls[0][1].type).toBe('pointerup');
        expect(onPointerUp.mock.calls[0][0].dragOffset).toEqual({ x: -200, y: 0 });
    });

    it('textSelection: drag over text selects it and keeps content in place', async () => {
        const { sb, content } = mount({ textSelection: true });
        const row = addRow(content);

        await drag(at(row, 50, 50), at(row, 250, 50));

        expect(document.getSelection()?.toString()).not.toBe('');
        expect(sb.getState().position).toEqual({ x: 0, y: 0 });
    });

    it.each([
        [false, ''],
        [true, 'Some'],
    ])('textSelection %s: double click on a word selects %j', async (textSelection, word) => {
        const { content } = mount({ textSelection });
        const row = addRow(content);

        const [x, y] = at(row, 20, 50);
        await commands.mouse([['move', x, y], ['dblclick']], window.innerWidth);

        expect(document.getSelection()?.toString().trim()).toBe(word);
    });

    it.each([false, true])(
        'textSelection %s: press drops the selection like elsewhere on the page',
        async (textSelection) => {
            const { viewport } = mount({ textSelection });
            const text = document.createElement('p');
            text.textContent = 'Text outside of viewport';
            document.body.prepend(text);
            document.getSelection()?.selectAllChildren(text);

            await click(at(viewport, 150, 250));

            expect(document.getSelection()?.toString()).toBe('');
            text.remove();
        }
    );

    it('press moves focus like a click outside of viewport', async () => {
        const { content } = mount();
        const row = addRow(content);
        const input = document.createElement('input');
        document.body.prepend(input);
        input.focus();

        await click(at(row, 150, 50));

        expect(document.activeElement).not.toBe(input);
        input.remove();
    });

    it('focus by the press that drags keeps content under the pointer', async () => {
        const { sb, content } = mount();
        // Focusable element partly beyond the right edge of viewport
        const card = document.createElement('div');
        card.tabIndex = 0;
        card.style.cssText = 'margin-left: 200px; width: 300px; height: 100px; background: #ddd;';
        content.prepend(card);

        await click(at(card, 50, 50));
        tick(100);

        expect(document.activeElement).toBe(card);
        expect(sb.getState().position).toEqual({ x: 0, y: 0 });
    });

    it('keeps dragging outside of viewport until release', async () => {
        const onPointerUp = vi.fn();
        const { sb, viewport } = mount({ onPointerUp });

        await drag(at(viewport, 150, 250), at(viewport, 150, 450));

        expect(sb.getState().isDragging).toBe(false);
        expect(onPointerUp).toHaveBeenCalledTimes(1);
        expect(onPointerUp.mock.calls[0][0].dragOffset).toEqual({ x: 0, y: 200 });
    });
});

describe('real wheel', () => {
    // Page taller than the window, so a wheel that the content does not take scrolls the page
    function scrollablePage() {
        const spacer = document.createElement('div');
        spacer.style.height = '3000px';
        document.body.append(spacer);
        window.scrollTo(0, 0);
        return () => {
            spacer.remove();
            window.scrollTo(0, 0);
        };
    }

    it('scrolls content and not the page', async () => {
        const { sb, viewport } = mount();
        const restore = scrollablePage();

        await commands.mouse(
            [
                ['move', ...at(viewport, 150, 150)],
                ['wheel', 0, 100],
            ],
            window.innerWidth
        );
        tick();

        expect(roundedPosition(sb).y).toBeGreaterThan(0);
        // Page scroll by wheel is asynchronous, the other test sees it within this time
        await new Promise((resolve) => setTimeout(resolve, 500));
        expect(window.scrollY).toBe(0);
        restore();
    });

    it('scrolls the page when content is at the edge', async () => {
        const { sb, viewport } = mount();
        const restore = scrollablePage();

        sb.setPosition({ y: 700 });
        tick();

        await commands.mouse(
            [
                ['move', ...at(viewport, 150, 150)],
                ['wheel', 0, 100],
            ],
            window.innerWidth
        );
        tick();

        expect(roundedPosition(sb)).toEqual({ x: 0, y: 700 });
        await expect.poll(() => window.scrollY, { timeout: 1000 }).toBeGreaterThan(0);
        restore();
    });
});
