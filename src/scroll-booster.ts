import {
    getRevealOffset,
    isRightToLeft,
    isSameSize,
    type Metrics,
    measure,
    mirrorX,
    prefersReducedMotion,
    render,
} from './dom';
import { bindDrag, isPastClickThreshold, type Press } from './input';
import { getKeyScroll } from './keyboard';
import { createLoop } from './loop';
import { ContentMotion } from './motion';
import { mergeOptions, type Props, resolveOptions, TOUCH_ACTION } from './options';
import { getDragAngle } from './physics';
import type {
    BorderCollision,
    Point,
    ScrollAlign,
    ScrollBoosterOptions,
    ScrollBoosterState,
    ScrollMode,
} from './types';
import { bindWheel, type WheelGesture } from './wheel';

// Content position follows native scroll position of the viewport, so a scrolled viewport keeps its scroll
const getScrollPosition = (viewport: HTMLElement): Point =>
    mirrorX({ x: -viewport.scrollLeft, y: -viewport.scrollTop }, isRightToLeft(viewport));

const SCROLL_ALIGN: ScrollAlign[] = ['nearest', 'start', 'center', 'end'];

export class ScrollBooster {
    #props: Props;
    #isDestroyed = false;
    #motion: ContentMotion;
    #loop = createLoop((frames) => this.#animate(frames));
    #metrics: Metrics = { viewport: { width: 0, height: 0 }, content: { width: 0, height: 0 } };
    // Right-to-left viewport mirrors the x axis between public position and the DOM
    #isRtl = false;
    // Set by bindEvents() from the constructor
    #press!: Press;
    #wheel!: WheelGesture;
    #abortController!: AbortController;
    #resizeObserver?: ResizeObserver;
    #initialTouchAction = '';

    /**
     * Create ScrollBooster instance. Throws TypeError for invalid options.
     */
    constructor(options: ScrollBoosterOptions) {
        this.#props = resolveOptions(options);
        const { viewport, scrollMode } = this.#props;
        this.#motion = new ContentMotion(getScrollPosition(viewport));
        if (scrollMode === 'transform') {
            viewport.scrollLeft = 0;
            viewport.scrollTop = 0;
        }
        this.updateMetrics();
        this.#bindEvents();
    }

    /**
     * Update options with given values. Throws TypeError for invalid options and keeps the current ones.
     */
    updateOptions(options: Partial<ScrollBoosterOptions>): void {
        if (this.#isDestroyed) {
            return;
        }
        const previous = this.#props;
        const next = mergeOptions(previous, options);

        if (next.viewport === previous.viewport && next.content === previous.content) {
            this.#props = next;
            this.#wheel.update();
            this.#applyTouchAction();
            if (next.scrollMode !== previous.scrollMode) {
                this.#switchScrollMode(previous.scrollMode);
            }
            this.updateMetrics();
            return;
        }

        this.#unbindEvents();
        this.#props = next;
        if (next.viewport !== previous.viewport) {
            this.#motion.reset(getScrollPosition(next.viewport));
        }
        this.#bindEvents();
        this.updateMetrics();
    }

    /**
     * Update DOM container elements metrics (width and height)
     */
    updateMetrics(): void {
        if (this.#isDestroyed) {
            return;
        }
        this.#metrics = measure(this.#props.viewport, this.#props.content);
        this.#isRtl = isRightToLeft(this.#props.viewport);
        this.#motion.setSizes(this.#metrics.viewport, this.#metrics.content);
        // Next frame renders new state and returns content within new edges
        this.#loop.start();
    }

    /**
     * Smoothly scroll to the position within edges. Does nothing while the user drags content
     */
    scrollTo(position: Partial<Point> = {}): void {
        // Drag takes precedence: content stays under the pointer
        if (this.#isDestroyed || this.#press.isActive) {
            return;
        }
        if (this.#isReducedMotion()) {
            this.setPosition(position);
            return;
        }
        this.#motion.scrollTo(position);
        this.#loop.start();
    }

