type Coords = {
    x: number;
    y: number;
};

type Dimensions = {
    width: number;
    height: number;
};

type Edge = {
    from: number;
    to: number;
};

type BorderCollision = {
    top: boolean;
    right: boolean;
    bottom: boolean;
    left: boolean;
};

type ScrollingState = {
    borderCollision: BorderCollision;
    dragAngle: number;
    dragOffset: Coords;
    isDragging: boolean;
    isMoving: boolean;
    position: Coords;
};

type OptionsObject = {
    viewport: HTMLElement;
    content?: HTMLElement;
    scrollMode?: 'transform' | 'native';
    direction?: 'horizontal' | 'vertical' | 'all';
    bounce?: boolean;
    textSelection?: boolean;
    inputsFocus?: boolean;
    pointerMode?: 'touch' | 'mouse' | 'all';
    friction?: number;
    bounceForce?: number;
    emulateScroll?: boolean;
    preventDefaultOnEmulateScroll?: boolean;
    lockScrollOnDragDirection?: boolean;
    dragDirectionTolerance?: number;
    onUpdate?: (state: ScrollingState) => void;
    onClick?: (state: ScrollingState, event: Event) => void;
    onPointerDown?: (event: MouseEvent | TouchEvent) => void;
    onPointerUp?: (event: MouseEvent | TouchEvent) => void;
    onPointerMove?: (event: MouseEvent | TouchEvent) => void;
    onWheel?: (event: WheelEvent) => void;
    shouldScroll?: (state: ScrollingState, event: MouseEvent | TouchEvent) => boolean;
};

export default class ScrollBooster {
    constructor(options: OptionsObject);
    setPosition(coords: Coords);
    scrollTo(coords: Coords);
    updateMetrics();
    updateOptions(options: Partial<OptionsObject>);
    getState(): ScrollingState;
    destroy(): void;

    clientOffset: Coords;
    content: Dimensions;
    dragOffset: Coords;
    dragPosition: Coords;
    dragStartPosition: Coords;
    edgeX: Edge;
    edgeY: Edge;
    events: Record<string, (event?: Event) => void>;
    isDragging: boolean;
    isRunning: boolean;
    isScrolling: boolean;
    isTargetScroll: boolean;
    position: Coords;
    props: Record<string, unknown>;
    rafID: number;
    scrollOffset: Coords;
    targetPosition: Coords;
    velocity: Coords;
    viewport: Dimensions;
}
