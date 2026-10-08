import { clearTextSelection, getFullHeight, getFullWidth, textNodeFromPoint } from './dom';
import {
    approach,
    clamp,
    coast,
    FRAME_DURATION,
    getDragAngle,
    getDragDirection,
    getEdgeMode,
    hasVelocity,
    type Motion,
    spring,
    TARGET_SCROLL_FACTOR,
} from './physics';
import type { Axis, Direction, Edge, Point, ScrollBoosterOptions, ScrollBoosterState, ScrollMode, Size } from './types';

const CLICK_EVENT_THRESHOLD_PX = 5;

// Longer frames (hidden tab, long task) advance animation by this duration only
const MAX_FRAME_DURATION = 100;

let reducedMotionQuery: MediaQueryList | undefined;

const prefersReducedMotion = (): boolean => {
    if (typeof matchMedia !== 'function') {
        return false;
    }
    reducedMotionQuery ??= matchMedia('(prefers-reduced-motion: reduce)');
    return reducedMotionQuery.matches;
};

type Props = Required<Omit<ScrollBoosterOptions, 'scrollMode'>> & { scrollMode: ScrollMode | undefined };

interface EventHandlers {
    pointerdown: (event: PointerEvent) => void;
    mousedown: (event: MouseEvent) => void;
    pointermove: (event: PointerEvent) => void;
    pointerup: (event: PointerEvent) => void;
    wheel: (event: WheelEvent) => void;
    scroll: () => void;
    focusin: (event: FocusEvent) => void;
    click: (event: MouseEvent) => void;
    contentLoad: () => void;
}

interface Metrics {
    viewport: Size;
    content: Size;
}

// Native touch gestures left to the browser for each drag direction, the rest are handled as drag
const TOUCH_ACTION: Record<Direction, string> = {
    horizontal: 'pan-y pinch-zoom',
    vertical: 'pan-x pinch-zoom',
    all: 'pinch-zoom',
};

const isSameSize = (a: Size, b: Size): boolean => a.width === b.width && a.height === b.height;

// Content position follows native scroll position of the viewport, so a scrolled viewport keeps its scroll
const getScrollPosition = (viewport: HTMLElement): Point => ({ x: -viewport.scrollLeft, y: -viewport.scrollTop });

const getElementsError = (viewport: unknown, content: unknown): string | null => {
    if (!(viewport instanceof Element)) {
        return '"viewport" config property must be present and must be Element';
    }
    if (!content) {
        return 'Viewport does not have any content';
    }
    return null;
};

export class ScrollBooster {
    // Fields are declared without initializers to keep runtime shape of the JavaScript version
    declare props: Props;
    declare isDragging: boolean;
    declare isTargetScroll: boolean;
    declare isScrolling: boolean;
    declare isRunning: boolean;
    declare position: Point;
    declare velocity: Point;
    declare dragStartPosition: Point;
    declare dragOffset: Point;
    declare clientOffset: Point;
    declare dragPosition: Point;
    declare targetPosition: Point;
    declare scrollOffset: Point;
    declare rafID: number | null;
    declare events: EventHandlers;
    declare viewport: Size;
    declare content: Size;
    declare edgeX: Edge;
    declare edgeY: Edge;
    declare private isDestroyed: boolean;
    declare private abortController: AbortController;
    declare private resizeObserver: ResizeObserver;
    declare private wheelTimer: ReturnType<typeof setTimeout> | undefined;
    declare private dragController: AbortController | null;
    declare private initialTouchAction: string;
    declare private lastFrameTime: number | null;
    declare private frameDuration: number;

