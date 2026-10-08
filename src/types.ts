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

export type ScrollMode = 'transform' | 'native';

export type PointerLikeEvent = MouseEvent | TouchEvent;

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
    /** Mouse or touch support */
    pointerMode?: PointerMode;
    /** Predefined scrolling technique, scroll is rendered in `onUpdate` when not set */
    scrollMode?: ScrollMode;
    /** Bounce effect */
    bounce?: boolean;
    /** Bounce effect factor */
    bounceForce?: number;
    /** Scroll friction factor */
    friction?: number;
    /** Enables text selection */
    textSelection?: boolean;
    /** Enables focus on input elements */
    inputsFocus?: boolean;
    /** Enables mouse wheel emulation */
    emulateScroll?: boolean;
    /** Prevents default wheel event in given direction when `emulateScroll` is enabled */
    preventDefaultOnEmulateScroll?: Axis | false;
    /** Not used, kept for backward compatibility */
    preventPointerMoveDefault?: boolean;
    /** Locks content scroll or prevents default touchmove depending on drag direction */
    lockScrollOnDragDirection?: Direction | false;
    /** Prevents default mousedown */
    pointerDownPreventDefault?: boolean;
    /** Tolerance in degrees for horizontal or vertical drag detection */
    dragDirectionTolerance?: number;
    onPointerDown?: (state: ScrollBoosterState, event: PointerLikeEvent, isTouch: boolean) => void;
    onPointerUp?: (state: ScrollBoosterState, event: PointerLikeEvent, isTouch: boolean) => void;
    onPointerMove?: (state: ScrollBoosterState, event: PointerLikeEvent, isTouch: boolean) => void;
    /** Click handler */
    onClick?: (state: ScrollBoosterState, event: MouseEvent, isTouch: boolean) => void;
    /** State update handler */
    onUpdate?: (state: ScrollBoosterState) => void;
    /** Wheel handler */
    onWheel?: (state: ScrollBoosterState, event: WheelEvent) => void;
    /** Predicate to allow or disable scroll on pointerdown */
    shouldScroll?: (state: ScrollBoosterState, event: PointerLikeEvent) => boolean;
}
