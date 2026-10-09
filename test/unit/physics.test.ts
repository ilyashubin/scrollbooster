import { describe, expect, it } from 'vitest';
import {
    approach,
    clamp,
    coast,
    getDragAngle,
    getEdgeMode,
    hasVelocity,
    type Motion,
    rubberBand,
    spring,
    unrubberBand,
} from '../../src/physics';

const edgeX = { from: -700, to: 0 };
const friction = 0.05;
const retention = 1 - friction;
const bounceForce = 0.1;

// Frame step of ScrollBooster 3.x: forces change velocity, then friction, then position
function legacyFrame(position: number, velocity: number, force: (velocity: number) => number): Motion {
    const next = (velocity + force(velocity)) * retention;
    return { position: position + next, velocity: next };
}

function repeat(frames: number, step: (motion: Motion) => Motion, start: Motion): Motion {
    let motion = start;
    for (let i = 0; i < frames; i++) {
        motion = step(motion);
    }
    return motion;
}

function expectMotion(actual: Motion, expected: Motion) {
    expect(actual.position).toBeCloseTo(expected.position, 9);
    expect(actual.velocity).toBeCloseTo(expected.velocity, 9);
}

describe('approach', () => {
    it('matches 3.x drag force on whole frames', () => {
        // 3.x drag force sets velocity to the distance to the pointer
        const legacy = repeat(3, (m) => legacyFrame(m.position, m.velocity, (v) => -100 - m.position - v), {
            position: 0,
            velocity: 0,
        });
        const motion = repeat(3, (m) => approach(m.position, -100, friction, 1), { position: 0, velocity: 0 });

        expectMotion(motion, legacy);
    });

    it('matches 3.x scrollTo force on whole frames', () => {
        const legacy = repeat(10, (m) => legacyFrame(m.position, m.velocity, (v) => (-200 - m.position) * 0.08 - v), {
            position: 0,
            velocity: 0,
        });
        const motion = repeat(10, (m) => approach(m.position, -200, 1 - 0.08 * retention, 1), {
            position: 0,
            velocity: 0,
        });

        expectMotion(motion, legacy);
    });

    it('two half frames equal one frame', () => {
        const half = approach(approach(0, -100, friction, 0.5).position, -100, friction, 0.5);

        expect(half.position).toBeCloseTo(approach(0, -100, friction, 1).position, 9);
    });
});

describe('coast', () => {
    it('matches 3.x inertia on whole frames', () => {
        const start = { position: -300, velocity: -20 };
        const legacy = repeat(30, (m) => legacyFrame(m.position, m.velocity, () => 0), start);

        expectMotion(coast(start.position, start.velocity, friction, 30), legacy);
    });

    it('fractional frames compose', () => {
        const thirds = repeat(3, (m) => coast(m.position, m.velocity, friction, 1 / 3), { position: 0, velocity: 10 });

        expectMotion(thirds, coast(0, 10, friction, 1));
    });

    it('keeps velocity without friction', () => {
        expect(coast(0, 10, 0, 2)).toEqual({ position: 20, velocity: 10 });
    });
});

describe('spring', () => {
    const legacySpring = (m: Motion) => legacyFrame(m.position, m.velocity, () => (0 - m.position) * bounceForce);

    it('matches 3.x edge force on whole frames', () => {
        const start = { position: 20, velocity: 15 };

        expectMotion(spring(20, 15, 0, bounceForce, friction, 4), repeat(4, legacySpring, start));
    });

    it('fractional frames compose', () => {
        const halves = repeat(8, (m) => spring(m.position, m.velocity, 0, bounceForce, friction, 0.5), {
            position: 20,
            velocity: 15,
        });

        expectMotion(halves, repeat(4, legacySpring, { position: 20, velocity: 15 }));
    });

    it.each([
        // Oscillates around the edge
        ['underdamped', 0.6],
        // Overdamped with friction 0.05 only below force 0.00067, where the discriminant is positive
        ['overdamped', 0.0003],
        ['critically damped', (1 - Math.sqrt(retention)) ** 2 / retention],
    ])('works with %s spring', (_, force) => {
        const legacy = repeat(3, (m) => legacyFrame(m.position, m.velocity, () => -m.position * force), {
            position: 20,
            velocity: 0,
        });
        const halves = repeat(6, (m) => spring(m.position, m.velocity, 0, force, friction, 0.5), {
            position: 20,
            velocity: 0,
        });

        expectMotion(halves, legacy);
    });
});

describe('getEdgeMode', () => {
    it('is inside within edges', () => {
        expect(getEdgeMode(-100, 50, edgeX, bounceForce, friction)).toBe('inside');
    });

    it('springs while content would come to rest beyond the edge', () => {
        // rest position 50 + (5 - 5) / 0.05 = 50 is beyond the edge
        expect(getEdgeMode(50, 5, edgeX, bounceForce, friction)).toBe('spring');
        expect(getEdgeMode(-750, -10, edgeX, bounceForce, friction)).toBe('spring');
    });

    it('returns when content would come to rest inside edges', () => {
        // rest position 50 + (-10 - 5) / 0.05 = -250 is inside edges
        expect(getEdgeMode(50, -10, edgeX, bounceForce, friction)).toBe('return');
        expect(getEdgeMode(-750, 0, edgeX, bounceForce, friction)).toBe('return');
    });
});

describe('rubberBand', () => {
    it('keeps positions within edges', () => {
        expect(rubberBand(-300, edgeX, 300)).toBe(-300);
        expect(rubberBand(0, edgeX, 300)).toBe(0);
        expect(rubberBand(-700, edgeX, 300)).toBe(-700);
    });

    it('shows 35% of a drag by the viewport size beyond either edge', () => {
        expect(rubberBand(300, edgeX, 300)).toBeCloseTo(106.45, 2);
        expect(rubberBand(-1000, edgeX, 300)).toBeCloseTo(-806.45, 2);
    });

    it('grows slower further from the edge and stays within the viewport size', () => {
        const first = rubberBand(100, edgeX, 300);
        const second = rubberBand(200, edgeX, 300) - first;
        expect(second).toBeLessThan(first);
        expect(rubberBand(1e6, edgeX, 300)).toBeLessThan(300);
    });

    it('stops at the edge without viewport size', () => {
        expect(rubberBand(50, edgeX, 0)).toBe(0);
    });

    it('is inverted by unrubberBand', () => {
        for (const position of [-950, -750, -700, -300, 0, 20, 150, 290]) {
            expect(rubberBand(unrubberBand(position, edgeX, 300), edgeX, 300)).toBeCloseTo(position, 6);
        }
    });

    it('unrubberBand takes content beyond the viewport size near it', () => {
        expect(rubberBand(unrubberBand(400, edgeX, 300), edgeX, 300)).toBeCloseTo(297, 6);
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
});
