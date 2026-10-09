import { afterEach, describe, expect, it, vi } from 'vitest';
import { commands } from 'vitest/browser';
import { mount, nextRender, pendingFrames, recordTrajectory, roundedPosition, tick, wheel } from './helpers.js';

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
        const travel = (friction) => {
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

describe('refresh rate', () => {
    const RATES = [30, 120, 144];

    // Tick at given refresh rate until motion stops, returns elapsed time in ms
    function runUntilStopped(sb, frameRate) {
        const frameDuration = 1000 / frameRate;
        let elapsed = 0;
        do {
            tick(1, frameDuration);
            elapsed += frameDuration;
        } while (sb.getState().isMoving && elapsed < 10000);
        return elapsed;
    }

    // Instance learns frame duration from previous frames, a real device has it after the first animation
    function warmUp(sb, frameRate) {
        sb.scrollTo({ x: 1 });
        runUntilStopped(sb, frameRate);
        sb.setPosition({ x: 0 });
        tick(1, 1000 / frameRate);
    }

    // Drag at 1000 px/s for 200 ms and release
    function fling(frameRate) {
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
        const bounce = (rate) => {
            const { sb } = mount();
            warmUp(sb, rate);
            sb.setPosition({ x: -150 });
            const time = runUntilStopped(sb, rate);
            return time;
        };

        expect(Math.abs(bounce(frameRate) - bounce(60))).toBeLessThan(bounce(60) * 0.05);
    });

    it.each(RATES)('scrollTo trajectory at %i Hz matches 60 Hz', (frameRate) => {
        // Position every 100 ms during the first second
        const sample = (rate) => {
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
});

describe('settling', () => {
    it.each([
        ['horizontal', { x: 333.3, y: 0 }],
        ['vertical', { x: 0, y: 100 }],
    ])('stops exactly at scrollTo target along %s direction', (direction, expected) => {
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

    it('keeps target beyond edges with bounce: false', () => {
        const { sb } = mount({ bounce: false });

        sb.scrollTo({ y: 900 });
        tick(300);

        expect(sb.getState().position.y).toBe(900);
    });

    it.each([
        ['drag', ({ pointer }) => pointer.mouseDown(100, 100)],
        ['wheel', ({ viewport }) => wheel(viewport, 0, 10)],
        ['setPosition', ({ sb }) => sb.setPosition({ x: 50 })],
    ])('%s cancels scrollTo', (_, interrupt) => {
        vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
        const mounted = mount({ emulateScroll: true });
        mounted.sb.scrollTo({ x: 600 });
        tick(5);

        interrupt(mounted);
        tick(300);

        expect(mounted.sb.isTargetScroll).toBe(false);
        expect(mounted.sb.getState().position.x).toBeLessThan(300);
    });
});

describe('reducedMotion', () => {
    afterEach(async () => {
        await commands.emulateReducedMotion('reset');
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

    // Firefox and WebKit update media query matches on the next rendering update
    async function emulate(value) {
        await commands.emulateReducedMotion(value);
        await nextRender();
    }

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
