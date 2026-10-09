import { describe, expect, it } from 'vitest';
import { ContentMotion } from '../../src/motion';

const options = { direction: 'all', friction: 0.05, bounceForce: 0.1 } as const;

// Viewport 300×300 with content 1000×1000: positions from 0 to 700 on both axes
function create(): ContentMotion {
    const motion = new ContentMotion({ x: 0, y: 0 });
    motion.setSizes({ width: 300, height: 300 }, { width: 1000, height: 1000 });
    return motion;
}

function run(motion: ContentMotion, drag: { x: number; y: number } | null = null): number {
    let frames = 0;
    do {
        motion.step(1, options, true, drag, null);
        frames++;
    } while (motion.isMoving() && frames < 1000);
    motion.settle(options.direction);
    return frames;
}

describe('ContentMotion', () => {
    it('reports the scroll range and border collisions', () => {
        const motion = create();

        expect(motion.getMaxPosition()).toEqual({ x: 700, y: 700 });
        expect(motion.getBorderCollision()).toEqual({ left: true, right: false, top: true, bottom: false });
    });

    it('scrollTo ends exactly at the target and keeps the missing coordinate', () => {
        const motion = create();
        motion.setPosition({ y: 50 });

        motion.scrollTo({ x: 300 });
        run(motion);

        expect(motion.getPosition()).toEqual({ x: 300, y: 50 });
        expect(motion.isTargetScroll).toBe(false);
    });

    it('keeps targets and positions within edges', () => {
        const motion = create();

        motion.setPosition({ x: -100, y: 2000 });
        expect(motion.getPosition()).toEqual({ x: 0, y: 700 });

        motion.scrollTo({ x: 5000 });
        expect(motion.target.x).toBe(-700);
    });

    it('drag follows the pointer offset from the drag start', () => {
        const motion = create();
        motion.setPosition({ x: 100 });
        motion.startDrag();

        motion.step(1, options, true, { x: -100, y: 0 }, null);

        // Content moves by 1 - friction of the remaining distance per frame
        expect(motion.getPosition().x).toBeCloseTo(195);
    });

    it('bounces back to the edge after a throw beyond it', () => {
        const motion = create();
        motion.velocity.x = 40;

        const frames = run(motion);

        expect(frames).toBeGreaterThan(10);
        expect(motion.getPosition()).toEqual({ x: 0, y: 0 });
    });

    it('wheel moves by the deltas and stays within edges without bounce', () => {
        const motion = create();

        motion.step(1, options, true, null, { x: -20, y: 100 });

        expect(motion.getPosition()).toEqual({ x: 20, y: 0 });
        expect(motion.velocity).toEqual({ x: 0, y: 0 });
    });

    it('can scroll only along allowed directions and away from edges', () => {
        const motion = create();

        expect(motion.canScroll('y', 10, 'all')).toBe(true);
        expect(motion.canScroll('y', -10, 'all')).toBe(false);
        expect(motion.canScroll('y', 10, 'horizontal')).toBe(false);
        motion.setPosition({ x: 700 });
        expect(motion.canScroll('x', 10, 'all')).toBe(false);
        expect(motion.canScroll('x', -10, 'all')).toBe(true);
    });

    it('jumpBy moves along allowed directions and stops motion', () => {
        const motion = create();
        motion.velocity.y = 10;
        motion.scrollTo({ x: 500 });

        motion.jumpBy({ x: 50, y: 50 }, 'vertical');

        expect(motion.getPosition()).toEqual({ x: 0, y: 50 });
        expect(motion.isMoving()).toBe(false);
        expect(motion.isTargetScroll).toBe(false);
    });
});
