import type { Props } from './options';
import { approach, clamp, coast, getEdgeMode, hasVelocity, type Motion, spring, TARGET_SCROLL_FACTOR } from './physics';
import type { BorderCollision, Direction, Edge, Point, Size } from './types';

const AXES = ['x', 'y'] as const;

type Axis = (typeof AXES)[number];

type MotionOptions = Pick<Props, 'direction' | 'friction' | 'bounceForce'>;

// Public coordinates grow from the start edge, internal ones are content offsets with the opposite sign.
// Mirroring of x in a right-to-left viewport is up to the caller, this class knows no DOM.
// Missing coordinate keeps the given internal value, `|| 0` turns -0 and NaN into 0.
const toInternal = (value: number | undefined, current: number): number =>
    value === undefined ? current : -value || 0;

// Native scroll rounds the position rendered in native mode, a larger difference is a scroll by the browser
const NATIVE_SCROLL_TOLERANCE_PX = 3;

const isAxisAllowed = (axis: Axis, direction: Direction): boolean =>
    direction !== (axis === 'x' ? 'vertical' : 'horizontal');

/**
 * Content position and its motion, without DOM: drag, wheel, scrollTo, inertia and bounce.
 * Coordinates are content offsets: the public ones with the opposite sign, from the end edge to 0.
 */
export class ContentMotion {
    position: Point;
    velocity: Point = { x: 0, y: 0 };
    target: Point = { x: 0, y: 0 };
    isTargetScroll = false;
    // Position when the drag started, the pointer offset is added to it
    dragStart: Point = { x: 0, y: 0 };
    edgeX: Edge = { from: 0, to: 0 };
    edgeY: Edge = { from: 0, to: 0 };

    constructor(position: Point) {
        this.position = position;
    }

    setSizes(viewport: Size, content: Size): void {
        this.edgeX = { from: Math.min(viewport.width - content.width, 0), to: 0 };
        this.edgeY = { from: Math.min(viewport.height - content.height, 0), to: 0 };
    }

    isMoving(): boolean {
        return hasVelocity(this.velocity);
    }

    /**
     * Advance by given number of 60 Hz frames. `drag` is the pointer offset of a drag, `wheel` the wheel deltas
     * since the previous frame, both null when not active.
     */
    step(frames: number, options: MotionOptions, bounce: boolean, drag: Point | null, wheel: Point | null): void {
        // Disabled axis keeps no velocity, otherwise scrollTo along it would keep the animation loop running forever
        for (const axis of AXES) {
            if (isAxisAllowed(axis, options.direction)) {
                ({ position: this.position[axis], velocity: this.velocity[axis] } = this.getAxisMotion(
                    axis,
                    frames,
                    options,
                    bounce,
                    drag,
                    wheel
                ));
            } else {
                this.velocity[axis] = 0;
            }
        }
        // Content goes beyond edges only with bounce, and never with wheel
        if (!bounce || wheel) {
            this.clampPosition();
        }
    }

    /**
     * Motion along one axis. Modes go in order of precedence, each one sets velocity on its own
     */
    private getAxisMotion(
        axis: Axis,
        frames: number,
        { friction, bounceForce }: MotionOptions,
        bounce: boolean,
        drag: Point | null,
        wheel: Point | null
    ): Motion {
        const retention = 1 - friction;
        const position = this.position[axis];
        const velocity = this.velocity[axis];

        if (this.isTargetScroll) {
            return approach(position, this.target[axis], 1 - TARGET_SCROLL_FACTOR * retention, frames);
        }
        // Wheel moves content by the deltas of events since the previous frame, regardless of frame duration
        if (wheel) {
            return { position: position + wheel[axis], velocity: 0 };
        }
        if (drag) {
            return approach(position, this.dragStart[axis] + drag[axis], friction, frames);
        }
        if (bounce) {
            const edge = this.getEdge(axis);
            const mode = getEdgeMode(position, velocity, edge, bounceForce, friction);
            if (mode === 'return') {
                return approach(position, clamp(position, edge), 1 - bounceForce * retention, frames);
            }
            if (mode === 'spring') {
                return spring(position, velocity, clamp(position, edge), bounceForce, friction, frames);
            }
        }
        return coast(position, velocity, friction, frames);
    }

