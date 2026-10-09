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
    position: Point;
    dragOffset: Point;
    dragAngle: number;
    borderCollision: BorderCollision;
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
    /** Enables mouse wheel emulation */
    emulateScroll?: boolean;
    /** Prevents default wheel event in given direction when `emulateScroll` is enabled */
    preventDefaultOnEmulateScroll?: Axis | false;
    /** Prevents default mousedown on drag start: text selection, native drag of images and links */
    pointerDownPreventDefault?: boolean;
    /** Tolerance in degrees for horizontal or vertical drag detection */
    dragDirectionTolerance?: number;
    /**
     * Reduced motion: no inertia and bounce, `scrollTo` jumps to the target.
     * `'auto'` follows `prefers-reduced-motion` media query
     */
    reducedMotion?: ReducedMotion;
    /** Press that starts dragging, after `shouldScroll` allowed it */
    onPointerDown?: (state: ScrollBoosterState, event: PointerEvent) => void;
    /** Drag pointer released or cancelled */
    onPointerUp?: (state: ScrollBoosterState, event: PointerEvent) => void;
    /** Drag pointer moved */
    onPointerMove?: (state: ScrollBoosterState, event: PointerEvent) => void;
    /** Click on viewport, `event.defaultPrevented` is `true` for the click that ends a drag */
    onClick?: (state: ScrollBoosterState, event: MouseEvent) => void;
    /** State update handler */
    onUpdate?: (state: ScrollBoosterState) => void;
    /** Wheel handler */
    onWheel?: (state: ScrollBoosterState, event: WheelEvent) => void;
    /** Predicate to allow or disable scroll on pointerdown */
    shouldScroll?: (state: ScrollBoosterState, event: PointerEvent) => boolean;
}
