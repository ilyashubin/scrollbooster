import { clearTextSelection, getFullHeight, getFullWidth, textNodeFromPoint } from './dom';
import { validateElements, validateOptions } from './options';
import {
    approach,
    clamp,
    coast,
    FRAME_DURATION,
    getDragAngle,
    getEdgeMode,
    hasVelocity,
    type Motion,
    spring,
    TARGET_SCROLL_FACTOR,
} from './physics';
import type { Direction, Edge, Point, ScrollBoosterOptions, ScrollBoosterState, ScrollMode, Size } from './types';

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

type Props = Required<ScrollBoosterOptions>;

interface EventHandlers {
    pointerdown: (event: PointerEvent) => void;
    preventDuringDrag: (event: Event) => void;
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

// Public coordinates grow to the right and down, internal ones are content offsets with the opposite sign.
// Missing coordinate keeps the given internal value, `|| 0` turns -0 and NaN into 0.
const toInternal = (value: number | undefined, current: number): number =>
    value === undefined ? current : -value || 0;

// Wheel deltas in lines are converted with this line height, in pages with the viewport size
const WHEEL_LINE_HEIGHT = 16;

// Wheel events closer than this belong to one gesture
const WHEEL_GESTURE_TIMEOUT = 80;

export class ScrollBooster {
    private props: Props;
    private isDestroyed = false;
    // Pointer is pressed, the press counts as a drag in getState() only past the click threshold
    private isDragging = false;
    private isTargetScroll = false;
    private isScrolling = false;
    private isRunning = false;
    // Content offset: coordinates of getState() with the opposite sign
    private position: Point;
    private velocity: Point = { x: 0, y: 0 };
    private dragStartPosition: Point = { x: 0, y: 0 };
    private dragOffset: Point = { x: 0, y: 0 };
    private clientOffset: Point = { x: 0, y: 0 };
    private dragPosition: Point = { x: 0, y: 0 };
    private targetPosition: Point = { x: 0, y: 0 };
    private scrollOffset: Point = { x: 0, y: 0 };
    private metrics: Metrics = { viewport: { width: 0, height: 0 }, content: { width: 0, height: 0 } };
    private edgeX: Edge = { from: 0, to: 0 };
    private edgeY: Edge = { from: 0, to: 0 };
    private rafID: number | null = null;
    private lastFrameTime: number | null = null;
    private frameDuration = FRAME_DURATION;
    private wheelTimer: ReturnType<typeof setTimeout> | undefined;
    private events = {} as EventHandlers;
    private dragController: AbortController | null = null;
    // Set by bindEvents() from the constructor
    private abortController!: AbortController;
    private resizeObserver!: ResizeObserver;
    private initialTouchAction = '';

