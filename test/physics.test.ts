import { afterEach, describe, expect, it, vi } from 'vitest';
import { commands } from 'vitest/browser';
import type { ScrollBooster } from '../src/index.ts';
import {
    type Mounted,
    mount,
    nextRender,
    pendingFrames,
    recordTrajectory,
    roundedPosition,
    tick,
    wheel,
} from './helpers.ts';

describe('inertia', () => {
    it('keeps moving after release and stops', () => {
        const { sb, pointer } = mount();

        pointer.mouseDrag([250, 250], [150, 200], { steps: 5 });
        const atRelease = sb.getState().position;
        tick(1);

        expect(sb.getState().isMoving).toBe(true);
        expect(sb.getState().position.x).toBeGreaterThan(atRelease.x);

        tick(300);
        expect(sb.getState().isMoving).toBe(false);
        expect(pendingFrames()).toBe(0);
    });

    it('travels farther with lower friction', () => {
        const travel = (friction: number) => {
            const { sb, pointer } = mount({ friction });
            pointer.mouseDrag([250, 250], [200, 250], { steps: 5 });
            tick(300);
            return sb.getState().position.x;
        };

        expect(travel(0.02)).toBeGreaterThan(travel(0.1));
    });

    it('matches recorded trajectory', () => {
        const { sb, pointer } = mount();

        pointer.mouseDrag([250, 250], [150, 200], { steps: 5 });

        expect(recordTrajectory(sb, 100, 5)).toMatchSnapshot();
    });
});

describe('bounce', () => {
    it('lets content go beyond edges while dragging and returns after release', () => {
        const { sb, pointer } = mount();

        pointer.mouseDrag([100, 100], [200, 150], { release: false });
        tick(50);
        expect(roundedPosition(sb)).toEqual({ x: -100, y: -50 });
        expect(sb.getState().borderCollision).toMatchObject({ left: true, top: true });

        pointer.mouseUp(200, 150);
        const trajectory = recordTrajectory(sb, 100, 5);

        expect(trajectory).toMatchSnapshot();
        expect(sb.getState().position).toEqual({ x: 0, y: 0 });
    });

    it('returns from the far edge after a fling', () => {
        const { sb, pointer } = mount();
        sb.setPosition({ x: 650, y: 0 });
        tick();

        pointer.mouseDrag([250, 100], [50, 100], { steps: 4 });
        const trajectory = recordTrajectory(sb, 150, 5);

        expect(Math.max(...trajectory.map(([x]) => x))).toBeGreaterThan(700);
        tick(100);
        expect(sb.getState().position.x).toBe(700);
    });

    // Former test/nobounce.test.js
    it('bounce: false clamps position to edges during drag', () => {
        const { sb, pointer } = mount({ bounce: false });

        pointer.mouseDrag([100, 100], [200, 150], { release: false });
        tick(50);

        expect(roundedPosition(sb)).toEqual({ x: 0, y: 0 });
    });

    it('bounce: false clamps inertia at the far edge', () => {
        const { sb, pointer } = mount({ bounce: false });
        sb.setPosition({ x: 650, y: 0 });
        tick();

        pointer.mouseDrag([250, 100], [50, 100], { steps: 4 });
        const trajectory = recordTrajectory(sb, 150, 5);

        expect(Math.max(...trajectory.map(([x]) => x))).toBe(700);
    });
});

describe('native scroll mode', () => {
    // Browser rounds scrollLeft and scrollTop, the scroll event that follows must not stop inertia
    it('keeps inertia when native scroll reports a rounded position', async () => {
        const fling = async (scrollMode: 'transform' | 'native') => {
            const { sb, pointer } = mount({ scrollMode });
            pointer.mouseDrag([250, 250], [130, 170], { steps: 7 });
            const points = [];
            for (let frame = 0; frame < 10; frame++) {
                tick();
                await nextRender();
                points.push(roundedPosition(sb, 6));
            }
            return points;
        };

        expect(await fling('native')).toEqual(await fling('transform'));
    });
});

