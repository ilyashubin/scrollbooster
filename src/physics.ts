import type { Axis, Edge, Point } from './types';

/** Share of the remaining distance to the target added to velocity on each frame of `scrollTo` */
export const TARGET_SCROLL_FACTOR = 0.08;

/** Velocity below this value (px per 60 Hz frame) counts as stopped */
export const MIN_VELOCITY = 0.01;

/** Duration of one frame at 60 Hz. Velocities and `friction`, `bounceForce` options are defined per such frame */
export const FRAME_DURATION: number = 1000 / 60;

/** Position and velocity of content along one axis */
export interface Motion {
    position: number;
    velocity: number;
}

/**
 * Motion that multiplies the remaining distance to the goal by `retention` every frame.
 * This is how drag, `scrollTo` and return to the edge move content. Frames can be fractional,
 * velocity is the average distance per frame.
 */
export function approach(position: number, goal: number, retention: number, frames: number): Motion {
    const next = goal - (goal - position) * retention ** frames;
    return { position: next, velocity: (next - position) / frames };
}

/**
 * Inertia: velocity is multiplied by `1 - friction` every frame, starting with the current one
 */
export function coast(position: number, velocity: number, friction: number, frames: number): Motion {
    if (friction <= 0) {
        return { position: position + velocity * frames, velocity };
    }
    const retention = 1 - friction;
    const decay = retention ** frames;
    // Sum of the geometric series velocity * retention^i, extended to fractional frame count
    return { position: position + (velocity * retention * (1 - decay)) / friction, velocity: velocity * decay };
}

/**
 * Spring towards the edge while content flies beyond it. Per frame:
 * `velocity = (1 - friction) * (velocity + bounceForce * distance)`, `position += velocity`.
 * This linear map is raised to a fractional power, so two half frames equal one frame.
 */
export function spring(
    position: number,
    velocity: number,
    edge: number,
    bounceForce: number,
    friction: number,
    frames: number
): Motion {
    const retention = 1 - friction;
    if (retention <= 0) {
        return { position, velocity: 0 };
    }
    // Frame map on (distance to edge, velocity) is [[1 - retention * bounceForce, -retention], [retention * bounceForce, retention]]
    const m11 = 1 - retention * bounceForce;
    const m12 = -retention;
    const m21 = retention * bounceForce;
    const m22 = retention;
    // By Cayley-Hamilton theorem M^frames = a * M + b * I, coefficients come from eigenvalues
    const trace = m11 + m22;
    const determinant = retention;
    const discriminant = (trace * trace) / 4 - determinant;
    let a: number;
    let b: number;
    if (discriminant < -1e-12) {
        const radius = Math.sqrt(determinant);
        const angle = Math.acos(trace / 2 / radius);
        a = (radius ** (frames - 1) * Math.sin(frames * angle)) / Math.sin(angle);
        b = (-(radius ** frames) * Math.sin((frames - 1) * angle)) / Math.sin(angle);
    } else if (discriminant > 1e-12) {
        const root = Math.sqrt(discriminant);
        const high = trace / 2 + root;
        const low = trace / 2 - root;
        a = (high ** frames - low ** frames) / (high - low);
        b = (-high * low * (high ** (frames - 1) - low ** (frames - 1))) / (high - low);
    } else {
        const value = trace / 2;
        a = frames * value ** (frames - 1);
        b = -(frames - 1) * value ** frames;
    }
    const distance = edge - position;
    return {
        position: edge - (a * (m11 * distance + m12 * velocity) + b * distance),
        velocity: a * (m21 * distance + m22 * velocity) + b * velocity,
    };
}

/**
 * How content moves relative to the edges along one axis:
 * within edges, flying beyond an edge against the spring, or returning to the edge.
 */
export function getEdgeMode(
    position: number,
    velocity: number,
    edge: Edge,
    bounceForce: number,
    friction: number
): 'inside' | 'spring' | 'return' {
    const beyondFrom = position < edge.from;
    const beyondTo = position > edge.to;
    if (!beyondFrom && !beyondTo) {
        return 'inside';
    }
    const force = ((beyondFrom ? edge.from : edge.to) - position) * bounceForce;
    const restPosition = position + (velocity + force) / friction;
    // content would come to rest inside edges: stop pushing and pull it back
    if ((beyondFrom && restPosition >= edge.from) || (beyondTo && restPosition <= edge.to)) {
        return 'return';
    }
    return 'spring';
}

export function hasVelocity(velocity: Point): boolean {
    return Math.abs(velocity.x) >= MIN_VELOCITY || Math.abs(velocity.y) >= MIN_VELOCITY;
}

export function clamp(value: number, edge: Edge): number {
    return Math.max(Math.min(value, edge.to), edge.from);
}

/**
 * Get drag angle (up: 180, left: -90, right: 90, down: 0)
 */
export function getDragAngle(x: number, y: number): number {
    return Math.round(Math.atan2(x, y) * (180 / Math.PI));
}

/**
 * Get drag direction (horizontal or vertical)
 */
export function getDragDirection(angle: number, tolerance: number): Axis {
    const absAngle = Math.abs(90 - Math.abs(angle));

    if (absAngle <= 90 - tolerance) {
        return 'horizontal';
    }
    return 'vertical';
}
