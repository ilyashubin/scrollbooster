import type { Props } from './options';
import type { Point, ScrollBoosterState } from './types';

// Wheel deltas in lines are converted with this line height, in pages with the viewport size
const LINE_HEIGHT_PX = 16;

// Wheel events closer than this belong to one gesture
const GESTURE_TIMEOUT_MS = 80;

/**
 * Wheel gesture taken by content
 */
export interface WheelGesture {
    isActive: boolean;
    /** Deltas of the events since the previous frame, as content offset */
    offset: Point;
    /** Add or remove the listener after the `wheel` option changed */
    update(): void;
}

export interface WheelHost {
    /** Current options */
    props(): Props;
    getState(): ScrollBoosterState;
    /** Pointer drags content */
    isDragging(): boolean;
    /** The delta along the axis moves content */
    canScroll(axis: 'x' | 'y', delta: number): boolean;
    /** Wheel event is taken, before onWheel gets the state */
    scroll(): void;
    /** Gesture ended: no events for the gesture timeout */
    end(): void;
}

/**
 * Mouse wheel and trackpad scroll on viewport, with the `wheel` option. The listener and the gesture are
 * removed with the signal.
 */
export function bindWheel(viewport: HTMLElement, signal: AbortSignal, host: WheelHost): WheelGesture {
    let timer: ReturnType<typeof setTimeout> | undefined;

    const onWheel = (event: WheelEvent) => {
        // A scroller nested in the content has taken this event, drag holds the content,
        // or it is a trackpad pinch or Ctrl+wheel that zooms the page
        if (event.defaultPrevented || event.ctrlKey || host.isDragging()) {
            return;
        }
        const { deltaMode } = event;
        const { clientWidth, clientHeight } = viewport;
        const pixels = deltaMode === WheelEvent.DOM_DELTA_LINE ? LINE_HEIGHT_PX : 1;
        const x = event.deltaX * (deltaMode === WheelEvent.DOM_DELTA_PAGE ? clientWidth : pixels);
        const y = event.deltaY * (deltaMode === WheelEvent.DOM_DELTA_PAGE ? clientHeight : pixels);

        // Like native scroll, a wheel gesture stays with the scroller that took its first event
        // and goes to the page when content cannot move along the main axis of the gesture
        if (!gesture.isActive && !host.canScroll(Math.abs(x) > Math.abs(y) ? 'x' : 'y', x || y)) {
            return;
        }
        event.preventDefault();

        gesture.isActive = true;
        // Deltas of all events until the next frame add up
        gesture.offset.x -= x;
        gesture.offset.y -= y;
        host.scroll();
        host.props().onWheel(host.getState(), event);

        clearTimeout(timer);
        timer = setTimeout(() => {
            gesture.isActive = false;
            host.end();
        }, GESTURE_TIMEOUT_MS);
    };

    const gesture: WheelGesture = {
        isActive: false,
        offset: { x: 0, y: 0 },
        // The listener cancels the events that scroll content, so it is not passive and is added only when needed
        update() {
            viewport.removeEventListener('wheel', onWheel);
            if (host.props().wheel) {
                viewport.addEventListener('wheel', onWheel, { passive: false, signal });
            }
        },
    };

    signal.addEventListener('abort', () => {
        clearTimeout(timer);
        gesture.isActive = false;
    });
    gesture.update();
    return gesture;
}
