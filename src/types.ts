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
    /** @deprecated Has no effect, native touch scrolling is controlled with CSS `touch-action` */
    preventPointerMoveDefault?: boolean;
    /**
     * Touch drag in given direction moves content, drag in the other direction scrolls the page natively.
     * `'all'` disables native touch gestures on viewport
     */
    lockScrollOnDragDirection?: Direction | false;
    /** Prevents default mousedown on drag start: text selection, native drag of images and links */
    pointerDownPreventDefault?: boolean;
    /** Tolerance in degrees for horizontal or vertical drag detection */
    dragDirectionTolerance?: number;
    /** Primary pointer pressed on viewport, called before drag guards */
    onPointerDown?: (state: ScrollBoosterState, event: PointerEvent, isTouch: boolean) => void;
    /** Drag pointer released or cancelled */
    onPointerUp?: (state: ScrollBoosterState, event: PointerEvent, isTouch: boolean) => void;
    /** Drag pointer moved */
    onPointerMove?: (state: ScrollBoosterState, event: PointerEvent, isTouch: boolean) => void;
    /** Click handler */
    onClick?: (state: ScrollBoosterState, event: MouseEvent, isTouch: boolean) => void;
    /** State update handler */
    onUpdate?: (state: ScrollBoosterState) => void;
    /** Wheel handler */
    onWheel?: (state: ScrollBoosterState, event: WheelEvent) => void;
    /** Predicate to allow or disable scroll on pointerdown */
    shouldScroll?: (state: ScrollBoosterState, event: PointerEvent) => boolean;
}
