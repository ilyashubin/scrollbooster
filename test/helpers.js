import ScrollBooster from '../src/index.js';

const FRAME_60HZ = 1000 / 60;

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
                callbacks.forEach((callback) => callback(now));
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

function dispatchMouse(target, type, x, y, init = {}) {
    const event = new MouseEvent(type, {
        bubbles: true,
        cancelable: true,
        clientX: x,
        clientY: y,
        button: 0,
        ...init,
    });
    target.dispatchEvent(event);
    return event;
}

// Synthetic TouchEvent is not constructible in desktop WebKit and Firefox, so touches are attached manually
function dispatchTouch(target, type, touches) {
    const event = new Event(type, { bubbles: true, cancelable: true });
    const list = touches.map(([x, y]) => ({
        clientX: x,
        clientY: y,
        pageX: x + window.scrollX,
        pageY: y + window.scrollY,
    }));
    Object.defineProperty(event, 'touches', { value: list });
    target.dispatchEvent(event);
    return event;
}

/**
 * Pointer helpers with coordinates relative to the viewport top left corner
 */
function createPointer(viewport) {
    const toClient = (x, y) => {
        const rect = viewport.getBoundingClientRect();
        return [rect.left + x, rect.top + y];
    };
    let mouseTarget = viewport;

    return {
        mouseDown(x, y, init = {}, target = viewport.firstElementChild) {
            mouseTarget = target;
            return dispatchMouse(target, 'mousedown', ...toClient(x, y), init);
        },
        mouseMove(x, y) {
            return dispatchMouse(window, 'mousemove', ...toClient(x, y));
        },
        mouseUp(x, y) {
            return dispatchMouse(window, 'mouseup', ...toClient(x, y));
        },
        click(x, y) {
            return dispatchMouse(mouseTarget, 'click', ...toClient(x, y));
        },
        touchStart(points, target = viewport.firstElementChild) {
            return dispatchTouch(
                target,
                'touchstart',
                points.map(([x, y]) => toClient(x, y))
            );
        },
        touchMove(points) {
            return dispatchTouch(
                window,
                'touchmove',
                points.map(([x, y]) => toClient(x, y))
            );
        },
        touchEnd(points = []) {
            return dispatchTouch(
                window,
                'touchend',
                points.map(([x, y]) => toClient(x, y))
            );
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
            this.touchStart([[fromX, fromY]]);
            for (let i = 1; i <= steps; i++) {
                this.touchMove([[fromX + ((toX - fromX) * i) / steps, fromY + ((toY - fromY) * i) / steps]]);
                tick(1);
            }
            if (release) {
                this.touchEnd();
            }
        },
    };
}

export function wheel(target, deltaX, deltaY) {
    const event = new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaX, deltaY });
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
