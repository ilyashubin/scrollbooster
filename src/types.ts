export interface Point {
    x: number;
    y: number;
}

export interface Edge {
    from: number;
    to: number;
}

export interface Size {
    width: number;
    height: number;
}

export type Axis = 'horizontal' | 'vertical';

export type Direction = Axis | 'all';

export type PointerMode = 'all' | 'touch' | 'mouse';

export type ScrollMode = 'transform' | 'native' | 'none';

export type ReducedMotion = 'auto' | 'always' | 'never';

export interface BorderCollision {
    left: boolean;
    right: boolean;
    top: boolean;
    bottom: boolean;
}

export interface ScrollBoosterState {
    isMoving: boolean;
    isDragging: boolean;
    /**
     * Scroll position from the start edges, from 0 to `maxPosition`. In a right-to-left viewport `x` is the distance
     * from the right edge and grows to the left, like negative `scrollLeft`.
     */
    position: Point;
    /** Pointer offset of the current press on screen, `x` grows to the right */
    dragOffset: Point;
    dragAngle: number;
    /** Sides of viewport that content touches */
    borderCollision: BorderCollision;
    /** Client size of viewport, without borders and scrollbars */
    viewport: Size;
    /** Size of content, including its overflow */
    content: Size;
    /** Largest `position` on each axis, 0 when content fits viewport */
    maxPosition: Point;
}

export interface ScrollBoosterOptions {
    /** Container element (required) */
    viewport: HTMLElement;
    /** Scrollable content element, first viewport child by default */
    content?: HTMLElement;
    /** Scroll direction */
    direction?: Direction;
    /** Mouse or touch support, pen counts as mouse. Touch drag sets CSS `touch-action` on viewport */
    pointerMode?: PointerMode;
    /** How content is scrolled: CSS transform, native scroll of viewport, or `'none'` to render in `onUpdate` */
    scrollMode?: ScrollMode;
    /** Bounce effect */
    bounce?: boolean;
    /** Bounce effect factor, per 60 Hz frame */
    bounceForce?: number;
    /** Scroll friction factor, per 60 Hz frame: the same motion on any refresh rate */
    friction?: number;
    /** Enables text selection */
    textSelection?: boolean;
    /** Enables focus on input elements */
    inputsFocus?: boolean;
    /**
     * Mouse wheel and trackpad scroll content. The page scrolls instead when content cannot move along the
     * main axis of the gesture
     */
    wheel?: boolean;
    /**
     * Reduced motion: no inertia and bounce, `scrollTo` jumps to the target.
     * `'auto'` follows `prefers-reduced-motion` media query
     */
    reducedMotion?: ReducedMotion;
    /** Press that starts dragging, after `shouldDrag` allowed it */
    onPointerDown?: (state: ScrollBoosterState, event: PointerEvent) => void;
    /** Drag pointer released or cancelled */
    onPointerUp?: (state: ScrollBoosterState, event: PointerEvent) => void;
    /** Drag pointer moved */
    onPointerMove?: (state: ScrollBoosterState, event: PointerEvent) => void;
    /** Click on viewport, `event.defaultPrevented` is `true` for the click that ends a drag */
    onClick?: (state: ScrollBoosterState, event: MouseEvent) => void;
    /** State update handler */
    onUpdate?: (state: ScrollBoosterState) => void;
    /** Wheel event that scrolls content, called before the content moves */
    onWheel?: (state: ScrollBoosterState, event: WheelEvent) => void;
    /** Decides on `pointerdown` whether the press starts dragging. Wheel is switched with the `wheel` option */
    shouldDrag?: (state: ScrollBoosterState, event: PointerEvent) => boolean;
}
