import { describe, expect, it } from 'vitest';
import { mount, pendingFrames, recordTrajectory, roundedPosition, tick } from './helpers.js';

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
        expect(sb.getState().position.x).toBeCloseTo(0, 0);
        expect(sb.getState().position.y).toBeCloseTo(0, 0);
    });

    it('returns from the far edge after a fling', () => {
        const { sb, pointer } = mount();
        sb.setPosition({ x: 650, y: 0 });
        tick();

        pointer.mouseDrag([250, 100], [50, 100], { steps: 4 });
        const trajectory = recordTrajectory(sb, 150, 5);

        expect(Math.max(...trajectory.map(([x]) => x))).toBeGreaterThan(700);
        expect(sb.getState().position.x).toBeCloseTo(700, 0);
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
