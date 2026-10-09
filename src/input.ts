import { clearTextSelection, textNodeFromPoint } from './dom';
import type { Props } from './options';
import type { Direction, Point, ScrollBoosterState } from './types';

type Axis = 'x' | 'y';

// A press is a click until the pointer moves further than this along scroll directions
const CLICK_THRESHOLD_PX = 5;

// Presses on these elements focus them instead of dragging, with `inputsFocus`
const FORM_NODES = ['input', 'textarea', 'button', 'select', 'label'];

/**
 * Pointer pressed on viewport that drags content. Offsets are from the press point, 0 when nothing is pressed.
 */
export interface Press {
    isActive: boolean;
    /** Nested instances took the same press and none of them owns it yet: content stays in place */
    readonly isHeld: boolean;
    /** Page coordinates: content follows them */
    offset: Point;
    /** Client coordinates: the angle of the gesture on screen */
    clientOffset: Point;
}

export interface DragHost {
    /** Current options */
    props(): Props;
    getState(): ScrollBoosterState;
    /** Press passed all checks and starts dragging */
    start(): void;
    /** Drag pointer released or cancelled, before onPointerUp gets the state */
    release(): void;
    /** A drag by the offset along the axis moves content */
    canDrag(axis: Axis, offset: number): boolean;
}

// Instances that took a pointerdown, from the innermost viewport out: the event bubbles in this order.
// Past the click threshold the gesture goes to one of them, like native scroll goes to one scroller.
interface Claim {
    canDrag(axis: Axis, offset: number): boolean;
    direction(): Direction;
}
const claims = new WeakMap<Event, Claim[]>();

/**
 * The innermost instance that can move along the main axis of the gesture, or that allows that axis
 */
function chooseOwner(list: Claim[], offset: Point): Claim | undefined {
    const axis: Axis = Math.abs(offset.x) > Math.abs(offset.y) ? 'x' : 'y';
    const allows = (claim: Claim) => claim.direction() !== (axis === 'x' ? 'vertical' : 'horizontal');
    return list.find((claim) => allows(claim) && claim.canDrag(axis, offset[axis])) ?? list.find(allows) ?? list[0];
}

/**
 * Check if pointer moved far enough along scroll directions to count as drag, not click
 */
export function isPastClickThreshold(offset: Point, direction: Direction): boolean {
    const x = direction !== 'vertical' ? offset.x : 0;
    const y = direction !== 'horizontal' ? offset.y : 0;
    return Math.max(Math.abs(x), Math.abs(y)) > CLICK_THRESHOLD_PX;
}

/**
 * Drag with Pointer Events on viewport: one pointer drags at a time, it is captured past the click threshold,
 * the click that ends a drag is prevented. Listeners are removed and the press is reset with the signal.
 */
