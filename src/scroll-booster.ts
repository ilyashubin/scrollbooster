import { clearTextSelection, getFullHeight, getFullWidth, textNodeFromPoint } from './dom';
import {
    clamp,
    getDragAngle,
    getDragDirection,
    getDragForce,
    getEdgeForce,
    getScrollForce,
    getTargetForce,
    hasVelocity,
} from './physics';
import type {
    Axis,
    Edge,
    Point,
    PointerLikeEvent,
    ScrollBoosterOptions,
    ScrollBoosterState,
    ScrollMode,
    Size,
} from './types';

const CLICK_EVENT_THRESHOLD_PX = 5;

type Props = Required<Omit<ScrollBoosterOptions, 'scrollMode'>> & { scrollMode: ScrollMode | undefined };

interface EventHandlers {
    pointerdown: (event: PointerLikeEvent) => void;
    pointermove: (event: PointerLikeEvent) => void;
    pointerup: (event: PointerLikeEvent) => void;
    wheel: (event: WheelEvent) => void;
    scroll: () => void;
    click: (event: MouseEvent) => void;
    contentLoad: () => void;
    resize: () => void;
}

// Touch for touch events, the event itself for mouse events
const getPointerData = (event: PointerLikeEvent, isTouch: boolean): Touch | MouseEvent =>
    (isTouch ? (event as TouchEvent).touches[0] : event) as Touch | MouseEvent;

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

    /**
     * Create ScrollBooster instance
     */
    constructor(options: ScrollBoosterOptions = {} as ScrollBoosterOptions) {
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

        if (!this.props.viewport || !(this.props.viewport instanceof Element)) {
            console.error(`ScrollBooster init error: "viewport" config property must be present and must be Element`);
            return;
        }

        if (!this.props.content) {
            console.error(`ScrollBooster init error: Viewport does not have any content`);
            return;
        }

        this.isDragging = false;
        this.isTargetScroll = false;
        this.isScrolling = false;
        this.isRunning = false;

        const START_COORDINATES = { x: 0, y: 0 };

        this.position = { ...START_COORDINATES };
        this.velocity = { ...START_COORDINATES };
        this.dragStartPosition = { ...START_COORDINATES };
        this.dragOffset = { ...START_COORDINATES };
        this.clientOffset = { ...START_COORDINATES };
        this.dragPosition = { ...START_COORDINATES };
        this.targetPosition = { ...START_COORDINATES };
        this.scrollOffset = { ...START_COORDINATES };

        this.rafID = null;
        this.events = {} as EventHandlers;

        this.updateMetrics();
        this.handleEvents();
    }

    /**
     * Update options object with new given values
     */
    updateOptions(options: Partial<ScrollBoosterOptions> = {}): void {
        this.props = { ...this.props, ...options };
        this.props.onUpdate(this.getState());
        this.startAnimationLoop();
    }

    /**
     * Update DOM container elements metrics (width and height)
     */
    updateMetrics(): void {
        this.viewport = {
            width: this.props.viewport.clientWidth,
            height: this.props.viewport.clientHeight,
        };
        this.content = {
            width: getFullWidth(this.props.content),
            height: getFullHeight(this.props.content),
        };
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
        this.isRunning = true;
        cancelAnimationFrame(this.rafID as number);
        this.rafID = requestAnimationFrame(() => this.animate());
    }

    /**
     * Main animation loop
     */
    animate(): void {
        if (!this.isRunning) {
            return;
        }
        this.updateScrollPosition();
        // stop animation loop if nothing moves
        if (!this.isMoving()) {
            this.isRunning = false;
            this.isTargetScroll = false;
        }
        const state = this.getState();
        this.setContentPosition(state);
        this.props.onUpdate(state);
        this.rafID = requestAnimationFrame(() => this.animate());
    }

    /**
     * Calculate and set new scroll position
     */
    updateScrollPosition(): void {
        this.applyEdgeForce();
        this.applyDragForce();
        this.applyScrollForce();
        this.applyTargetForce();

        const inverseFriction = 1 - this.props.friction;
        this.velocity.x *= inverseFriction;
        this.velocity.y *= inverseFriction;

        if (this.props.direction !== 'vertical') {
            this.position.x += this.velocity.x;
        }
        if (this.props.direction !== 'horizontal') {
            this.position.y += this.velocity.y;
        }

        // disable bounce effect
        if ((!this.props.bounce || this.isScrolling) && !this.isTargetScroll) {
            this.position.x = clamp(this.position.x, this.edgeX);
            this.position.y = clamp(this.position.y, this.edgeY);
        }
    }

    /**
     * Increase general scroll velocity by given force amount
     */
    applyForce(force: Point): void {
        this.velocity.x += force.x;
        this.velocity.y += force.y;
    }

    /**
     * Apply force for bounce effect
     */
    applyEdgeForce(): void {
        if (!this.props.bounce || this.isDragging) {
            return;
        }

        const force = getEdgeForce(
            this.position,
            this.velocity,
            this.edgeX,
            this.edgeY,
            this.props.bounceForce,
            this.props.friction
        );
        if (force) {
            this.applyForce(force);
        }
    }

    /**
     * Apply force to move content while dragging with mouse/touch
     */
    applyDragForce(): void {
        if (!this.isDragging) {
            return;
        }

        this.applyForce(getDragForce(this.dragPosition, this.position, this.velocity));
    }

    /**
     * Apply force to emulate mouse wheel or trackpad
     */
    applyScrollForce(): void {
        if (!this.isScrolling) {
            return;
        }

        this.applyForce(getScrollForce(this.scrollOffset, this.velocity));

        this.scrollOffset.x = 0;
        this.scrollOffset.y = 0;
    }

    /**
     * Apply force to scroll to given target coordinate
     */
    applyTargetForce(): void {
        if (!this.isTargetScroll) {
            return;
        }

        this.applyForce(getTargetForce(this.targetPosition, this.position, this.velocity));
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
        this.isTargetScroll = true;
        this.targetPosition.x = -(position.x as number) || 0;
        this.targetPosition.y = -(position.y as number) || 0;
        this.startAnimationLoop();
    }

    /**
     * Manual position setting
     */
    setPosition(position: Partial<Point> = {}): void {
        this.velocity.x = 0;
        this.velocity.y = 0;
        this.position.x = -(position.x as number) || 0;
        this.position.y = -(position.y as number) || 0;
        this.startAnimationLoop();
    }

    /**
     * Get latest metrics and coordinates
     */
    getState(): ScrollBoosterState {
        return {
            isMoving: this.isMoving(),
            isDragging: !!(this.dragOffset.x || this.dragOffset.y),
            position: { x: -this.position.x, y: -this.position.y },
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
        let wheelTimer: ReturnType<typeof setTimeout> | undefined;
        let isTouch = false;

        const setDragPosition = (event: PointerLikeEvent) => {
            if (!this.isDragging) {
                return;
            }

            const { pageX, pageY, clientX, clientY } = getPointerData(event, isTouch);

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

        this.events.pointerdown = (event) => {
            isTouch = !!(event as TouchEvent).touches?.[0];

            this.props.onPointerDown(this.getState(), event, isTouch);

            const { pageX, pageY, clientX, clientY } = getPointerData(event, isTouch);

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

            // disable right mouse button scroll
            if ((event as MouseEvent).button === 2) {
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

            dragOrigin.x = pageX;
            dragOrigin.y = pageY;

            clientOrigin.x = clientX;
            clientOrigin.y = clientY;

            this.dragStartPosition.x = this.position.x;
            this.dragStartPosition.y = this.position.y;

            setDragPosition(event);
            this.startAnimationLoop();

            if (!isTouch && this.props.pointerDownPreventDefault) {
                event.preventDefault();
            }
        };

        this.events.pointermove = (event) => {
            // prevent default scroll if scroll direction is locked
            if (
                event.cancelable &&
                (this.props.lockScrollOnDragDirection === 'all' ||
                    this.props.lockScrollOnDragDirection === dragDirection)
            ) {
                event.preventDefault();
            }
            setDragPosition(event);
            this.props.onPointerMove(this.getState(), event, isTouch);
        };

        this.events.pointerup = (event) => {
            this.isDragging = false;
            dragDirection = null;
            this.props.onPointerUp(this.getState(), event, isTouch);
        };

        this.events.wheel = (event) => {
            const state = this.getState();
            if (!this.props.emulateScroll) {
                return;
            }
            this.velocity.x = 0;
            this.velocity.y = 0;
            this.isScrolling = true;

            this.scrollOffset.x = -event.deltaX;
            this.scrollOffset.y = -event.deltaY;

            this.props.onWheel(state, event);

            this.startAnimationLoop();

            clearTimeout(wheelTimer);
            wheelTimer = setTimeout(() => {
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
            if (Math.abs(this.position.x + scrollLeft) > 3) {
                this.position.x = -scrollLeft;
                this.velocity.x = 0;
            }
            if (Math.abs(this.position.y + scrollTop) > 3) {
                this.position.y = -scrollTop;
                this.velocity.y = 0;
            }
        };

        this.events.click = (event) => {
            const state = this.getState();
            const dragOffsetX = this.props.direction !== 'vertical' ? state.dragOffset.x : 0;
            const dragOffsetY = this.props.direction !== 'horizontal' ? state.dragOffset.y : 0;
            if (Math.max(Math.abs(dragOffsetX), Math.abs(dragOffsetY)) > CLICK_EVENT_THRESHOLD_PX) {
                event.preventDefault();
                event.stopPropagation();
            }
            this.props.onClick(state, event, isTouch);
        };

        this.events.contentLoad = () => this.updateMetrics();
        this.events.resize = () => this.updateMetrics();

        this.props.viewport.addEventListener('mousedown', this.events.pointerdown);
        this.props.viewport.addEventListener('touchstart', this.events.pointerdown, { passive: false });
        this.props.viewport.addEventListener('click', this.events.click);
        this.props.viewport.addEventListener('wheel', this.events.wheel, { passive: false });
        this.props.viewport.addEventListener('scroll', this.events.scroll);
        this.props.content.addEventListener('load', this.events.contentLoad, true);
        window.addEventListener('mousemove', this.events.pointermove);
        window.addEventListener('touchmove', this.events.pointermove, { passive: false });
        window.addEventListener('mouseup', this.events.pointerup);
        window.addEventListener('touchend', this.events.pointerup);
        window.addEventListener('resize', this.events.resize);
    }

    /**
     * Unregister all DOM events
     */
    destroy(): void {
        this.props.viewport.removeEventListener('mousedown', this.events.pointerdown);
        this.props.viewport.removeEventListener('touchstart', this.events.pointerdown);
        this.props.viewport.removeEventListener('click', this.events.click);
        this.props.viewport.removeEventListener('wheel', this.events.wheel);
        this.props.viewport.removeEventListener('scroll', this.events.scroll);
        this.props.content.removeEventListener('load', this.events.contentLoad);
        window.removeEventListener('mousemove', this.events.pointermove);
        window.removeEventListener('touchmove', this.events.pointermove);
        window.removeEventListener('mouseup', this.events.pointerup);
        window.removeEventListener('touchend', this.events.pointerup);
        window.removeEventListener('resize', this.events.resize);
    }
}