    /**
     * Create ScrollBooster instance
     */
    constructor(options: ScrollBoosterOptions = {} as ScrollBoosterOptions) {
        // Instance stays inert if init fails: public methods do nothing
        this.isDestroyed = true;

        if (!(options.viewport instanceof Element)) {
            console.error(`ScrollBooster init error: ${getElementsError(options.viewport, null)}`);
            return;
        }

        const defaults: Omit<Props, 'viewport'> = {
            content: options.viewport.children[0] as HTMLElement,
            direction: 'all', // 'vertical', 'horizontal'
            pointerMode: 'all', // 'touch', 'mouse'
            scrollMode: undefined, // 'transform', 'native'
            bounce: true,
            bounceForce: 0.1,
            friction: 0.05,
            textSelection: false,
            inputsFocus: true,
            emulateScroll: false,
            preventDefaultOnEmulateScroll: false, // 'vertical', 'horizontal'
            preventPointerMoveDefault: true,
            lockScrollOnDragDirection: false, // 'vertical', 'horizontal', 'all'
            pointerDownPreventDefault: true,
            dragDirectionTolerance: 40,
            reducedMotion: 'auto',
            onPointerDown() {},
            onPointerUp() {},
            onPointerMove() {},
            onClick() {},
            onUpdate() {},
            onWheel() {},
            shouldScroll() {
                return true;
            },
        };

        this.props = { ...defaults, ...options } as Props;

        const error = getElementsError(this.props.viewport, this.props.content);
        if (error) {
            console.error(`ScrollBooster init error: ${error}`);
            return;
        }

        this.isDestroyed = false;
        this.isDragging = false;
        this.isTargetScroll = false;
        this.isScrolling = false;
        this.isRunning = false;

        const START_COORDINATES = { x: 0, y: 0 };

        this.position = getScrollPosition(this.props.viewport);
        if (this.props.scrollMode === 'transform') {
            this.props.viewport.scrollLeft = 0;
            this.props.viewport.scrollTop = 0;
        }
        this.velocity = { ...START_COORDINATES };
        this.dragStartPosition = { ...START_COORDINATES };
        this.dragOffset = { ...START_COORDINATES };
        this.clientOffset = { ...START_COORDINATES };
        this.dragPosition = { ...START_COORDINATES };
        this.targetPosition = { ...START_COORDINATES };
        this.scrollOffset = { ...START_COORDINATES };

        this.rafID = null;
        this.lastFrameTime = null;
        this.frameDuration = FRAME_DURATION;
        this.wheelTimer = undefined;
        this.dragController = null;
        this.events = {} as EventHandlers;

        this.updateMetrics();
        this.handleEvents();
    }

    /**
     * Update options object with new given values
     */
    updateOptions(options: Partial<ScrollBoosterOptions> = {}): void {
        if (this.isDestroyed) {
            return;
        }

        const { viewport, content } = this.props;
        const nextProps = { ...this.props, ...options };
        // New viewport without explicit content gets its first child as content
        if (options.viewport !== undefined && options.viewport !== viewport && !('content' in options)) {
            nextProps.content = options.viewport?.children?.[0] as HTMLElement;
        }

        if (nextProps.viewport === viewport && nextProps.content === content) {
            this.props = nextProps;
            this.bindWheel();
            this.applyTouchAction();
            this.props.onUpdate(this.getState());
            this.startAnimationLoop();
            return;
        }

        const error = getElementsError(nextProps.viewport, nextProps.content);
        if (error) {
            console.error(`ScrollBooster updateOptions error: ${error}`);
            return;
        }

        this.props = nextProps;
        this.unbindEvents();
        this.isDragging = false;
        if (this.props.viewport !== viewport) {
            this.position = getScrollPosition(this.props.viewport);
            this.velocity = { x: 0, y: 0 };
        }
        this.handleEvents();
        this.updateMetrics();
    }

    /**
     * Update DOM container elements metrics (width and height)
     */
    updateMetrics(): void {
        if (this.isDestroyed) {
            return;
        }

        const { viewport, content } = this.measure();
        this.viewport = viewport;
        this.content = content;
        this.edgeX = {
            from: Math.min(-this.content.width + this.viewport.width, 0),
            to: 0,
        };
        this.edgeY = {
            from: Math.min(-this.content.height + this.viewport.height, 0),
            to: 0,
        };

        this.props.onUpdate(this.getState());
        this.startAnimationLoop();
    }

