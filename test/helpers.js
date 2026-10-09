import ScrollBooster from '../src/index.ts';

const FRAME_60HZ = 1000 / 60;
const nativeRaf = window.requestAnimationFrame.bind(window);

let clock = null;
const mounted = [];

/**
 * Replace requestAnimationFrame with a manual clock, so physics advances only on tick()
 */
export function installFrameClock() {
    const originalRaf = window.requestAnimationFrame;
    const originalCaf = window.cancelAnimationFrame;
    const queue = new Map();
    let nextId = 1;
    let now = 0;

    window.requestAnimationFrame = (callback) => {
        const id = nextId++;
        queue.set(id, callback);
        return id;
    };
    window.cancelAnimationFrame = (id) => queue.delete(id);

    clock = {
        tick(frames = 1, frameDuration = FRAME_60HZ) {
            for (let i = 0; i < frames; i++) {
                now += frameDuration;
                const callbacks = [...queue.values()];
                queue.clear();
                for (const callback of callbacks) {
                    callback(now);
                }
            }
        },
        get pendingFrames() {
            return queue.size;
        },
        restore() {
            window.requestAnimationFrame = originalRaf;
            window.cancelAnimationFrame = originalCaf;
        },
    };
    return clock;
}

/**
 * Wait for the next real rendering update, where ResizeObserver notifications are delivered.
 * Works while the fake frame clock is installed.
 */
export function nextRender() {
    return new Promise((resolve) => nativeRaf(() => setTimeout(resolve)));
}

export function tick(frames, frameDuration) {
    clock.tick(frames, frameDuration);
}

export function pendingFrames() {
    return clock.pendingFrames;
}

/**
 * Create viewport with content of given size and attach it to the document
 */
export function createFixture({
    width = 300,
    height = 300,
    contentWidth = 1000,
    contentHeight = 1000,
    overflow = 'hidden',
} = {}) {
    const viewport = document.createElement('div');
    viewport.style.cssText = `width: ${width}px; height: ${height}px; overflow: ${overflow}; position: relative;`;
    const content = document.createElement('div');
    content.style.cssText = `width: ${contentWidth}px; height: ${contentHeight}px;`;
    viewport.append(content);
    document.body.append(viewport);
    return { viewport, content };
}

/**
 * Create fixture and ScrollBooster instance, both are cleaned up after each test.
 * Options can be a function of the fixture to reference its elements in callbacks.
 */
export function mount(options = {}, fixtureOptions = {}) {
    const fixture = createFixture(fixtureOptions);
    const resolvedOptions = typeof options === 'function' ? options(fixture) : options;
    const sb = new ScrollBooster({ viewport: fixture.viewport, ...resolvedOptions });
    mounted.push({ sb, viewport: fixture.viewport });
    return { ...fixture, sb, pointer: createPointer(fixture.viewport) };
}

export function cleanup() {
    mounted.splice(0).forEach(({ sb, viewport }) => {
        sb.destroy();
        viewport.remove();
    });
    clock?.restore();
    clock = null;
}

const MOUSE_ID = 1;
const TOUCH_ID = 10;

function dispatchPointer(target, type, x, y, init = {}) {
    const event = new PointerEvent(type, {
        bubbles: true,
        cancelable: true,
        composed: true,
        clientX: x,
        clientY: y,
        isPrimary: true,
        ...init,
    });
    target.dispatchEvent(event);
    return event;
}

/**
 * Pointer helpers with coordinates relative to the viewport top left corner.
 * Events follow browser order: mouse pointerdown is followed by compatibility mousedown,
 * moves of a pressed mouse go to the element under the pointer, touch moves go to the pointerdown target.
 */
