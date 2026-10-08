import type { Axis, Edge, Point } from './types';

/** Share of the remaining distance to the target added to velocity on each frame of `scrollTo` */
export const TARGET_SCROLL_FACTOR = 0.08;

/** Velocity below this value (px per frame) counts as stopped */
export const MIN_VELOCITY = 0.01;

/**
 * Force pulling content back inside viewport edges for the bounce effect.
 * Returns null when position is within edges.
 */
export function getEdgeForce(
    position: Point,
    velocity: Point,
    edgeX: Edge,
    edgeY: Edge,
    bounceForce: number,
    friction: number
): Point | null {
    // scrolled past viewport edges
    const beyondXFrom = position.x < edgeX.from;
    const beyondXTo = position.x > edgeX.to;
    const beyondYFrom = position.y < edgeY.from;
    const beyondYTo = position.y > edgeY.to;
    const beyondX = beyondXFrom || beyondXTo;
    const beyondY = beyondYFrom || beyondYTo;

    if (!beyondX && !beyondY) {
        return null;
    }

    const edge = {
        x: beyondXFrom ? edgeX.from : edgeX.to,
        y: beyondYFrom ? edgeY.from : edgeY.to,
    };

    const distanceToEdge = {
        x: edge.x - position.x,
        y: edge.y - position.y,
    };

    const force = {
        x: distanceToEdge.x * bounceForce,
        y: distanceToEdge.y * bounceForce,
    };

    const restPosition = {
        x: position.x + (velocity.x + force.x) / friction,
        y: position.y + (velocity.y + force.y) / friction,
    };

    // content would come to rest inside edges: stop pushing and cancel current velocity
    if ((beyondXFrom && restPosition.x >= edgeX.from) || (beyondXTo && restPosition.x <= edgeX.to)) {
        force.x = distanceToEdge.x * bounceForce - velocity.x;
    }

    if ((beyondYFrom && restPosition.y >= edgeY.from) || (beyondYTo && restPosition.y <= edgeY.to)) {
        force.y = distanceToEdge.y * bounceForce - velocity.y;
    }

    return {
        x: beyondX ? force.x : 0,
        y: beyondY ? force.y : 0,
    };
}

/**
 * Force that makes velocity equal to the distance between content and pointer
 */
export function getDragForce(dragPosition: Point, position: Point, velocity: Point): Point {
    const dragVelocity = {
        x: dragPosition.x - position.x,
        y: dragPosition.y - position.y,
    };

    return {
        x: dragVelocity.x - velocity.x,
        y: dragVelocity.y - velocity.y,
    };
}

/**
 * Force that makes velocity equal to the wheel offset
 */
export function getScrollForce(scrollOffset: Point, velocity: Point): Point {
    return {
        x: scrollOffset.x - velocity.x,
        y: scrollOffset.y - velocity.y,
    };
}

/**
 * Force that moves content towards the `scrollTo` target
 */
export function getTargetForce(targetPosition: Point, position: Point, velocity: Point): Point {
    return {
        x: (targetPosition.x - position.x) * TARGET_SCROLL_FACTOR - velocity.x,
        y: (targetPosition.y - position.y) * TARGET_SCROLL_FACTOR - velocity.y,
    };
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
