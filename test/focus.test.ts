import { describe, expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';
import { ScrollBooster } from '../src/index.ts';
import { createFixture, mount, nextRender, tick } from './helpers.ts';

// Text inputs at given content coordinates, WebKit on macOS moves focus with Tab only between form fields
function addInputs(content: HTMLElement, positions: [x: number, y: number][]) {
    return positions.map(([x, y]) => {
        const input = document.createElement('input');
        input.style.cssText = `position: absolute; left: ${x}px; top: ${y}px; width: 50px; height: 20px;`;
        content.style.position = 'relative';
        content.append(input);
        return input;
    });
}

// Translation of content from its computed translate property, `none` or one or two lengths
function translation(content: HTMLElement) {
    const { translate } = getComputedStyle(content);
    const [x = 0, y = 0] = translate === 'none' ? [] : translate.split(' ').map(Number.parseFloat);
    return { x, y };
}

function expectVisible(viewport: HTMLElement, element: Element, width = 50, height = 20) {
    const { left, top } = offsetIn(viewport, element);
    expect(left).toBeGreaterThanOrEqual(0);
    expect(left + width).toBeLessThanOrEqual(viewport.clientWidth);
    expect(top).toBeGreaterThanOrEqual(0);
    expect(top + height).toBeLessThanOrEqual(viewport.clientHeight);
}

// Element position relative to viewport client area
function offsetIn(viewport: HTMLElement, element: Element) {
    const box = viewport.getBoundingClientRect();
    const rect = element.getBoundingClientRect();
    return { left: rect.left - box.left - viewport.clientLeft, top: rect.top - box.top - viewport.clientTop };
}

describe('focus in transform mode', () => {
    // Browsers may scroll viewport natively on focus before focusin, then the scroll event moves it into transform
    it('reveals element beyond the end of viewport', async () => {
        const { sb, content, viewport } = mount({ scrollMode: 'transform' });
        const [input] = addInputs(content, [[600, 500]]);

        input.focus();
        await nextRender();

        expectVisible(viewport, input);
        expect(viewport.scrollLeft).toBe(0);
        expect(viewport.scrollTop).toBe(0);
        expect(sb.getState().position.x).toBeGreaterThan(0);
    });

    it('reveals element before the start of viewport', () => {
        const { sb, content, viewport } = mount({ scrollMode: 'transform' });
        const [input] = addInputs(content, [[100, 100]]);
        sb.setPosition({ x: 500, y: 500 });
        tick();

        input.focus();

        expect(offsetIn(viewport, input)).toEqual({ left: 0, top: 0 });
        expect(sb.getState().position).toEqual({ x: 100, y: 100 });
    });

    it('reveals the start of element larger than viewport', async () => {
        const { sb, content, viewport } = mount({ scrollMode: 'transform' });
        const [input] = addInputs(content, [[200, 100]]);
        input.style.width = '500px';

        input.focus();
        await nextRender();

        expect(offsetIn(viewport, input).left).toBe(0);
        expect(sb.getState().position.x).toBe(200);
    });

    it('moves only along allowed direction', async () => {
        const { sb, content } = mount({ scrollMode: 'transform', direction: 'vertical' });
        const [input] = addInputs(content, [[600, 500]]);

        input.focus();
        await nextRender();

        expect(sb.getState().position.x).toBe(0);
        expect(sb.getState().position.y).toBeGreaterThan(0);
    });

    it('follows real Tab key', async () => {
        const { content, viewport } = mount({ scrollMode: 'transform' });
        const inputs = addInputs(content, [
            [10, 10],
            [700, 10],
            [10, 700],
        ]);
        inputs[0].focus();

        for (const input of inputs.slice(1)) {
            await userEvent.tab();
            await nextRender();
            expect(document.activeElement).toBe(input);
            expectVisible(viewport, input);
        }
        await userEvent.tab({ shift: true });
        await userEvent.tab({ shift: true });
        await nextRender();
        expect(document.activeElement).toBe(inputs[0]);
        expectVisible(viewport, inputs[0]);
        expect(viewport.scrollLeft).toBe(0);
        expect(viewport.scrollTop).toBe(0);
    });

    it('leaves native mode to the browser', async () => {
        const { sb, content, viewport } = mount({ scrollMode: 'native' });
        const [input] = addInputs(content, [[600, 500]]);

        input.focus();
        // WebKit dispatches scroll event of focus scroll one rendering update later
        await nextRender();
        await nextRender();

        expectVisible(viewport, input);
        expect(content.style.translate).toBe('');
        expect(sb.getState().position).toEqual({ x: viewport.scrollLeft, y: viewport.scrollTop });
    });
});

describe('native scroll in transform mode', () => {
    it('is moved into transform', async () => {
        const { sb, viewport, content } = mount({ scrollMode: 'transform' });

        viewport.scrollLeft = 200;
        await nextRender();

        expect(viewport.scrollLeft).toBe(0);
        expect(sb.getState().position.x).toBe(200);
        expect(translation(content)).toEqual({ x: -200, y: 0 });
    });

    it('is moved into transform on init', () => {
        const { viewport, content } = createFixture();
        viewport.scrollTop = 150;
        const sb = new ScrollBooster({ viewport, scrollMode: 'transform' });
        tick();

        expect(viewport.scrollTop).toBe(0);
        expect(sb.getState().position.y).toBe(150);
        expect(translation(content)).toEqual({ x: 0, y: -150 });
        sb.destroy();
        viewport.remove();
    });

    it('is reset at once with scroll-behavior: smooth', async () => {
        const { sb, viewport, content } = mount({ scrollMode: 'transform' });
        viewport.style.scrollBehavior = 'smooth';

        viewport.scrollTo({ left: 200, behavior: 'instant' });
        await nextRender();

        expect(viewport.scrollLeft).toBe(0);
        expect(sb.getState().position.x).toBe(200);
        expect(translation(content)).toEqual({ x: -200, y: 0 });
    });
});