    /**
     * Create ScrollBooster instance. Throws TypeError for invalid options.
     */
    constructor(options: ScrollBoosterOptions) {
        validateOptions(options);
        const content = options.content ?? options.viewport?.firstElementChild;
        validateElements(options.viewport, content);

        const defaults: Omit<Props, 'viewport' | 'content'> = {
            direction: 'all',
            pointerMode: 'all',
            scrollMode: 'transform',
            bounce: true,
            bounceForce: 0.1,
            friction: 0.05,
            textSelection: false,
            inputsFocus: true,
            wheel: true,
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
        this.props = { ...defaults, ...options, content } as Props;

        this.position = getScrollPosition(this.props.viewport);
        if (this.props.scrollMode === 'transform') {
            this.props.viewport.scrollLeft = 0;
            this.props.viewport.scrollTop = 0;
        }

        this.updateMetrics();
        this.bindEvents();
    }

    /**
     * Update options with given values. Throws TypeError for invalid options and keeps the current ones.
     */
    updateOptions(options: Partial<ScrollBoosterOptions>): void {
        if (this.isDestroyed) {
            return;
        }

        validateOptions(options);
        const { viewport, content, scrollMode } = this.props;
        // New viewport without explicit content gets its first child as content
        const isNewViewport = options.viewport && options.viewport !== viewport;
        const nextContent = options.content ?? (isNewViewport ? options.viewport?.firstElementChild : content);
        const nextProps = { ...this.props, ...options };
        validateElements(nextProps.viewport, nextContent);
        nextProps.content = nextContent;

        if (nextProps.viewport === viewport && nextProps.content === content) {
            this.props = nextProps;
            this.bindWheel();
            this.applyTouchAction();
            if (this.props.scrollMode !== scrollMode) {
                this.switchScrollMode(scrollMode);
            }
            this.updateMetrics();
            return;
        }

        // Previous content keeps no transform left from this instance
        if (scrollMode === 'transform') {
            content.style.transform = '';
        }
        this.props = nextProps;
        this.unbindEvents();
        this.isDragging = false;
        if (this.props.viewport !== viewport) {
            this.position = getScrollPosition(this.props.viewport);
            this.velocity = { x: 0, y: 0 };
        }
        this.bindEvents();
        this.updateMetrics();
    }

    /**
     * Update DOM container elements metrics (width and height)
     */
    updateMetrics(): void {
        if (this.isDestroyed) {
            return;
        }

        this.metrics = this.measure();
        const { viewport, content } = this.metrics;
        this.edgeX = { from: Math.min(viewport.width - content.width, 0), to: 0 };
        this.edgeY = { from: Math.min(viewport.height - content.height, 0), to: 0 };

        // Next frame renders new state and returns content within new edges
        this.startAnimationLoop();
    }

    /**
     * Run animation loop
     */
    private startAnimationLoop(): void {
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
    private animate(time: number): void {
        if (!this.isRunning || this.isDestroyed) {
            return;
        }
        const frameId = this.rafID;
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
        // onUpdate may have restarted the loop or destroyed the instance
        if (this.rafID !== frameId) {
            return;
        }
        this.rafID = this.isRunning ? requestAnimationFrame((nextTime) => this.animate(nextTime)) : null;
    }

    /**
     * Time since the previous animation frame, in 60 Hz frames. The first frame of a loop has no previous one
     * and reuses the last measured frame duration.
     */
    private getElapsedFrames(time: number): number {
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
     * Finish exactly at the scroll target or at the edge, motion stops a fraction of a pixel short of them.
     * Edges may have shrunk since scrollTo, so the target is kept within them too.
     */
    private settle(): void {
        if (this.isTargetScroll) {
            if (this.props.direction !== 'vertical') {
                this.position.x = this.targetPosition.x;
            }
            if (this.props.direction !== 'horizontal') {
                this.position.y = this.targetPosition.y;
            }
        }
        this.position.x = clamp(this.position.x, this.edgeX);
        this.position.y = clamp(this.position.y, this.edgeY);
        this.velocity.x = 0;
        this.velocity.y = 0;
    }

    /**
     * Calculate and set new scroll position after given number of 60 Hz frames
     */
    private updateScrollPosition(frames: number): void {
        const bounce = this.props.bounce && !this.isReducedMotion();
        // Disabled axis keeps no velocity, otherwise scrollTo along it would keep the animation loop running forever
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

        // Content goes beyond edges only with bounce, and never with wheel
        if (!bounce || this.isScrolling) {
            this.position.x = clamp(this.position.x, this.edgeX);
            this.position.y = clamp(this.position.y, this.edgeY);
        }
    }

    /**
     * Motion along one axis. Modes go in order of precedence, each one sets velocity on its own
     */
    private getAxisMotion(axis: 'x' | 'y', frames: number, bounce: boolean): Motion {
        const { friction, bounceForce } = this.props;
        const retention = 1 - friction;
        const position = this.position[axis];
        const velocity = this.velocity[axis];

        if (this.isTargetScroll) {
            return approach(position, this.targetPosition[axis], 1 - TARGET_SCROLL_FACTOR * retention, frames);
        }
        // Wheel moves content by the deltas of events since the previous frame, regardless of frame duration
        if (this.isScrolling) {
            const step = this.scrollOffset[axis];
            return { position: position + step, velocity: 0 };
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
    private isMoving(): boolean {
        return this.isDragging || this.isScrolling || hasVelocity(this.velocity);
    }

    /**
     * Smoothly scroll to the position within edges. Does nothing while the user drags content
     */
    scrollTo(position: Partial<Point> = {}): void {
        // Drag takes precedence: content stays under the pointer
        if (this.isDestroyed || this.isDragging) {
            return;
        }
        if (this.isReducedMotion()) {
            this.setPosition(position);
            return;
        }
        // Missing coordinate keeps the target of a running scrollTo or the current position, all within edges
        const current = this.isTargetScroll ? this.targetPosition : this.position;
        this.targetPosition.x = clamp(toInternal(position.x, current.x), this.edgeX);
        this.targetPosition.y = clamp(toInternal(position.y, current.y), this.edgeY);
        this.isTargetScroll = true;
        this.startAnimationLoop();
    }

    /**
     * Jump to the position within edges, stops any motion
     */
    setPosition(position: Partial<Point> = {}): void {
        if (this.isDestroyed) {
            return;
        }
        this.isTargetScroll = false;
        this.velocity.x = 0;
        this.velocity.y = 0;
        this.position.x = clamp(toInternal(position.x, this.position.x), this.edgeX);
        this.position.y = clamp(toInternal(position.y, this.position.y), this.edgeY);
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
        const { viewport, content } = this.metrics;
        return {
            isMoving: this.isMoving(),
            // A press becomes a drag past the click threshold, before it the gesture may still be a click
            isDragging: this.isDragging && this.isPastClickThreshold(),
            // 0 - value avoids -0 at the start edge
            position: { x: 0 - this.position.x, y: 0 - this.position.y },
            dragOffset: { ...this.dragOffset },
            dragAngle: getDragAngle(this.clientOffset.x, this.clientOffset.y),
            borderCollision: {
                left: this.position.x >= this.edgeX.to,
                right: this.position.x <= this.edgeX.from,
                top: this.position.y >= this.edgeY.to,
                bottom: this.position.y <= this.edgeY.from,
            },
            viewport: { ...viewport },
            content: { ...content },
            maxPosition: { x: 0 - this.edgeX.from, y: 0 - this.edgeY.from },
        };
    }

    /**
     * Render position with the built-in scroll mode
     */
    private setContentPosition(state: ScrollBoosterState): void {
        if (this.props.scrollMode === 'transform') {
            this.props.content.style.transform = `translate(${-state.position.x}px, ${-state.position.y}px)`;
        }
        if (this.props.scrollMode === 'native') {
            this.props.viewport.scrollTop = state.position.y;
            this.props.viewport.scrollLeft = state.position.x;
        }
    }

    /**
     * Remove rendering of the previous scroll mode, so offsets of two modes do not add up.
     * Native scroll left by a custom `onUpdate` renderer stays, it may be the way that renderer scrolls.
     */
    private switchScrollMode(previous: ScrollMode): void {
        const { viewport, content, scrollMode } = this.props;
        if (previous === 'transform') {
            content.style.transform = '';
        }
        if (scrollMode === 'transform') {
            viewport.scrollLeft = 0;
            viewport.scrollTop = 0;
        }
        this.setContentPosition(this.getState());
    }

    /**
     * Register all DOM events
     */
    private bindEvents(): void {
        const dragOrigin = { x: 0, y: 0 };
        const clientOrigin = { x: 0, y: 0 };
        let activePointerId: number | null = null;
        let activePointerType = '';
        let isCaptured = false;
        // The click that follows a drag past the click threshold is prevented
        let preventClick = false;

        const setDragPosition = (event: PointerEvent) => {
            if (!this.isDragging) {
                return;
            }

            const { pageX, pageY, clientX, clientY } = event;

            this.dragOffset.x = pageX - dragOrigin.x;
            this.dragOffset.y = pageY - dragOrigin.y;

            this.clientOffset.x = clientX - clientOrigin.x;
            this.clientOffset.y = clientY - clientOrigin.y;

            this.dragPosition.x = this.dragStartPosition.x + this.dragOffset.x;
            this.dragPosition.y = this.dragStartPosition.y + this.dragOffset.y;
        };

        const stopDragging = () => {
            this.isDragging = false;
            activePointerId = null;
            this.dragOffset.x = 0;
            this.dragOffset.y = 0;
            this.clientOffset.x = 0;
            this.clientOffset.y = 0;
            this.dragController?.abort();
            this.dragController = null;
        };

        const endDrag = (event: PointerEvent) => {
            if (event.pointerId !== activePointerId) {
                return;
            }
            preventClick = this.isPastClickThreshold();
            this.isDragging = false;
            if (this.isReducedMotion()) {
                this.velocity.x = 0;
                this.velocity.y = 0;
            }
            // onPointerUp gets offset and angle of the drag that ended
            const state = this.getState();
            stopDragging();
            this.props.onPointerUp(state, event);
        };

        this.events.pointerdown = (event) => {
            // One pointer drags at a time, other fingers on viewport are ignored until it is released
            if (activePointerId !== null && event.pointerId !== activePointerId) {
                // Browser makes a pointer primary when no other pointer of its type is active:
                // pointerup of the dragging one was lost (element removed, capture lost)
                if (!event.isPrimary || event.pointerType !== activePointerType) {
                    return;
                }
                stopDragging();
            }

            const isTouch = event.pointerType === 'touch';
            preventClick = false;

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
            activePointerType = event.pointerType;
            isCaptured = false;

            dragOrigin.x = pageX;
            dragOrigin.y = pageY;

            clientOrigin.x = clientX;
            clientOrigin.y = clientY;

            this.dragStartPosition.x = this.position.x;
            this.dragStartPosition.y = this.position.y;

            setDragPosition(event);
            this.props.onPointerDown(this.getState(), event);
            this.startAnimationLoop();

            // Pointer may leave viewport before capture, so drag events are listened on window until release
            this.dragController?.abort();
            this.dragController = new AbortController();
            const options = { capture: true, signal: this.dragController.signal };
            window.addEventListener('pointermove', this.events.pointermove, options);
            window.addEventListener('pointerup', this.events.pointerup, options);
            window.addEventListener('pointercancel', this.events.pointerup, options);
        };

        // Text selection and native drag of images and links would take the pointer from the drag.
        // Mousedown keeps its default action, so a press moves focus like a click on any other element.
        this.events.preventDuringDrag = (event) => {
            if (this.isDragging) {
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
            this.props.onPointerMove(this.getState(), event);
        };

        this.events.pointerup = endDrag;

        // Listened only with the wheel option, see bindWheel()
        this.events.wheel = (event) => {
            // A scroller nested in the content has taken this event, or drag holds the content
            if (event.defaultPrevented || this.isDragging) {
                return;
            }
            // Line deltas are converted with a fixed line height, page deltas with the viewport size
            const { deltaMode } = event;
            const { clientWidth, clientHeight } = this.props.viewport;
            const pixels = deltaMode === WheelEvent.DOM_DELTA_LINE ? WHEEL_LINE_HEIGHT : 1;
            const x = event.deltaX * (deltaMode === WheelEvent.DOM_DELTA_PAGE ? clientWidth : pixels);
            const y = event.deltaY * (deltaMode === WheelEvent.DOM_DELTA_PAGE ? clientHeight : pixels);

            // Like native scroll, a wheel gesture stays with the scroller that took its first event
            // and goes to the page when content cannot move along the main axis of the gesture
            if (!this.isScrolling && !this.canScroll(Math.abs(x) > Math.abs(y) ? 'x' : 'y', x || y)) {
                return;
            }
            event.preventDefault();

            this.velocity.x = 0;
            this.velocity.y = 0;
            this.isScrolling = true;
            this.isTargetScroll = false;
            // Deltas of all events until the next frame add up
            this.scrollOffset.x -= x;
            this.scrollOffset.y -= y;

            this.props.onWheel(this.getState(), event);
            this.startAnimationLoop();

            clearTimeout(this.wheelTimer);
            this.wheelTimer = setTimeout(() => {
                this.isScrolling = false;
            }, WHEEL_GESTURE_TIMEOUT);
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

        // Content moved with transform has no native scroll to bring focused element into view.
        // Focus by the press that drags content keeps the content under the pointer.
        this.events.focusin = (event) => {
            if (this.props.scrollMode === 'transform' && !this.isDragging && event.target instanceof Element) {
                this.revealElement(event.target);
            }
        };

        this.events.click = (event) => {
            if (preventClick) {
                preventClick = false;
                event.preventDefault();
                event.stopPropagation();
            }
            this.props.onClick(this.getState(), event);
        };

        this.events.contentLoad = () => this.updateMetrics();

        this.abortController = new AbortController();
        const { signal } = this.abortController;
        const { viewport, content } = this.props;

        viewport.addEventListener('pointerdown', this.events.pointerdown, { signal });
        viewport.addEventListener('selectstart', this.events.preventDuringDrag, { signal });
        viewport.addEventListener('dragstart', this.events.preventDuringDrag, { signal });
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
            if (
                !isSameSize(metrics.viewport, this.metrics.viewport) ||
                !isSameSize(metrics.content, this.metrics.content)
            ) {
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
        // Render right away: browser computes focus scroll from the current layout
        this.setContentPosition(this.getState());
        this.startAnimationLoop();
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
     * Wheel listener cancels the events that scroll content, so it is not passive and is added only when needed
     */
    private bindWheel(): void {
        const { viewport, wheel } = this.props;
        viewport.removeEventListener('wheel', this.events.wheel);
        if (wheel) {
            viewport.addEventListener('wheel', this.events.wheel, {
                passive: false,
                signal: this.abortController.signal,
            });
        }
    }

    /**
     * Check if wheel delta along the axis would move content
     */
    private canScroll(axis: 'x' | 'y', delta: number): boolean {
        const { direction } = this.props;
        if (direction === (axis === 'x' ? 'vertical' : 'horizontal')) {
            return false;
        }
        const edge = axis === 'x' ? this.edgeX : this.edgeY;
        const position = this.position[axis];
        return delta > 0 ? position > edge.from : delta < 0 && position < edge.to;
    }

    /**
     * Leave native touch scroll to the browser only in directions that do not drag content
     */
    private applyTouchAction(): void {
        const { viewport, pointerMode, direction } = this.props;
        viewport.style.touchAction = pointerMode === 'mouse' ? this.initialTouchAction : TOUCH_ACTION[direction];
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