export function bindDrag(viewport: HTMLElement, signal: AbortSignal, host: DragHost): Press {
    const claim: Claim = { canDrag: host.canDrag, direction: () => host.props().direction };
    let pressClaims: Claim[] = [claim];
    let isOwned = false;
    const press: Press = {
        isActive: false,
        get isHeld() {
            return !isOwned && pressClaims.length > 1;
        },
        offset: { x: 0, y: 0 },
        clientOffset: { x: 0, y: 0 },
    };
    const pageOrigin = { x: 0, y: 0 };
    const clientOrigin = { x: 0, y: 0 };
    let activePointerId: number | null = null;
    let activePointerType = '';
    let isCaptured = false;
    // The click that follows a drag past the click threshold is prevented
    let preventClick = false;
    // Pointer may leave viewport before capture, so drag events are listened on window until release
    let dragController: AbortController | null = null;

    const isPastThreshold = () => isPastClickThreshold(press.offset, host.props().direction);

    const setOffsets = ({ pageX, pageY, clientX, clientY }: PointerEvent) => {
        press.offset.x = pageX - pageOrigin.x;
        press.offset.y = pageY - pageOrigin.y;
        press.clientOffset.x = clientX - clientOrigin.x;
        press.clientOffset.y = clientY - clientOrigin.y;
    };

    const stop = () => {
        press.isActive = false;
        activePointerId = null;
        press.offset.x = 0;
        press.offset.y = 0;
        press.clientOffset.x = 0;
        press.clientOffset.y = 0;
        dragController?.abort();
        dragController = null;
    };

    // Presses that do not drag: scrollbars, other buttons, pointer types and elements excluded by options
    const isDragStart = (event: PointerEvent): boolean => {
        const props = host.props();
        const { clientX, clientY, target } = event;
        const rect = viewport.getBoundingClientRect();
        const isTouch = event.pointerType === 'touch';
        if (
            clientX - rect.left >= viewport.clientLeft + viewport.clientWidth ||
            clientY - rect.top >= viewport.clientTop + viewport.clientHeight ||
            !props.shouldDrag(host.getState(), event) ||
            // Touch and pen contact report the main button too
            event.button !== 0 ||
            (props.pointerMode === 'mouse' && isTouch) ||
            (props.pointerMode === 'touch' && !isTouch) ||
            !(target instanceof Element) ||
            (props.inputsFocus && FORM_NODES.includes(target.nodeName.toLowerCase()))
        ) {
            return false;
        }
        if (props.textSelection) {
            if (textNodeFromPoint(target, clientX, clientY)) {
                return false;
            }
            clearTextSelection();
        }
        return true;
    };

    const onPointerDown = (event: PointerEvent) => {
        // One pointer drags at a time, other fingers on viewport are ignored until it is released
        if (activePointerId !== null && event.pointerId !== activePointerId) {
            // Browser makes a pointer primary when no other pointer of its type is active:
            // pointerup of the dragging one was lost (element removed, capture lost)
            if (!event.isPrimary || event.pointerType !== activePointerType) {
                return;
            }
            stop();
        }
        preventClick = false;
        if (!isDragStart(event)) {
            return;
        }

        pressClaims = claims.get(event) ?? [];
        pressClaims.push(claim);
        claims.set(event, pressClaims);
        isOwned = false;
        press.isActive = true;
        activePointerId = event.pointerId;
        activePointerType = event.pointerType;
        isCaptured = false;
        pageOrigin.x = event.pageX;
        pageOrigin.y = event.pageY;
        clientOrigin.x = event.clientX;
        clientOrigin.y = event.clientY;
        setOffsets(event);
        host.start();
        host.props().onPointerDown(host.getState(), event);

        dragController?.abort();
        dragController = new AbortController();
        const options = { capture: true, signal: dragController.signal };
        window.addEventListener('pointermove', onPointerMove, options);
        window.addEventListener('pointerup', onPointerUp, options);
        window.addEventListener('pointercancel', onPointerUp, options);
    };

    const onPointerMove = (event: PointerEvent) => {
        if (event.pointerId !== activePointerId) {
            return;
        }
        setOffsets(event);
        if (!isOwned && isPastClickThreshold(press.offset, 'all')) {
            isOwned = true;
            if (chooseOwner(pressClaims, press.offset) !== claim) {
                // A nested instance takes the gesture, content has stayed in place
                const state = host.getState();
                stop();
                host.props().onPointerUp(state, event);
                return;
            }
        }
        // Capture right away would retarget a plain click on content to viewport, so wait for the click threshold
        if (!isCaptured && isPastThreshold()) {
            isCaptured = true;
            try {
                viewport.setPointerCapture(event.pointerId);
            } catch {
                // Pointer is not active anymore
            }
        }
        host.props().onPointerMove(host.getState(), event);
    };

    const onPointerUp = (event: PointerEvent) => {
        if (event.pointerId !== activePointerId) {
            return;
        }
        preventClick = isPastThreshold();
        press.isActive = false;
        host.release();
        // onPointerUp gets offset and angle of the drag that ended
        const state = host.getState();
        stop();
        host.props().onPointerUp(state, event);
    };

    // Text selection and native drag of images and links would take the pointer from the drag.
    // Mousedown keeps its default action, so a press moves focus like a click on any other element.
    const preventDuringDrag = (event: Event) => {
        if (press.isActive) {
            event.preventDefault();
        }
    };

    const onClick = (event: MouseEvent) => {
        // Click of the pointer that ended a drag. A touch drag past the tap distance has no click, then the next
        // click may come from keyboard or element.click() with detail 0 and must not be prevented.
        if (preventClick && event.detail > 0) {
            preventClick = false;
            event.preventDefault();
            event.stopPropagation();
        }
        host.props().onClick(host.getState(), event);
    };

    viewport.addEventListener('pointerdown', onPointerDown, { signal });
    viewport.addEventListener('selectstart', preventDuringDrag, { signal });
    viewport.addEventListener('dragstart', preventDuringDrag, { signal });
    viewport.addEventListener('click', onClick, { signal });
    signal.addEventListener('abort', stop);
    return press;
}
