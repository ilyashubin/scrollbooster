import { describe, expect, it, vi } from 'vitest';
import { ScrollBooster } from '../src/index.ts';
import { mount, nextRender, pendingFrames, recordTrajectory, roundedPosition, tick } from './helpers.ts';

describe('setPosition', () => {
    it('moves content with transform in transform mode', () => {
        const { sb, content } = mount({ scrollMode: 'transform' });

        sb.setPosition({ x: 100, y: 50 });
        tick();

        expect(sb.getState().position).toEqual({ x: 100, y: 50 });
        expect(content.style.transform).toBe('translate(-100px, -50px)');
    });

    it('sets scrollLeft and scrollTop in native mode', () => {
        const { sb, viewport } = mount({ scrollMode: 'native' });

        sb.setPosition({ x: 100, y: 50 });
        tick();

        expect(viewport.scrollLeft).toBe(100);
        expect(viewport.scrollTop).toBe(50);
    });

    // Former test/scroll.test.js: scrolling via custom onUpdate handler
    it('passes position to onUpdate for custom rendering', () => {
        const { sb, viewport } = mount(({ viewport }) => ({
            onUpdate(state) {
                viewport.scrollTop = state.position.y;
                viewport.scrollLeft = state.position.x;
            },
        }));

        sb.setPosition({ x: 100, y: 100 });
        tick();

        expect(sb.getState().position).toEqual({ x: 100, y: 100 });
        expect(viewport.scrollTop).toBe(100);
        expect(viewport.scrollLeft).toBe(100);
    });

    it('keeps missing coordinate', () => {
        const { sb } = mount();

        sb.setPosition({ x: 100, y: 100 });
        sb.setPosition({ x: 40 });
        tick();

        expect(roundedPosition(sb)).toEqual({ x: 40, y: 100 });
    });

    it('renders with transform by default', () => {
        const { sb, content, viewport } = mount();

        sb.setPosition({ x: 100, y: 50 });
        tick();

        expect(content.style.transform).toBe('translate(-100px, -50px)');
        expect([viewport.scrollLeft, viewport.scrollTop]).toEqual([0, 0]);
    });

    it('does not touch DOM with scrollMode: none', () => {
        const { sb, content, viewport } = mount({ scrollMode: 'none' });

        sb.setPosition({ x: 100, y: 100 });
        tick();

        expect(content.style.transform).toBe('');
        expect(viewport.scrollTop).toBe(0);
    });

    it('clamps position to edges', () => {
        const { sb } = mount();

        sb.setPosition({ x: -100, y: 2000 });
        tick();

        expect(sb.getState().position).toEqual({ x: 0, y: 700 });
        expect(sb.getState().isMoving).toBe(false);
    });
});

describe('scrollTo', () => {
    it('smoothly scrolls to target and stops', () => {
        const onUpdate = vi.fn();
        const { sb } = mount({ onUpdate });

        sb.scrollTo({ x: 200, y: 100 });
        const trajectory = recordTrajectory(sb, 120, 10);

        expect(trajectory).toMatchSnapshot();
        expect(sb.getState().position).toEqual({ x: 200, y: 100 });

        tick(200);
        expect(sb.getState().isMoving).toBe(false);
        expect(pendingFrames()).toBe(0);
    });

    it('keeps missing coordinate', () => {
        const { sb } = mount();
        sb.setPosition({ x: 100, y: 200 });
        tick();

        sb.scrollTo({ x: 300 });
        tick(300);

        expect(sb.getState().position).toEqual({ x: 300, y: 200 });
    });

    it('keeps target of running scrollTo for missing coordinate', () => {
        const { sb } = mount();
        sb.scrollTo({ y: 500 });
        tick(2);

        sb.scrollTo({ x: 300 });
        tick(300);

        expect(sb.getState().position).toEqual({ x: 300, y: 500 });
    });

    it('settles missing coordinate within edges when content is beyond them', () => {
        const { sb, pointer } = mount();
        pointer.mouseDrag([100, 100], [100, 150], { release: false });
        tick(20);
        pointer.mouseUp(100, 150);
        expect(sb.getState().position.y).toBeLessThan(0);

        sb.scrollTo({ x: 300 });
        tick(300);

        expect(sb.getState().position).toEqual({ x: 300, y: 0 });
    });

    it.each(['never', 'always'] as const)('is ignored while dragging, reducedMotion: %s', (reducedMotion) => {
        const { sb, pointer } = mount({ reducedMotion });
        pointer.mouseDown(250, 250);
        pointer.mouseMove(200, 250);
        tick(60);

        sb.scrollTo({ x: 600 });
        tick();
        expect(roundedPosition(sb)).toEqual({ x: 50, y: 0 });

        pointer.mouseMove(150, 250);
        tick(60);
        expect(roundedPosition(sb)).toEqual({ x: 100, y: 0 });
    });
});