describe('content smaller than viewport', () => {
    const small = { contentWidth: 100, contentHeight: 100 };

    it('goes beyond edges with bounce and returns to the start', () => {
        const { sb, pointer } = mount({}, small);

        pointer.mouseDrag([200, 200], [100, 150], { release: false });
        tick();
        expect(sb.getState().position.x).toBeGreaterThan(0);
        expect(sb.getState().position.y).toBeGreaterThan(0);

        pointer.mouseUp(100, 150);
        tick(200);
        expect(sb.getState()).toMatchObject({ isMoving: false, position: { x: 0, y: 0 } });
    });

    it('stays in place without bounce', () => {
        const onUpdate = vi.fn();
        const { pointer } = mount({ bounce: false, onUpdate }, small);

        pointer.mouseDrag([200, 200], [100, 150]);
        tick(50);

        for (const [state] of onUpdate.mock.calls) {
            expect(state.position).toEqual({ x: 0, y: 0 });
        }
    });

    it('leaves wheel to the page', () => {
        const { viewport } = mount({}, small);

        expect(wheel(viewport, 0, 100).defaultPrevented).toBe(false);
    });
});

describe('refresh rate', () => {
    const RATES = [30, 120, 144];

    // Tick at given refresh rate until motion stops, returns elapsed time in ms
    function runUntilStopped(sb: ScrollBooster, frameRate: number) {
        const frameDuration = 1000 / frameRate;
        let elapsed = 0;
        do {
            tick(1, frameDuration);
            elapsed += frameDuration;
        } while (sb.getState().isMoving && elapsed < 10000);
        return elapsed;
    }

    // Instance learns frame duration from previous frames, a real device has it after the first animation
    function warmUp(sb: ScrollBooster, frameRate: number) {
        sb.scrollTo({ x: 1 });
        runUntilStopped(sb, frameRate);
        sb.setPosition({ x: 0 });
        tick(1, 1000 / frameRate);
    }

    // Drag at 1000 px/s for 200 ms and release
    function fling(frameRate: number) {
        const frameDuration = 1000 / frameRate;
        const { sb, pointer } = mount();
        const frames = Math.round(200 / frameDuration);
        pointer.mouseDrag([250, 150], [50, 150], { steps: frames, frameDuration });
        const atRelease = sb.getState().position.x;
        const time = runUntilStopped(sb, frameRate);
        return { atRelease, distance: sb.getState().position.x, time };
    }

    it.each(RATES)('drag and inertia at %i Hz match 60 Hz', (frameRate) => {
        const at60 = fling(60);
        const atRate = fling(frameRate);

        expect(Math.abs(atRate.atRelease - at60.atRelease)).toBeLessThan(at60.atRelease * 0.03);
        expect(Math.abs(atRate.distance - at60.distance)).toBeLessThan(at60.distance * 0.03);
        expect(Math.abs(atRate.time - at60.time)).toBeLessThan(at60.time * 0.05);
    });

    it.each(RATES)('bounce at %i Hz matches 60 Hz', (frameRate) => {
        // Hold content 150 px beyond the start edge until it stops, then release
        const bounce = (rate: number) => {
            const { sb, pointer } = mount();
            warmUp(sb, rate);
            pointer.mouseDown(100, 150);
            pointer.mouseMove(250, 150);
            for (let time = 0; time < 1000; time += 1000 / rate) {
                tick(1, 1000 / rate);
            }
            pointer.mouseUp(250, 150);
            return runUntilStopped(sb, rate);
        };

        expect(Math.abs(bounce(frameRate) - bounce(60))).toBeLessThan(bounce(60) * 0.05);
    });

    it.each(RATES)('scrollTo trajectory at %i Hz matches 60 Hz', (frameRate) => {
        // Position every 100 ms during the first second
        const sample = (rate: number) => {
            const { sb } = mount();
            warmUp(sb, rate);
            sb.scrollTo({ x: 400 });
            const points = [];
            for (let time = 100; time <= 1000; time += 100) {
                // The last frame of each 100 ms window is shorter, like a jittery real frame
                for (let left = 100; left > 1e-9; left -= 1000 / rate) {
                    tick(1, Math.min(1000 / rate, left));
                }
                points.push(sb.getState().position.x);
            }
            return points;
        };
        const at60 = sample(60);

        sample(frameRate).forEach((x, i) => {
            expect(Math.abs(x - at60[i])).toBeLessThan(1);
        });
    });

    it('advances animation by 100 ms at most after a long frame', () => {
        const { sb } = mount();
        sb.scrollTo({ x: 400 });
        tick(1);
        const before = sb.getState().position.x;

        tick(1, 1000);

        // scrollTo keeps 1 - 0.08 * 0.95 of the remaining distance per 60 Hz frame, 100 ms is 6 frames
        const expected = 400 - (400 - before) * (1 - 0.08 * 0.95) ** 6;
        expect(sb.getState().position.x).toBeCloseTo(expected, 6);
    });

    // Two animation frames may share a timestamp
    it('does not move content in a frame of zero duration', () => {
        const onUpdate = vi.fn();
        const { sb } = mount({ onUpdate });
        sb.scrollTo({ x: 400 });
        tick(3);
        const before = sb.getState().position;
        onUpdate.mockClear();

        tick(1, 0);

        expect(sb.getState().position).toEqual(before);
        expect(onUpdate).toHaveBeenCalledTimes(1);
        tick(1);
        expect(sb.getState().position.x).toBeGreaterThan(before.x);
    });

    it('starts a new motion with one frame after the loop stopped on a frame of zero duration', () => {
        const { sb, pointer } = mount();
        pointer.mouseDown(100, 100);
        tick(2);
        pointer.mouseUp(100, 100);
        tick(1, 0);
        expect(pendingFrames()).toBe(0);

        sb.scrollTo({ x: 400 });
        tick(1);

        expect(sb.getState().position.x).toBeCloseTo(400 * 0.08 * 0.95, 6);
    });

    it('starts a new motion with one frame, not the idle time since the previous one', () => {
        const { sb } = mount();
        tick(5);
        expect(pendingFrames()).toBe(0);
        // Clock runs on while nothing is animated
        tick(60);

        sb.scrollTo({ x: 400 });
        tick(1);

        expect(sb.getState().position.x).toBeCloseTo(400 * 0.08 * 0.95, 6);
    });
});

