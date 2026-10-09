import { getRevealOffset, isSameSize, type Metrics, measure, prefersReducedMotion, render } from './dom';
import { bindDrag, isPastClickThreshold, type Press } from './input';
import { createLoop } from './loop';
import { ContentMotion } from './motion';
import { mergeOptions, type Props, resolveOptions, TOUCH_ACTION } from './options';
import { getDragAngle } from './physics';
import type { Point, ScrollBoosterOptions, ScrollBoosterState, ScrollMode } from './types';
import { bindWheel, type WheelGesture } from './wheel';

// Content position follows native scroll position of the viewport, so a scrolled viewport keeps its scroll
const getScrollPosition = (viewport: HTMLElement): Point => ({ x: -viewport.scrollLeft, y: -viewport.scrollTop });

export class ScrollBooster {
    private props: Props;
    private isDestroyed = false;
    private motion: ContentMotion;
    private loop = createLoop((frames) => this.animate(frames));
    private metrics: Metrics = { viewport: { width: 0, height: 0 }, content: { width: 0, height: 0 } };
    // Set by bindEvents() from the constructor
    private press!: Press;
    private wheel!: WheelGesture;
    private abortController!: AbortController;
    private resizeObserver!: ResizeObserver;
    private initialTouchAction = '';

    /**
     * Create ScrollBooster instance. Throws TypeError for invalid options.
     */
    constructor(options: ScrollBoosterOptions) {
        this.props = resolveOptions(options);
        const { viewport, scrollMode } = this.props;
        this.motion = new ContentMotion(getScrollPosition(viewport));
        if (scrollMode === 'transform') {
            viewport.scrollLeft = 0;
            viewport.scrollTop = 0;
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
        const previous = this.props;
        const next = mergeOptions(previous, options);

        if (next.viewport === previous.viewport && next.content === previous.content) {
            this.props = next;
            this.wheel.update();
            this.applyTouchAction();
            if (next.scrollMode !== previous.scrollMode) {
                this.switchScrollMode(previous.scrollMode);
            }
            this.updateMetrics();
            return;
        }

        // Previous elements keep nothing from this instance
        if (previous.scrollMode === 'transform') {
            previous.content.style.transform = '';
        }
        this.unbindEvents();
        this.props = next;
        if (next.viewport !== previous.viewport) {
            this.motion.position = getScrollPosition(next.viewport);
            this.motion.stop();
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
        this.metrics = measure(this.props.viewport, this.props.content);
        this.motion.setSizes(this.metrics.viewport, this.metrics.content);
        // Next frame renders new state and returns content within new edges
        this.loop.start();
    }

    /**
     * Smoothly scroll to the position within edges. Does nothing while the user drags content
     */
    scrollTo(position: Partial<Point> = {}): void {
        // Drag takes precedence: content stays under the pointer
        if (this.isDestroyed || this.press.isActive) {
            return;
        }
        if (this.isReducedMotion()) {
            this.setPosition(position);
            return;
        }
        this.motion.scrollTo(position);
        this.loop.start();
    }

    /**
     * Jump to the position within edges, stops any motion
     */
    setPosition(position: Partial<Point> = {}): void {
        if (this.isDestroyed) {
            return;
        }
        this.motion.setPosition(position);
        this.loop.start();
    }

    /**
     * Get latest metrics and coordinates
     */
    getState(): ScrollBoosterState {
        const { motion, press } = this;
        const { viewport, content } = this.metrics;
        return {
            isMoving: this.isMoving(),
            // A press becomes a drag past the click threshold, before it the gesture may still be a click
            isDragging: press.isActive && isPastClickThreshold(press.offset, this.props.direction),
            position: motion.getPosition(),
            dragOffset: { ...press.offset },
            dragAngle: getDragAngle(press.clientOffset.x, press.clientOffset.y),
            borderCollision: motion.getBorderCollision(),
            viewport: { ...viewport },
            content: { ...content },
            maxPosition: motion.getMaxPosition(),
        };
    }

    /**
     * Stop animation, remove DOM listeners and observers. Methods of destroyed instance do nothing.
     */
    destroy(): void {
        if (this.isDestroyed) {
            return;
        }
        this.isDestroyed = true;
        this.loop.stop();
        this.unbindEvents();
    }

    /**
     * Animation frame: move content, stop when nothing moves, render and report the state
     */
    private animate(frames: number): void {
        const { motion, props, press, wheel } = this;
        if (frames > 0) {
            const bounce = props.bounce && !this.isReducedMotion();
            const drag = press.isActive ? press.offset : null;
            motion.step(frames, props, bounce, drag, wheel.isActive ? wheel.offset : null);
            wheel.offset.x = 0;
            wheel.offset.y = 0;
        }
        if (!this.isMoving()) {
            motion.settle(props.direction);
            this.loop.stop();
        }
        const state = this.getState();
        this.renderPosition();
        // onUpdate may restart the loop or destroy the instance
        props.onUpdate(state);
    }

    private isMoving(): boolean {
        return this.press.isActive || this.wheel.isActive || this.motion.isMoving();
    }

    private isReducedMotion(): boolean {
        const { reducedMotion } = this.props;
        return reducedMotion === 'auto' ? prefersReducedMotion() : reducedMotion === 'always';
    }

    /**
     * Render current position with the built-in scroll mode
     */
    private renderPosition(): void {
        const { viewport, content, scrollMode } = this.props;
        render(viewport, content, scrollMode, this.motion.getPosition());
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
        this.renderPosition();
    }

    /**
     * Jump by given scroll offset and render right away: browser computes focus scroll from the current layout
     */
    private jumpBy(offset: Point): void {
        this.motion.jumpBy(offset, this.props.direction);
        this.renderPosition();
        this.loop.start();
    }

    /**
     * Register DOM listeners and observers on current elements, they are removed with unbindEvents()
     */
    private bindEvents(): void {
        this.abortController = new AbortController();
        const { signal } = this.abortController;
        const { viewport, content } = this.props;
        const props = () => this.props;
        const getState = () => this.getState();

        this.press = bindDrag(viewport, signal, {
            props,
            getState,
            start: () => {
                this.motion.startDrag();
                this.loop.start();
            },
            release: () => {
                if (this.isReducedMotion()) {
                    this.motion.stop();
                }
            },
        });
        this.wheel = bindWheel(viewport, signal, {
            props,
            getState,
            isDragging: () => this.press.isActive,
            canScroll: (axis, delta) => this.motion.canScroll(axis, delta, this.props.direction),
            scroll: () => {
                this.motion.interrupt();
                this.loop.start();
            },
        });

        viewport.addEventListener('scroll', () => this.onNativeScroll(), { signal });
        // Content moved with transform has no native scroll to bring focused element into view.
        // Focus by the press that drags content keeps the content under the pointer.
        viewport.addEventListener(
            'focusin',
            ({ target }) => {
                if (this.props.scrollMode === 'transform' && !this.press.isActive && target instanceof Element) {
                    const offset = getRevealOffset(viewport, target);
                    if (offset.x || offset.y) {
                        this.jumpBy(offset);
                    }
                }
            },
            { signal }
        );
        // ResizeObserver misses scrollWidth growth of fixed-size content, so loaded images still update metrics
        content.addEventListener('load', () => this.updateMetrics(), { capture: true, signal });

        this.initialTouchAction = viewport.style.touchAction;
        this.applyTouchAction();

        this.resizeObserver = new ResizeObserver(() => {
            // Initial notification after observe() usually has nothing new
            const metrics = measure(viewport, content);
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
     * Remove DOM listeners and observers, restore touch-action of the viewport
     */
    private unbindEvents(): void {
        this.abortController.abort();
        this.resizeObserver.disconnect();
        this.props.viewport.style.touchAction = this.initialTouchAction;
    }

    /**
     * Native scroll of viewport by the browser or by a custom renderer
     */
    private onNativeScroll(): void {
        const { viewport, scrollMode } = this.props;
        const { scrollLeft, scrollTop } = viewport;
        // In transform mode browser can still scroll viewport natively (focus, find in page, anchor links).
        // Reset native scroll and shift transform by the same offset.
        if (scrollMode === 'transform') {
            if (scrollLeft || scrollTop) {
                viewport.scrollLeft = 0;
                viewport.scrollTop = 0;
                this.jumpBy({ x: scrollLeft, y: scrollTop });
            }
            return;
        }
        this.motion.followNativeScroll({ x: scrollLeft, y: scrollTop });
    }

    /**
     * Leave native touch scroll to the browser only in directions that do not drag content
     */
    private applyTouchAction(): void {
        const { viewport, pointerMode, direction } = this.props;
        viewport.style.touchAction = pointerMode === 'mouse' ? this.initialTouchAction : TOUCH_ACTION[direction];
    }
}