    /**
     * Smoothly scroll by the offset from the target of a running scroll or from the current position, so repeated
     * calls add up. Does nothing while the user drags content
     */
    scrollBy(offset: Partial<Point> = {}): void {
        if (this.#isDestroyed || this.#press.isActive) {
            return;
        }
        const { x, y } = this.#motion.getTarget();
        this.scrollTo({ x: x + (offset.x ?? 0), y: y + (offset.y ?? 0) });
    }

    /**
     * Smoothly scroll to show an element of the content, aligned by `align`. Unlike the native
     * `element.scrollIntoView()` it works in every scroll mode and follows `reducedMotion`. Does nothing while the
     * user drags content. Throws TypeError for an element outside the content.
     */
    scrollIntoView(element: Element, { align = 'nearest' }: { align?: ScrollAlign } = {}): void {
        if (this.#isDestroyed || this.#press.isActive) {
            return;
        }
        const { viewport, content } = this.#props;
        if (!(element instanceof Element) || !content.contains(element)) {
            throw new TypeError('ScrollBooster: scrollIntoView() needs an element inside the content');
        }
        if (!SCROLL_ALIGN.includes(align)) {
            throw new TypeError(`ScrollBooster: align must be one of ${SCROLL_ALIGN.join(', ')}`);
        }
        // Offset is measured from the rendered layout, that is from the current position
        const offset = mirrorX(getRevealOffset(viewport, element, align, this.#isRtl), this.#isRtl);
        const { x, y } = this.#motion.getPosition();
        this.scrollTo({ x: x + offset.x, y: y + offset.y });
    }

    /**
     * Jump to the position within edges, stops any motion
     */
    setPosition(position: Partial<Point> = {}): void {
        if (this.#isDestroyed) {
            return;
        }
        this.#motion.setPosition(position);
        this.#loop.start();
    }

    /**
     * Get latest metrics and coordinates
     */
    getState(): ScrollBoosterState {
        const motion = this.#motion;
        const press = this.#press;
        const { viewport, content } = this.#metrics;
        return {
            isMoving: this.#isMoving(),
            // A press becomes a drag past the click threshold, before it the gesture may still be a click
            isDragging: press.isActive && isPastClickThreshold(press.offset, this.#props.direction),
            position: motion.getPosition(),
            dragOffset: { ...press.offset },
            dragAngle: getDragAngle(press.clientOffset.x, press.clientOffset.y),
            borderCollision: this.#getBorderCollision(),
            viewport: { ...viewport },
            content: { ...content },
            maxPosition: motion.getMaxPosition(),
        };
    }

    /**
     * Stop animation, remove DOM listeners and observers, remove the transform from content.
     * Methods of destroyed instance do nothing.
     */
    destroy(): void {
        if (this.#isDestroyed) {
            return;
        }
        this.#isDestroyed = true;
        this.#loop.stop();
        this.#unbindEvents();
    }

    /**
     * Animation frame: move content, stop when nothing moves, render and report the state
     */
    #animate(frames: number): void {
        const motion = this.#motion;
        const props = this.#props;
        const press = this.#press;
        const wheel = this.#wheel;
        if (frames > 0) {
            const bounce = props.bounce && !this.#isReducedMotion();
            const drag = press.isActive ? mirrorX(press.isHeld ? { x: 0, y: 0 } : press.offset, this.#isRtl) : null;
            motion.step(frames, props, bounce, drag, wheel.isActive ? mirrorX(wheel.offset, this.#isRtl) : null);
            wheel.offset.x = 0;
            wheel.offset.y = 0;
        }
        if (!this.#isMoving()) {
            motion.settle(props.direction);
            this.#loop.stop();
        }
        const state = this.getState();
        this.#renderPosition();
        // onUpdate may restart the loop or destroy the instance
        props.onUpdate(state);
    }

    #isMoving(): boolean {
        return this.#press.isActive || this.#wheel.isActive || this.#motion.isMoving();
    }

    #isReducedMotion(): boolean {
        const { reducedMotion } = this.#props;
        return reducedMotion === 'auto' ? prefersReducedMotion() : reducedMotion === 'always';
    }

    /**
     * Render current position with the built-in scroll mode
     */
    #renderPosition(): void {
        const { viewport, content, scrollMode } = this.#props;
        render(viewport, content, scrollMode, mirrorX(this.#motion.getPosition(), this.#isRtl));
    }

    /**
     * Let the snap option choose where content stops after a drag or a wheel gesture
     */
    #snap(): void {
        const rest = this.#motion.getRestPosition(this.#props.friction);
        const target = this.#props.snap(rest, this.getState());
        if (target) {
            this.scrollTo({ x: target.x ?? rest.x, y: target.y ?? rest.y });
        }
    }

    /**
     * Collisions with the sides of viewport, the start edge is on the right in right-to-left viewport
     */
    #getBorderCollision(): BorderCollision {
        const collision = this.#motion.getBorderCollision();
        return this.#isRtl ? { ...collision, left: collision.right, right: collision.left } : collision;
    }

    /**
     * Remove rendering of the previous scroll mode, so offsets of two modes do not add up.
     * Native scroll left by a custom `onUpdate` renderer stays, it may be the way that renderer scrolls.
     */
    #switchScrollMode(previous: ScrollMode): void {
        const { viewport, content, scrollMode } = this.#props;
        if (previous === 'transform') {
            content.style.transform = '';
        }
        if (scrollMode === 'transform') {
            viewport.scrollLeft = 0;
            viewport.scrollTop = 0;
        }
        this.#renderPosition();
    }

    /**
     * Jump by given scroll offset in the DOM and render right away: browser computes focus scroll from the current
     * layout
     */
    #jumpBy(offset: Point): void {
        this.#motion.jumpBy(mirrorX(offset, this.#isRtl), this.#props.direction);
        this.#renderPosition();
        this.#loop.start();
    }