describe('scrollBy', () => {
    it('adds up calls during the running scroll', () => {
        const { sb } = mount();

        sb.scrollBy({ x: 300 });
        tick(3);
        sb.scrollBy({ x: 300 });
        tick(300);

        expect(sb.getState().position).toEqual({ x: 600, y: 0 });
    });

    it('scrolls from the current position', () => {
        const { sb } = mount();
        sb.setPosition({ x: 100, y: 200 });
        tick();

        sb.scrollBy({ y: -50 });
        tick(300);

        expect(sb.getState().position).toEqual({ x: 100, y: 150 });
    });

    it('stops at edges', () => {
        const { sb } = mount();

        sb.scrollBy({ x: 500 });
        sb.scrollBy({ x: 500 });
        tick(300);

        expect(sb.getState().position).toEqual({ x: 700, y: 0 });
    });

    it('jumps with reduced motion', () => {
        const { sb } = mount({ reducedMotion: 'always' });

        sb.scrollBy({ x: 300 });
        tick();

        expect(sb.getState().position).toEqual({ x: 300, y: 0 });
    });

    it('does nothing while dragging', () => {
        const { sb, pointer } = mount();
        pointer.mouseDown(100, 100);

        sb.scrollBy({ x: 300 });
        tick(100);

        expect(sb.getState().position).toEqual({ x: 0, y: 0 });
    });
});

describe('updateMetrics', () => {
    it('picks up changed content size', () => {
        const { sb, content } = mount();

        content.style.height = '2000px';
        sb.updateMetrics();

        expect(sb.getState().content.height).toBe(2000);
        expect(sb.getState().maxPosition.y).toBe(1700);
    });

    it('picks up content resize without window resize', async () => {
        const { sb, content } = mount();

        content.style.height = '2000px';
        await nextRender();

        expect(sb.getState().content.height).toBe(2000);
        expect(sb.getState().maxPosition.y).toBe(1700);
    });

    it('picks up viewport resize', async () => {
        const { sb, viewport } = mount();

        viewport.style.width = '500px';
        await nextRender();

        expect(sb.getState().viewport.width).toBe(500);
        expect(sb.getState().maxPosition.x).toBe(500);
    });

    it('skips onUpdate when observed sizes did not change', async () => {
        const onUpdate = vi.fn();
        mount({ onUpdate });
        onUpdate.mockClear();

        await nextRender();

        expect(onUpdate).not.toHaveBeenCalled();
    });
});

describe('animation loop', () => {
    it('requests no frame after motion stops', () => {
        const { sb } = mount();

        sb.setPosition({ x: 10 });
        tick();

        expect(sb.getState().isMoving).toBe(false);
        expect(pendingFrames()).toBe(0);
    });

    it('keeps a single loop when onUpdate starts motion on the last frame', () => {
        let restarted = false;
        const { sb } = mount(() => ({
            onUpdate(state) {
                if (!state.isMoving && state.position.x === 10 && !restarted) {
                    restarted = true;
                    sb.scrollTo({ x: 100 });
                }
            },
        }));

        sb.setPosition({ x: 10 });
        tick();

        expect(restarted).toBe(true);
        expect(pendingFrames()).toBe(1);
    });
});

describe('getState', () => {
    it('returns objects that are not changed by later motion', () => {
        const { sb, pointer } = mount();
        pointer.mouseDrag([200, 200], [150, 200], { release: false });
        const state = sb.getState();
        const snapshot = structuredClone(state);

        pointer.mouseMove(100, 150);
        tick(10);

        expect(state).toEqual(snapshot);
    });

    it('returns objects that do not change the instance', () => {
        const { sb, pointer } = mount();
        pointer.mouseDrag([200, 200], [180, 200], { steps: 2, release: false });

        const state = sb.getState();
        state.dragOffset.x = 0;
        state.position.x = 500;
        state.viewport.width = 0;
        state.content.width = 0;

        expect(sb.getState().dragOffset).toEqual({ x: -20, y: 0 });
        expect(sb.getState().position.x).toBeLessThan(30);
        expect(sb.getState().viewport.width).toBe(300);
        expect(sb.getState().content.width).toBe(1000);
    });

    it('reports sizes and scroll range', () => {
        const { sb } = mount({}, { width: 300, height: 200, contentWidth: 250, contentHeight: 800 });

        expect(sb.getState()).toMatchObject({
            viewport: { width: 300, height: 200 },
            content: { width: 250, height: 800 },
            maxPosition: { x: 0, y: 600 },
        });
    });

    it('reports border collisions', () => {
        const { sb } = mount();

        expect(sb.getState().borderCollision).toEqual({ left: true, right: false, top: true, bottom: false });

        sb.setPosition({ x: 700, y: 700 });
        tick();
        expect(sb.getState().borderCollision).toEqual({ left: false, right: true, top: false, bottom: true });

        sb.setPosition({ x: 300, y: 300 });
        tick();
        expect(sb.getState().borderCollision).toEqual({ left: false, right: false, top: false, bottom: false });
    });
});

describe('page as viewport', () => {
    it('follows page scroll by the browser', async () => {
        const spacer = document.createElement('div');
        spacer.style.height = '3000px';
        document.body.append(spacer);
        const sb = new ScrollBooster({
            viewport: document.documentElement,
            content: document.body,
            scrollMode: 'native',
            direction: 'vertical',
        });
        try {
            window.scrollTo(0, 500);
            await nextRender();
            tick();
            expect(sb.getState().position.y).toBe(500);

            sb.setPosition({ y: 800 });
            tick();
            expect(window.scrollY).toBe(800);
        } finally {
            sb.destroy();
            spacer.remove();
            window.scrollTo(0, 0);
        }
    });
});