export function createPointer(viewport) {
    const toClient = (x, y) => {
        const rect = viewport.getBoundingClientRect();
        return [rect.left + x, rect.top + y];
    };
    const elementAt = (clientX, clientY) => document.elementFromPoint(clientX, clientY) ?? document.documentElement;
    let mouseTarget = viewport;
    const touchTargets = new Map();

    const mouse = (type, x, y, init) => {
        const [clientX, clientY] = toClient(x, y);
        const target = type === 'pointerdown' ? mouseTarget : elementAt(clientX, clientY);
        return dispatchPointer(target, type, clientX, clientY, { pointerType: 'mouse', pointerId: MOUSE_ID, ...init });
    };
    const touch = (type, x, y, { id = TOUCH_ID, isPrimary = id === TOUCH_ID } = {}) => {
        const [clientX, clientY] = toClient(x, y);
        return dispatchPointer(touchTargets.get(id), type, clientX, clientY, {
            pointerType: 'touch',
            pointerId: id,
            isPrimary,
            width: 20,
            height: 20,
        });
    };

    return {
        /**
         * Returns compatibility mousedown, it is not dispatched when pointerdown is canceled
         */
        mouseDown(x, y, init = {}, target = viewport.firstElementChild) {
            mouseTarget = target;
            const buttonInit = { button: 0, buttons: 1, ...init };
            const pointerdown = mouse('pointerdown', x, y, buttonInit);
            if (pointerdown.defaultPrevented) {
                return pointerdown;
            }
            const [clientX, clientY] = toClient(x, y);
            const mousedown = new MouseEvent('mousedown', {
                bubbles: true,
                cancelable: true,
                clientX,
                clientY,
                ...buttonInit,
            });
            target.dispatchEvent(mousedown);
            return mousedown;
        },
        mouseMove(x, y, init = {}) {
            return mouse('pointermove', x, y, { button: -1, buttons: 1, ...init });
        },
        mouseUp(x, y) {
            return mouse('pointerup', x, y, { button: 0, buttons: 0 });
        },
        click(x, y) {
            const [clientX, clientY] = toClient(x, y);
            const event = new MouseEvent('click', { bubbles: true, cancelable: true, clientX, clientY });
            mouseTarget.dispatchEvent(event);
            return event;
        },
        touchStart(x, y, options = {}) {
            touchTargets.set(options.id ?? TOUCH_ID, options.target ?? viewport.firstElementChild);
            return touch('pointerdown', x, y, options);
        },
        touchMove(x, y, options) {
            return touch('pointermove', x, y, options);
        },
        touchEnd(x, y, options) {
            return touch('pointerup', x, y, options);
        },
        touchCancel(x, y, options) {
            return touch('pointercancel', x, y, options);
        },
        /**
         * Drag with mouse from one point to another in equal steps, one animation frame per step
         */
        mouseDrag([fromX, fromY], [toX, toY], { steps = 10, frameDuration, release = true } = {}) {
            this.mouseDown(fromX, fromY);
            for (let i = 1; i <= steps; i++) {
                this.mouseMove(fromX + ((toX - fromX) * i) / steps, fromY + ((toY - fromY) * i) / steps);
                tick(1, frameDuration);
            }
            if (release) {
                this.mouseUp(toX, toY);
            }
        },
        touchDrag([fromX, fromY], [toX, toY], { steps = 10, release = true } = {}) {
            this.touchStart(fromX, fromY);
            for (let i = 1; i <= steps; i++) {
                this.touchMove(fromX + ((toX - fromX) * i) / steps, fromY + ((toY - fromY) * i) / steps);
                tick(1);
            }
            if (release) {
                this.touchEnd(toX, toY);
            }
        },
    };
}

export function wheel(target, deltaX, deltaY, deltaMode = WheelEvent.DOM_DELTA_PIXEL) {
    const event = new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaX, deltaY, deltaMode });
    target.dispatchEvent(event);
    return event;
}

// Rounds and normalizes -0 to 0
export function round(value, digits = 3) {
    return Number(value.toFixed(digits)) || 0;
}

export function roundedPosition(sb, digits = 1) {
    const { x, y } = sb.getState().position;
    return { x: round(x, digits), y: round(y, digits) };
}

/**
 * Record rounded scroll position for given number of frames
 */
export function recordTrajectory(sb, frames, every = 1) {
    const points = [];
    for (let i = 1; i <= frames; i++) {
        tick(1);
        if (i % every === 0) {
            const { x, y } = sb.getState().position;
            points.push([round(x), round(y)]);
        }
    }
    return points;
}