    /**
     * Register DOM listeners and observers on current elements, they are removed with unbindEvents()
     */
    #bindEvents(): void {
        this.#abortController = new AbortController();
        const { signal } = this.#abortController;
        const { viewport, content } = this.#props;
        const props = () => this.#props;
        const getState = () => this.getState();

        this.#press = bindDrag(viewport, signal, {
            props,
            getState,
            start: () => {
                this.#motion.startDrag();
                this.#loop.start();
            },
            release: () => {
                if (this.#isReducedMotion()) {
                    this.#motion.stop();
                }
                this.#snap();
            },
            // Drag to the right moves the position to the left, to the right in a right-to-left viewport
            canDrag: (axis, offset) =>
                this.#motion.canScroll(axis, axis === 'x' && this.#isRtl ? offset : -offset, this.#props.direction),
        });
        this.#wheel = bindWheel(viewport, signal, {
            props,
            getState,
            isDragging: () => this.#press.isActive,
            canScroll: (axis, delta) =>
                this.#motion.canScroll(axis, axis === 'x' && this.#isRtl ? -delta : delta, this.#props.direction),
            scroll: () => {
                this.#motion.interrupt();
                this.#loop.start();
            },
            end: () => this.#snap(),
        });

        // Scroll of the page comes to window, not to the root element
        const { ownerDocument } = viewport;
        const scrollTarget = viewport === ownerDocument.scrollingElement ? ownerDocument.defaultView : viewport;
        scrollTarget?.addEventListener('scroll', () => this.#onNativeScroll(), { signal });
        // Content moved with transform has no native scroll to bring focused element into view.
        // Focus by the press that drags content keeps the content under the pointer.
        viewport.addEventListener(
            'focusin',
            ({ target }) => {
                if (this.#props.scrollMode === 'transform' && !this.#press.isActive && target instanceof Element) {
                    const offset = getRevealOffset(viewport, target, 'nearest', this.#isRtl);
                    if (offset.x || offset.y) {
                        this.#jumpBy(offset);
                    }
                }
            },
            { signal }
        );
        viewport.addEventListener('keydown', (event) => this.#onKeyDown(event), { signal });
        // ResizeObserver misses scrollWidth growth of fixed-size content, so loaded images still update metrics
        content.addEventListener('load', () => this.updateMetrics(), { capture: true, signal });

        this.#initialTouchAction = viewport.style.touchAction;
        this.#applyTouchAction();

        // Test environments like jsdom have no ResizeObserver, sizes are then updated by updateMetrics()
        if (typeof ResizeObserver !== 'function') {
            this.#resizeObserver = undefined;
            return;
        }
        this.#resizeObserver = new ResizeObserver(() => {
            // Initial notification after observe() usually has nothing new
            const metrics = measure(viewport, content);
            if (
                !isSameSize(metrics.viewport, this.#metrics.viewport) ||
                !isSameSize(metrics.content, this.#metrics.content)
            ) {
                this.updateMetrics();
            }
        });
        this.#resizeObserver.observe(viewport);
        this.#resizeObserver.observe(content);
    }

    /**
     * Remove DOM listeners and observers, restore touch-action of the viewport and remove the transform:
     * elements keep nothing from this instance. Native scroll stays, it is a usual state of the viewport.
     */
    #unbindEvents(): void {
        const { viewport, content, scrollMode } = this.#props;
        this.#abortController.abort();
        this.#resizeObserver?.disconnect();
        viewport.style.touchAction = this.#initialTouchAction;
        if (scrollMode === 'transform') {
            content.style.transform = '';
        }
    }

    /**
     * Keyboard scroll of the focused viewport or of content with focus. A key goes to the page when content cannot
     * move along its axis, like wheel.
     */
    #onKeyDown(event: KeyboardEvent): void {
        const { keyboard, direction } = this.#props;
        if (!keyboard || event.defaultPrevented || this.#press.isActive) {
            return;
        }
        const key = getKeyScroll(event, this.#metrics.viewport, direction);
        if (!key) {
            return;
        }
        const { axis } = key;
        if ('edge' in key) {
            const edge = key.edge === 'start' ? 0 : this.#motion.getMaxPosition()[axis];
            if (this.#motion.canScroll(axis, edge - this.#motion.getPosition()[axis], direction)) {
                event.preventDefault();
                this.scrollTo({ [axis]: edge });
            }
            return;
        }
        const delta = 'page' in key ? key.page : axis === 'x' && this.#isRtl ? -key.arrow : key.arrow;
        if (this.#motion.canScroll(axis, delta, direction)) {
            event.preventDefault();
            // Key repeat adds up like repeated wheel events
            this.scrollBy({ [axis]: delta });
        }
    }

    /**
     * Native scroll of viewport by the browser or by a custom renderer
     */
    #onNativeScroll(): void {
        const { viewport, scrollMode } = this.#props;
        const { scrollLeft, scrollTop } = viewport;
        // In transform mode browser can still scroll viewport natively (focus, find in page, anchor links).
        // Reset native scroll and shift transform by the same offset.
        if (scrollMode === 'transform') {
            if (scrollLeft || scrollTop) {
                viewport.scrollLeft = 0;
                viewport.scrollTop = 0;
                this.#jumpBy({ x: scrollLeft, y: scrollTop });
            }
            return;
        }
        const isAtRest = !this.#isMoving();
        // At rest the animation loop does not run: report the state right away. A frame would also render the
        // position and stop a native fling.
        if (
            this.#motion.followNativeScroll(mirrorX({ x: scrollLeft, y: scrollTop }, this.#isRtl), isAtRest) &&
            isAtRest
        ) {
            this.#props.onUpdate(this.getState());
        }
    }

    /**
     * Leave native touch scroll to the browser only in directions that do not drag content
     */
    #applyTouchAction(): void {
        const { viewport, pointerMode, direction } = this.#props;
        viewport.style.touchAction = pointerMode === 'mouse' ? this.#initialTouchAction : TOUCH_ACTION[direction];
    }
}