    /**
     * Finish exactly at the scroll target or at the edge, motion stops a fraction of a pixel short of them.
     * Edges may have shrunk since scrollTo, so the target is kept within them too.
     */
    settle(direction: Direction): void {
        if (this.isTargetScroll) {
            for (const axis of AXES) {
                if (isAxisAllowed(axis, direction)) {
                    this.position[axis] = this.target[axis];
                }
            }
            this.isTargetScroll = false;
        }
        this.clampPosition();
        this.stop();
    }

    startDrag(): void {
        this.isTargetScroll = false;
        this.dragStart = { ...this.position };
    }

    /**
     * Target within edges for smooth scroll. Missing coordinate keeps the target of a running scroll or the
     * current position.
     */
    scrollTo(position: Partial<Point>): void {
        const current = this.isTargetScroll ? this.target : this.position;
        this.target.x = clamp(toInternal(position.x, current.x), this.edgeX);
        this.target.y = clamp(toInternal(position.y, current.y), this.edgeY);
        this.isTargetScroll = true;
    }

    /**
     * Jump to the position within edges, missing coordinate stays
     */
    setPosition(position: Partial<Point>): void {
        this.interrupt();
        this.position.x = clamp(toInternal(position.x, this.position.x), this.edgeX);
        this.position.y = clamp(toInternal(position.y, this.position.y), this.edgeY);
    }

    /**
     * Jump by given scroll offset along allowed directions, within edges
     */
    jumpBy(offset: Point, direction: Direction): void {
        for (const axis of AXES) {
            if (isAxisAllowed(axis, direction)) {
                this.position[axis] = clamp(this.position[axis] - offset[axis], this.getEdge(axis));
            }
        }
        this.interrupt();
    }

    /**
     * Check if a scroll by the delta along the axis would move content
     */
    canScroll(axis: Axis, delta: number, direction: Direction): boolean {
        if (!isAxisAllowed(axis, direction)) {
            return false;
        }
        const edge = this.getEdge(axis);
        const position = this.position[axis];
        return delta > 0 ? position > edge.from : delta < 0 && position < edge.to;
    }

    /**
     * Take the position of native scroll that differs from the rendered one, stopping inertia along that axis
     */
    followNativeScroll(scroll: Point): void {
        for (const axis of AXES) {
            if (Math.abs(this.position[axis] + scroll[axis]) > NATIVE_SCROLL_TOLERANCE_PX) {
                this.position[axis] = -scroll[axis];
                this.velocity[axis] = 0;
            }
        }
    }

    /**
     * Stop inertia
     */
    stop(): void {
        this.velocity.x = 0;
        this.velocity.y = 0;
    }

    /**
     * Stop inertia and a running scrollTo
     */
    interrupt(): void {
        this.stop();
        this.isTargetScroll = false;
    }

    /**
     * Public position, 0 - value avoids -0 at the start edge
     */
    getPosition(): Point {
        return { x: 0 - this.position.x, y: 0 - this.position.y };
    }

    /**
     * Public target of a running scrollTo, the position otherwise
     */
    getTarget(): Point {
        const target = this.isTargetScroll ? this.target : this.position;
        return { x: 0 - target.x, y: 0 - target.y };
    }

    getMaxPosition(): Point {
        return { x: 0 - this.edgeX.from, y: 0 - this.edgeY.from };
    }

    getBorderCollision(): BorderCollision {
        return {
            left: this.position.x >= this.edgeX.to,
            right: this.position.x <= this.edgeX.from,
            top: this.position.y >= this.edgeY.to,
            bottom: this.position.y <= this.edgeY.from,
        };
    }

    private getEdge(axis: Axis): Edge {
        return axis === 'x' ? this.edgeX : this.edgeY;
    }

    private clampPosition(): void {
        this.position.x = clamp(this.position.x, this.edgeX);
        this.position.y = clamp(this.position.y, this.edgeY);
    }
}