    /**
     * Run animation loop
     */
    startAnimationLoop(): void {
        if (this.isDestroyed) {
            return;
        }
        if (!this.isRunning) {
            this.lastFrameTime = null;
        }
        this.isRunning = true;
        cancelAnimationFrame(this.rafID as number);
        this.rafID = requestAnimationFrame((time) => this.animate(time));
    }

    /**
     * Main animation loop
     */
    animate(time?: number): void {
        if (!this.isRunning || this.isDestroyed) {
            return;
        }
        const frames = this.getElapsedFrames(time);
        if (frames > 0) {
            this.updateScrollPosition(frames);
        }
        // stop animation loop if nothing moves
        if (!this.isMoving()) {
            this.settle();
            this.isRunning = false;
            this.isTargetScroll = false;
        }
        const state = this.getState();
        this.setContentPosition(state);
        this.props.onUpdate(state);
        this.rafID = requestAnimationFrame((nextTime) => this.animate(nextTime));
    }

    /**
     * Time since the previous animation frame, in 60 Hz frames. The first frame of a loop has no previous one
     * and reuses the last measured frame duration.
     */
    private getElapsedFrames(time: number | undefined): number {
        if (time === undefined) {
            return 1;
        }
        const previousTime = this.lastFrameTime;
        this.lastFrameTime = time;
        if (previousTime === null) {
            return this.frameDuration / FRAME_DURATION;
        }
        const duration = Math.min(time - previousTime, MAX_FRAME_DURATION);
        if (duration > 0) {
            this.frameDuration = duration;
        }
        return Math.max(duration, 0) / FRAME_DURATION;
    }

    /**
     * Finish exactly at the scroll target or at the edge, motion stops a fraction of a pixel short of them
     */
    private settle(): void {
        if (this.isTargetScroll) {
            if (this.props.direction !== 'vertical') {
                this.position.x = this.targetPosition.x;
            }
            if (this.props.direction !== 'horizontal') {
                this.position.y = this.targetPosition.y;
            }
        } else {
            this.position.x = clamp(this.position.x, this.edgeX);
            this.position.y = clamp(this.position.y, this.edgeY);
        }
        this.velocity.x = 0;
        this.velocity.y = 0;
    }

    /**
     * Calculate and set new scroll position after given number of 60 Hz frames
     */
    updateScrollPosition(frames = 1): void {
        const bounce = this.props.bounce && !this.isReducedMotion();
        // Disabled axis keeps no velocity: in 3.x scrollTo along it kept the animation loop running forever
        if (this.props.direction !== 'vertical') {
            ({ position: this.position.x, velocity: this.velocity.x } = this.getAxisMotion('x', frames, bounce));
        } else {
            this.velocity.x = 0;
        }
        if (this.props.direction !== 'horizontal') {
            ({ position: this.position.y, velocity: this.velocity.y } = this.getAxisMotion('y', frames, bounce));
        } else {
            this.velocity.y = 0;
        }

        this.scrollOffset.x = 0;
        this.scrollOffset.y = 0;

        // disable bounce effect
        if ((!bounce || this.isScrolling) && !this.isTargetScroll) {
            this.position.x = clamp(this.position.x, this.edgeX);
            this.position.y = clamp(this.position.y, this.edgeY);
        }
    }