describe('settling', () => {
    it.each([
        ['horizontal', { x: 333.3, y: 0 }],
        ['vertical', { x: 0, y: 100 }],
    ] as const)('stops exactly at scrollTo target along %s direction', (direction, expected) => {
        const { sb } = mount({ direction });

        sb.scrollTo({ x: 333.3, y: 100 });
        tick(300);

        expect(sb.getState().position).toEqual(expected);
        // In 3.x velocity along the disabled axis kept the animation loop running forever
        expect(sb.getState().isMoving).toBe(false);
        expect(pendingFrames()).toBe(0);
    });

    it('stops when direction is restricted during inertia', () => {
        const { sb, pointer } = mount();
        pointer.mouseDrag([250, 250], [150, 150], { steps: 5 });

        sb.updateOptions({ direction: 'vertical' });
        tick(400);

        expect(sb.getState().isMoving).toBe(false);
        expect(pendingFrames()).toBe(0);
    });

    it.each([true, false])('stops scrollTo at edges, bounce: %s', (bounce) => {
        const { sb } = mount({ bounce });

        sb.scrollTo({ x: -100, y: 900 });
        const trajectory = recordTrajectory(sb, 300);

        expect(sb.getState().position).toEqual({ x: 0, y: 700 });
        expect(Math.max(...trajectory.map(([, y]) => y))).toBe(700);
    });

    it('keeps scrollTo target within edges that shrink during the motion', () => {
        const { sb, content } = mount();

        sb.scrollTo({ y: 700 });
        tick(5);
        content.style.height = '500px';
        sb.updateMetrics();
        tick(300);

        expect(sb.getState().position.y).toBe(200);
    });

    it.each([
        ['drag', ({ pointer }: Mounted) => pointer.mouseDown(100, 100)],
        ['wheel', ({ viewport }: Mounted) => wheel(viewport, 0, 10)],
        ['setPosition', ({ sb }: Mounted) => sb.setPosition({ x: 50 })],
    ])('%s cancels scrollTo', (_, interrupt) => {
        vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
        const mounted = mount();
        mounted.sb.scrollTo({ x: 600 });
        tick(5);

        interrupt(mounted);
        tick(300);

        expect(mounted.sb.getState().position.x).toBeLessThan(300);
    });
});

