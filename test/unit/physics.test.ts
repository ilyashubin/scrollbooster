import { describe, expect, it } from 'vitest';
import {
    clamp,
    getDragAngle,
    getDragDirection,
    getDragForce,
    getEdgeForce,
    getScrollForce,
    getTargetForce,
    hasVelocity,
} from '../../src/physics';

const edgeX = { from: -700, to: 0 };
const edgeY = { from: -700, to: 0 };
const still = { x: 0, y: 0 };

describe('getEdgeForce', () => {
    it('returns null within edges', () => {
        expect(getEdgeForce({ x: -100, y: -100 }, still, edgeX, edgeY, 0.1, 0.05)).toBeNull();
    });

    it('pulls back towards the nearest edge only along the axis beyond edges', () => {
        // rest position 50 + (5 - 5) / 0.05 = 50 is still beyond the edge, so only the spring force applies
        expect(getEdgeForce({ x: 50, y: -100 }, { x: 5, y: 0 }, edgeX, edgeY, 0.1, 0.05)).toEqual({ x: -5, y: 0 });
    });

    it('cancels velocity when content would come to rest inside edges', () => {
        // rest position 50 + (-10 - 5) / 0.05 = -250 is inside edges, so velocity -10 is compensated
        expect(getEdgeForce({ x: 50, y: 0 }, { x: -10, y: 0 }, edgeX, edgeY, 0.1, 0.05)).toEqual({ x: 5, y: 0 });
    });

    it('works beyond the far edge', () => {
        expect(getEdgeForce({ x: -800, y: -750 }, still, edgeX, edgeY, 0.1, 0.05)).toEqual({ x: 10, y: 5 });
    });
});

describe('forces', () => {
    it('drag force sets velocity to the distance to pointer', () => {
        expect(getDragForce({ x: -100, y: 0 }, { x: -40, y: 0 }, { x: -10, y: 2 })).toEqual({ x: -50, y: -2 });
    });

    it('scroll force sets velocity to the wheel offset', () => {
        expect(getScrollForce({ x: 0, y: -100 }, { x: 3, y: -20 })).toEqual({ x: -3, y: -80 });
    });

    it('target force moves 8% of the remaining distance', () => {
        expect(getTargetForce({ x: -200, y: 0 }, { x: -100, y: 0 }, still)).toEqual({ x: -8, y: 0 });
    });
});

describe('helpers', () => {
    it('hasVelocity uses 0.01 threshold', () => {
        expect(hasVelocity({ x: 0.01, y: 0 })).toBe(true);
        expect(hasVelocity({ x: 0.0099, y: -0.0099 })).toBe(false);
    });

    it('clamp keeps value within edge', () => {
        expect(clamp(10, edgeX)).toBe(0);
        expect(clamp(-800, edgeX)).toBe(-700);
        expect(clamp(-300, edgeX)).toBe(-300);
    });

    it('getDragAngle returns degrees', () => {
        expect(getDragAngle(0, 10)).toBe(0);
        expect(getDragAngle(10, 0)).toBe(90);
        expect(getDragAngle(-10, 0)).toBe(-90);
        expect(getDragAngle(0, -10)).toBe(180);
    });

    it('getDragDirection respects tolerance', () => {
        expect(getDragDirection(90, 40)).toBe('horizontal');
        expect(getDragDirection(0, 40)).toBe('vertical');
        expect(getDragDirection(45, 40)).toBe('horizontal');
        expect(getDragDirection(45, 50)).toBe('vertical');
    });
});