    /**
     * Motion along one axis. Modes go in order of precedence: in 3.x forces of later modes overwrote velocity
     */
    private getAxisMotion(axis: 'x' | 'y', frames: number, bounce: boolean): Motion {
        const { friction, bounceForce } = this.props;
        const retention = 1 - friction;
        const position = this.position[axis];
        const velocity = this.velocity[axis];

        if (this.isTargetScroll) {
            return approach(position, this.targetPosition[axis], 1 - TARGET_SCROLL_FACTOR * retention, frames);
        }
        // Wheel moves content once per event, regardless of frame duration
        if (this.isScrolling) {
            const step = this.scrollOffset[axis] * retention;
            return { position: position + step, velocity: step };
        }
        if (this.isDragging) {
            return approach(position, this.dragPosition[axis], friction, frames);
        }
        if (bounce) {
            const edge = axis === 'x' ? this.edgeX : this.edgeY;
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

    private isReducedMotion(): boolean {
        const { reducedMotion } = this.props;
        return reducedMotion === 'auto' ? prefersReducedMotion() : reducedMotion === 'always';
    }

    /**
     * Check if scrolling happening
     */
    isMoving(): boolean {
        return this.isDragging || this.isScrolling || hasVelocity(this.velocity);
    }

    /**
     * Set scroll target coordinate for smooth scroll
     */
    scrollTo(position: Partial<Point> = {}): void {
        if (this.isDestroyed) {
            return;
        }
        if (this.isReducedMotion()) {
            this.setPosition(position);
            return;
        }
        this.isTargetScroll = true;
        this.targetPosition.x = -(position.x as number) || 0;
        this.targetPosition.y = -(position.y as number) || 0;
        this.startAnimationLoop();
    }

    /**
     * Manual position setting
     */
    setPosition(position: Partial<Point> = {}): void {
        if (this.isDestroyed) {
            return;
        }
        this.isTargetScroll = false;
        this.velocity.x = 0;
        this.velocity.y = 0;
        this.position.x = -(position.x as number) || 0;
        this.position.y = -(position.y as number) || 0;
        this.startAnimationLoop();
    }

    /**
     * Read current sizes of viewport and content
     */
    private measure(): Metrics {
        const { viewport, content } = this.props;
        return {
            viewport: { width: viewport.clientWidth, height: viewport.clientHeight },
            content: { width: getFullWidth(content), height: getFullHeight(content) },
        };
    }

    /**
     * Get latest metrics and coordinates
     */
    getState(): ScrollBoosterState {
        return {
            isMoving: this.isMoving(),
            isDragging: !!(this.dragOffset.x || this.dragOffset.y),
            // 0 - value avoids -0 at the start edge
            position: { x: 0 - this.position.x, y: 0 - this.position.y },
            dragOffset: this.dragOffset,
            dragAngle: this.getDragAngle(this.clientOffset.x, this.clientOffset.y),
            borderCollision: {
                left: this.position.x >= this.edgeX.to,
                right: this.position.x <= this.edgeX.from,
                top: this.position.y >= this.edgeY.to,
                bottom: this.position.y <= this.edgeY.from,
            },
        };
    }

    /**
     * Get drag angle (up: 180, left: -90, right: 90, down: 0)
     */
    getDragAngle(x: number, y: number): number {
        return getDragAngle(x, y);
    }

    /**
     * Get drag direction (horizontal or vertical)
     */
    getDragDirection(angle: number, tolerance: number): Axis {
        return getDragDirection(angle, tolerance);
    }

    /**
     * Update DOM container elements metrics (width and height)
     */
    setContentPosition(state: ScrollBoosterState): void {
        if (this.props.scrollMode === 'transform') {
            this.props.content.style.transform = `translate(${-state.position.x}px, ${-state.position.y}px)`;
        }
        if (this.props.scrollMode === 'native') {
            this.props.viewport.scrollTop = state.position.y;
            this.props.viewport.scrollLeft = state.position.x;
        }
    }

    /**
     * Register all DOM events
     */
    handleEvents(): void {
        const dragOrigin = { x: 0, y: 0 };
        const clientOrigin = { x: 0, y: 0 };
        let dragDirection: Axis | null = null;
        let isTouch = false;
        let activePointerId: number | null = null;
        let isCaptured = false;
        let preventMouseDown = false;

        const setDragPosition = (event: PointerEvent) => {
            if (!this.isDragging) {
                return;
            }

            const { pageX, pageY, clientX, clientY } = event;

            this.dragOffset.x = pageX - dragOrigin.x;
            this.dragOffset.y = pageY - dragOrigin.y;

            this.clientOffset.x = clientX - clientOrigin.x;
            this.clientOffset.y = clientY - clientOrigin.y;

            // get dragDirection if offset threshold is reached
            if (
                (Math.abs(this.clientOffset.x) > 5 && !dragDirection) ||
                (Math.abs(this.clientOffset.y) > 5 && !dragDirection)
            ) {
                dragDirection = this.getDragDirection(
                    this.getDragAngle(this.clientOffset.x, this.clientOffset.y),
                    this.props.dragDirectionTolerance
                );
            }

            // prevent scroll if not expected scroll direction
            if (this.props.lockScrollOnDragDirection && this.props.lockScrollOnDragDirection !== 'all') {
                if (dragDirection === this.props.lockScrollOnDragDirection && isTouch) {
                    this.dragPosition.x = this.dragStartPosition.x + this.dragOffset.x;
                    this.dragPosition.y = this.dragStartPosition.y + this.dragOffset.y;
                } else if (!isTouch) {
                    this.dragPosition.x = this.dragStartPosition.x + this.dragOffset.x;
                    this.dragPosition.y = this.dragStartPosition.y + this.dragOffset.y;
                } else {
                    this.dragPosition.x = this.dragStartPosition.x;
                    this.dragPosition.y = this.dragStartPosition.y;
                }
            } else {
                this.dragPosition.x = this.dragStartPosition.x + this.dragOffset.x;
                this.dragPosition.y = this.dragStartPosition.y + this.dragOffset.y;
            }
        };

        const endDrag = (event: PointerEvent) => {
            if (event.pointerId !== activePointerId) {
                return;
            }
            this.isDragging = false;
            dragDirection = null;
            activePointerId = null;
            if (this.isReducedMotion()) {
                this.velocity.x = 0;
                this.velocity.y = 0;
            }
            this.dragController?.abort();
            this.dragController = null;
            this.props.onPointerUp(this.getState(), event, isTouch);
        };

        this.events.pointerdown = (event) => {
            // One pointer drags at a time, other fingers on viewport are ignored until it is released
            if (activePointerId !== null && event.pointerId !== activePointerId) {
                return;
            }

            isTouch = event.pointerType === 'touch';
            preventMouseDown = false;

            this.props.onPointerDown(this.getState(), event, isTouch);

            const { pageX, pageY, clientX, clientY } = event;

            const { viewport } = this.props;
            const rect = viewport.getBoundingClientRect();

            // click on vertical scrollbar
            if (clientX - rect.left >= viewport.clientLeft + viewport.clientWidth) {
                return;
            }

            // click on horizontal scrollbar
            if (clientY - rect.top >= viewport.clientTop + viewport.clientHeight) {
                return;
            }

            // interaction disabled by user
            if (!this.props.shouldScroll(this.getState(), event)) {
                return;
            }

            // only main mouse button, touch and pen contact report button 0 too
            if (event.button !== 0) {
                return;
            }

            // disable on mobile
            if (this.props.pointerMode === 'mouse' && isTouch) {
                return;
            }

            // disable on desktop
            if (this.props.pointerMode === 'touch' && !isTouch) {
                return;
            }

            const target = event.target as Element;

            // focus on form input elements
            const formNodes = ['input', 'textarea', 'button', 'select', 'label'];
            if (this.props.inputsFocus && formNodes.indexOf(target.nodeName.toLowerCase()) > -1) {
                return;
            }

            // handle text selection
            if (this.props.textSelection) {
                const textNode = textNodeFromPoint(target, clientX, clientY);
                if (textNode) {
                    return;
                }
                clearTextSelection();
            }

            this.isDragging = true;
            this.isTargetScroll = false;
            activePointerId = event.pointerId;
            isCaptured = false;

            dragOrigin.x = pageX;
            dragOrigin.y = pageY;

            clientOrigin.x = clientX;
            clientOrigin.y = clientY;

            this.dragStartPosition.x = this.position.x;
            this.dragStartPosition.y = this.position.y;

            setDragPosition(event);
            this.startAnimationLoop();

            // Pointer may leave viewport before capture, so drag events are listened on window until release
            this.dragController?.abort();
            this.dragController = new AbortController();
            const options = { capture: true, signal: this.dragController.signal };
            window.addEventListener('pointermove', this.events.pointermove, options);
            window.addEventListener('pointerup', this.events.pointerup, options);
            window.addEventListener('pointercancel', this.events.pointerup, options);

            // Canceling pointerdown would also suppress mousedown for other listeners, like "click outside" handlers
            preventMouseDown = !isTouch && this.props.pointerDownPreventDefault;
        };

        // Compatibility mousedown follows pointerdown, its default action is text selection and native drag
        this.events.mousedown = (event) => {
            if (preventMouseDown) {
                preventMouseDown = false;
                event.preventDefault();
            }
        };

        this.events.pointermove = (event) => {
            if (event.pointerId !== activePointerId) {
                return;
            }
            setDragPosition(event);
            // Capture right away would retarget a plain click on content to viewport, so wait for the click threshold
            if (!isCaptured && this.isPastClickThreshold()) {
                isCaptured = true;
                try {
                    this.props.viewport.setPointerCapture(event.pointerId);
                } catch {
                    // Pointer is not active anymore
                }
            }
            this.props.onPointerMove(this.getState(), event, isTouch);
        };

        this.events.pointerup = endDrag;

        this.events.wheel = (event) => {
            const state = this.getState();
            if (!this.props.emulateScroll) {
                return;
            }
            this.velocity.x = 0;
            this.velocity.y = 0;
            this.isScrolling = true;
            this.isTargetScroll = false;

            this.scrollOffset.x = -event.deltaX;
            this.scrollOffset.y = -event.deltaY;

            this.props.onWheel(state, event);

            this.startAnimationLoop();

            clearTimeout(this.wheelTimer);
            this.wheelTimer = setTimeout(() => {
                this.isScrolling = false;
            }, 80);

            // get (trackpad) scrollDirection and prevent default events
            if (
                this.props.preventDefaultOnEmulateScroll &&
                this.getDragDirection(
                    this.getDragAngle(-event.deltaX, -event.deltaY),
                    this.props.dragDirectionTolerance
                ) === this.props.preventDefaultOnEmulateScroll
            ) {
                event.preventDefault();
            }
        };

        this.events.scroll = () => {
            const { scrollLeft, scrollTop } = this.props.viewport;
            if (this.props.scrollMode === 'transform') {
                this.moveNativeScrollToTransform();
                return;
            }
            if (Math.abs(this.position.x + scrollLeft) > 3) {
                this.position.x = -scrollLeft;
                this.velocity.x = 0;
            }
            if (Math.abs(this.position.y + scrollTop) > 3) {
                this.position.y = -scrollTop;
                this.velocity.y = 0;
            }
        };

        // Content moved with transform has no native scroll to bring focused element into view
        this.events.focusin = (event) => {
            if (this.props.scrollMode === 'transform' && event.target instanceof Element) {
                this.revealElement(event.target);
            }
        };

        this.events.click = (event) => {
            const state = this.getState();
            if (this.isPastClickThreshold()) {
                event.preventDefault();
                event.stopPropagation();
            }
            this.props.onClick(state, event, isTouch);
        };

        this.events.contentLoad = () => this.updateMetrics();

        this.abortController = new AbortController();
        const { signal } = this.abortController;
        const { viewport, content } = this.props;

        viewport.addEventListener('pointerdown', this.events.pointerdown, { signal });
        viewport.addEventListener('mousedown', this.events.mousedown, { signal });
        viewport.addEventListener('click', this.events.click, { signal });
        viewport.addEventListener('scroll', this.events.scroll, { signal });
        viewport.addEventListener('focusin', this.events.focusin, { signal });
        // ResizeObserver misses scrollWidth growth of fixed-size content, so loaded images still update metrics
        content.addEventListener('load', this.events.contentLoad, { capture: true, signal });
        this.bindWheel();

        this.initialTouchAction = viewport.style.touchAction;
        this.applyTouchAction();

        this.resizeObserver = new ResizeObserver(() => {
            // Initial notification after observe() usually has nothing new
            const metrics = this.measure();
            if (!isSameSize(metrics.viewport, this.viewport) || !isSameSize(metrics.content, this.content)) {
                this.updateMetrics();
            }
        });
        this.resizeObserver.observe(viewport);
        this.resizeObserver.observe(content);
    }

    /**
     * Jump by given offset along allowed directions, within edges
     */
    private jumpBy(x: number, y: number): void {
        if (this.props.direction !== 'vertical') {
            this.position.x = clamp(this.position.x - x, this.edgeX);
        }
        if (this.props.direction !== 'horizontal') {
            this.position.y = clamp(this.position.y - y, this.edgeY);
        }
        this.velocity.x = 0;
        this.velocity.y = 0;
        this.isTargetScroll = false;
        // Render right away: focus scroll and scroll events happen before the next paint
        const state = this.getState();
        this.setContentPosition(state);
        this.props.onUpdate(state);
    }

    /**
     * In transform mode browser can still scroll viewport natively (focus, find in page, anchor links).
     * Reset native scroll and shift transform by the same offset.
     */
    private moveNativeScrollToTransform(): void {
        const { viewport } = this.props;
        const { scrollLeft, scrollTop } = viewport;
        if (!scrollLeft && !scrollTop) {
            return;
        }
        viewport.scrollLeft = 0;
        viewport.scrollTop = 0;
        this.jumpBy(scrollLeft, scrollTop);
    }

    /**
     * Scroll the smallest distance that shows the element inside viewport, start edge wins for large elements
     */
    private revealElement(element: Element): void {
        const { viewport } = this.props;
        const box = viewport.getBoundingClientRect();
        const left = box.left + viewport.clientLeft;
        const top = box.top + viewport.clientTop;
        const rect = element.getBoundingClientRect();
        const offset = (start: number, end: number, visibleStart: number, visibleSize: number) => {
            if (start < visibleStart) {
                return start - visibleStart;
            }
            if (end > visibleStart + visibleSize) {
                return Math.min(end - visibleStart - visibleSize, start - visibleStart);
            }
            return 0;
        };
        const x = offset(rect.left, rect.right, left, viewport.clientWidth);
        const y = offset(rect.top, rect.bottom, top, viewport.clientHeight);
        if (x || y) {
            this.jumpBy(x, y);
        }
    }

    /**
     * Remove DOM listeners and stop observing element sizes
     */
    private unbindEvents(): void {
        this.abortController.abort();
        this.dragController?.abort();
        this.dragController = null;
        this.resizeObserver.disconnect();
        this.props.viewport.style.touchAction = this.initialTouchAction;
    }

    /**
     * Wheel listener blocks page scroll only when it may prevent default
     */
    private bindWheel(): void {
        const { viewport, emulateScroll, preventDefaultOnEmulateScroll } = this.props;
        viewport.removeEventListener('wheel', this.events.wheel);
        viewport.addEventListener('wheel', this.events.wheel, {
            passive: !(emulateScroll && preventDefaultOnEmulateScroll),
            signal: this.abortController.signal,
        });
    }

    /**
     * Leave native touch scroll to the browser only in directions that do not drag content
     */
    private applyTouchAction(): void {
        const { viewport, pointerMode, direction, lockScrollOnDragDirection } = this.props;
        if (pointerMode === 'mouse') {
            viewport.style.touchAction = this.initialTouchAction;
        } else if (lockScrollOnDragDirection === 'all') {
            viewport.style.touchAction = 'none';
        } else {
            viewport.style.touchAction = TOUCH_ACTION[lockScrollOnDragDirection || direction];
        }
    }

    /**
     * Check if pointer moved far enough along scroll directions to count as drag, not click
     */
    private isPastClickThreshold(): boolean {
        const x = this.props.direction !== 'vertical' ? this.dragOffset.x : 0;
        const y = this.props.direction !== 'horizontal' ? this.dragOffset.y : 0;
        return Math.max(Math.abs(x), Math.abs(y)) > CLICK_EVENT_THRESHOLD_PX;
    }

    /**
     * Stop animation, remove DOM listeners and observers. Methods of destroyed instance do nothing.
     */
    destroy(): void {
        if (this.isDestroyed) {
            return;
        }
        this.isDestroyed = true;
        this.isRunning = false;
        this.isDragging = false;
        this.isScrolling = false;
        cancelAnimationFrame(this.rafID as number);
        this.rafID = null;
        clearTimeout(this.wheelTimer);
        this.unbindEvents();
    }
}