describe('reducedMotion', () => {
    // Firefox and WebKit update media query matches on the next rendering update
    async function emulate(value: 'reduce' | 'no-preference' | 'reset') {
        await commands.emulateReducedMotion(value);
        await nextRender();
    }

    // Reset must apply before the next test, which may use reducedMotion: 'auto'
    afterEach(async () => {
        await emulate('reset');
    });

    it('always: no inertia after release', () => {
        const { sb, pointer } = mount({ reducedMotion: 'always' });

        pointer.mouseDrag([250, 150], [150, 150], { steps: 5 });
        const atRelease = sb.getState().position.x;
        tick(1);

        expect(sb.getState().isMoving).toBe(false);
        expect(sb.getState().position.x).toBe(atRelease);
    });

    it('always: no bounce beyond edges', () => {
        const { sb, pointer } = mount({ reducedMotion: 'always' });

        pointer.mouseDrag([100, 100], [200, 150], { release: false });
        tick(50);

        expect(sb.getState().position).toEqual({ x: 0, y: 0 });
    });

    it('always: scrollTo jumps to the target', () => {
        const { sb } = mount({ reducedMotion: 'always' });

        sb.scrollTo({ x: 200, y: 100 });
        tick(1);

        expect(sb.getState().position).toEqual({ x: 200, y: 100 });
        expect(pendingFrames()).toBe(0);
    });

    it('auto: follows prefers-reduced-motion', async () => {
        await emulate('reduce');
        const { sb } = mount();

        sb.scrollTo({ x: 200 });
        tick(1);
        expect(sb.getState().position.x).toBe(200);

        await emulate('no-preference');
        sb.scrollTo({ x: 0 });
        tick(1);
        expect(sb.getState().position.x).toBeGreaterThan(150);
    });

    it('never: keeps motion with prefers-reduced-motion', async () => {
        await emulate('reduce');
        const { sb } = mount({ reducedMotion: 'never' });

        sb.scrollTo({ x: 200 });
        tick(1);

        expect(sb.getState().position.x).toBeLessThan(200);
    });
});

describe('snap', () => {
    // Fling to the left at about 10 px per frame
    function fling(pointer: Mounted['pointer']) {
        pointer.mouseDrag([250, 150], [150, 150], { steps: 10 });
    }

    it('receives the position where inertia stops', () => {
        const free = mount();
        fling(free.pointer);
        tick(500);
        const snap = vi.fn(() => undefined);
        const snapped = mount({ snap });

        fling(snapped.pointer);
        tick(500);

        expect(snap).toHaveBeenCalledTimes(1);
        const [rest, state] = snap.mock.calls[0] as unknown as [{ x: number; y: number }, { isDragging: boolean }];
        expect(rest.x).toBeCloseTo(free.sb.getState().position.x, 0);
        expect(rest.y).toBe(0);
        expect(state.isDragging).toBe(false);
        // Returning nothing keeps the inertia
        expect(roundedPosition(snapped.sb, 6)).toEqual(roundedPosition(free.sb, 6));
    });

    it('scrolls to the returned position', () => {
        const { sb, pointer } = mount({ snap: (rest) => ({ x: Math.round(rest.x / 100) * 100 }) });

        fling(pointer);
        tick(500);

        expect(sb.getState().position.x % 100).toBe(0);
        expect(sb.getState().position.x).toBeGreaterThan(100);
        expect(sb.getState().isMoving).toBe(false);
    });

    it('keeps the rest position for a missing coordinate', () => {
        const free = mount();
        free.pointer.mouseDrag([250, 250], [150, 150], { steps: 10 });
        tick(500);
        const { sb, pointer } = mount({ snap: () => ({ x: 300 }) });

        pointer.mouseDrag([250, 250], [150, 150], { steps: 10 });
        tick(500);

        expect(sb.getState().position.x).toBe(300);
        expect(sb.getState().position.y).toBeCloseTo(free.sb.getState().position.y, 0);
    });

    it('returns to the edge position when content flies beyond it', () => {
        const snap = vi.fn(() => undefined);
        const { pointer } = mount({ snap });

        pointer.mouseDrag([150, 150], [250, 150], { steps: 10 });

        expect(snap).toHaveBeenCalledWith({ x: 0, y: 0 }, expect.anything());
    });

    it('is called at the end of a wheel gesture', () => {
        vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
        const snap = vi.fn((rest: { x: number; y: number }) => ({ y: Math.round(rest.y / 100) * 100 }));
        const { sb, viewport } = mount({ snap });

        wheel(viewport, 0, 70);
        tick();
        wheel(viewport, 0, 70);
        tick();
        expect(snap).not.toHaveBeenCalled();

        vi.advanceTimersByTime(100);
        tick(300);

        expect(snap).toHaveBeenCalledWith({ x: 0, y: 140 }, expect.anything());
        expect(sb.getState().position).toEqual({ x: 0, y: 100 });
    });

    it('jumps with reduced motion from the release position', () => {
        const { sb, pointer } = mount({
            reducedMotion: 'always',
            snap: (rest) => ({ x: Math.round(rest.x / 100) * 100 }),
        });

        pointer.mouseDrag([250, 150], [180, 150], { steps: 10 });
        tick();

        expect(sb.getState().position.x).toBe(100);
    });
});
