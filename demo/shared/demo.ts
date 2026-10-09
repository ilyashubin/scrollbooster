import type { ScrollBoosterState } from '../../src/index.ts';
import { PAGES } from './pages.ts';

/**
 * Header with links to all demo pages
 */
export function mountNav(): void {
    const current = location.pathname.split('/').pop() || 'index.html';
    const header = document.createElement('header');
    const nav = document.createElement('nav');
    for (const page of PAGES) {
        const link = document.createElement('a');
        link.href = `./${page.file}`;
        link.textContent = page.title;
        if (page.file === current) {
            link.setAttribute('aria-current', 'page');
        }
        nav.append(link);
    }
    header.append(nav);
    document.body.prepend(header);
    if (new URLSearchParams(location.search).has('events')) {
        mountEventLog();
    }
}

// Raw input events in the order the browser sends them, for devices without devtools
const LOGGED_EVENTS = [
    'pointerdown',
    'pointermove',
    'pointerup',
    'pointercancel',
    'gotpointercapture',
    'lostpointercapture',
    'touchstart',
    'touchend',
    'touchcancel',
    'mousedown',
    'mouseup',
    'click',
    'auxclick',
    'contextmenu',
    'dragstart',
    'selectstart',
    'wheel',
    // Force click in Safari on macOS
    'webkitmouseforcewillbegin',
    'webkitmouseforcedown',
    'webkitmouseforceup',
];

const describeTarget = (target: EventTarget | null) => {
    if (!(target instanceof Element)) {
        return target === window ? 'window' : String(target);
    }
    const classes = [...target.classList].slice(0, 2).map((name) => `.${name}`);
    return `${target.tagName.toLowerCase()}${target.id ? `#${target.id}` : ''}${classes.join('')}`;
};

/**
 * Overlay with raw input events, opened with `?events` in the page address. Moves are logged only when pressed
 * buttons change, wheel only at the start of a gesture, so a press reads as a few lines. Whether an event was
 * prevented is read after it has been dispatched.
 */
function mountEventLog(): void {
    const panel = document.createElement('aside');
    panel.className = 'event-log';
    panel.setAttribute('aria-label', 'Event log');
    const tools = document.createElement('div');
    const copy = document.createElement('button');
    copy.type = 'button';
    copy.textContent = 'Copy';
    const send = document.createElement('button');
    send.type = 'button';
    send.textContent = 'Send';
    const clear = document.createElement('button');
    clear.type = 'button';
    clear.textContent = 'Clear';
    tools.append(clear, copy, send);
    const output = document.createElement('pre');
    panel.append(tools, output);
    document.body.append(panel);

    const lines: string[] = [];
    const start = performance.now();
    const render = () => {
        output.textContent = lines.join('\n');
        output.scrollTop = output.scrollHeight;
    };
    // Clipboard API needs a secure context: a page opened by the network address of the dev server is not one
    copy.addEventListener('click', () => {
        const field = document.createElement('textarea');
        field.value = lines.join('\n');
        panel.append(field);
        field.select();
        field.setSelectionRange(0, field.value.length);
        const isCopied = document.execCommand('copy');
        field.remove();
        toast(isCopied ? 'Copied' : 'Copy failed, use Send');
    });
    // The dev server keeps the last sent log at /__events
    send.addEventListener('click', () => {
        fetch('/__events', { method: 'POST', body: lines.join('\n') }).then(
            (response) => toast(response.ok ? 'Sent' : 'Send failed: not the dev server'),
            () => toast('Send failed')
        );
    });
    clear.addEventListener('click', () => {
        lines.length = 0;
        render();
    });

    const moveButtons = new Map<number, number>();
    let lastWheel = Number.NEGATIVE_INFINITY;
    const log = (event: Event) => {
        if (event.target instanceof Node && panel.contains(event.target)) {
            return;
        }
        if (event instanceof PointerEvent && event.type === 'pointermove') {
            if (moveButtons.get(event.pointerId) === event.buttons) {
                return;
            }
            moveButtons.set(event.pointerId, event.buttons);
        }
        if (event.type === 'wheel') {
            const isNewGesture = event.timeStamp - lastWheel > 300;
            lastWheel = event.timeStamp;
            if (!isNewGesture) {
                return;
            }
        }
        const parts = [`${Math.round(performance.now() - start)}`.padStart(6), event.type];
        // Click is a PointerEvent in Chromium, without pointer fields
        if (event instanceof PointerEvent && event.type.startsWith('pointer')) {
            parts.push(`${event.pointerType}#${event.pointerId}${event.isPrimary ? '' : ' secondary'}`);
        }
        if (event instanceof MouseEvent) {
            parts.push(`button=${event.button} buttons=${event.buttons}`);
            if (event.type.endsWith('click')) {
                parts.push(`detail=${event.detail}`);
            }
        }
        if (typeof TouchEvent !== 'undefined' && event instanceof TouchEvent) {
            parts.push(`touches=${event.touches.length}`);
        }
        parts.push(describeTarget(event.target));
        // Read after all listeners have run
        setTimeout(() => {
            lines.push(`${parts.join(' ')}${event.defaultPrevented ? ' prevented' : ''}`);
            if (lines.length > 300) {
                lines.splice(0, lines.length - 300);
            }
            render();
        });
    };
    for (const type of LOGGED_EVENTS) {
        window.addEventListener(type, log, { capture: true, passive: true });
    }
    for (const type of ['blur', 'focus']) {
        window.addEventListener(type, (event) => event.target === window && log(event));
    }
    document.addEventListener('visibilitychange', () => {
        lines.push(`${`${Math.round(performance.now() - start)}`.padStart(6)} visibility ${document.visibilityState}`);
        render();
    });
}

let toastTimer = 0;

/**
 * Short message at the bottom of the screen: visible on a phone without devtools
 */
export function toast(message: string): void {
    let element = document.querySelector<HTMLElement>('.toast');
    if (!element) {
        element = document.createElement('div');
        element.className = 'toast';
        element.setAttribute('role', 'status');
        document.body.append(element);
    }
    element.textContent = message;
    element.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => {
        if (element) {
            element.hidden = true;
        }
    }, 1500);
}

// Demo links and buttons report activation instead of navigating. A click prevented by ScrollBooster after drag
// shows nothing, so a toast means the click went through.
document.addEventListener('click', (event) => {
    const target =
        event.target instanceof Element ? event.target.closest('a[href^="#open-"], button[data-toast]') : null;
    if (!target) {
        return;
    }
    if (target instanceof HTMLAnchorElement) {
        if (!event.defaultPrevented) {
            toast(`Opened ${target.textContent}`);
        }
        event.preventDefault();
    } else if (!event.defaultPrevented) {
        toast(`Pressed ${target.textContent}`);
    }
});

const CELL_CONTROLS = [
    (index: number) => `<a href="#open-${index}">Link ${index}</a>`,
    (index: number) => `<a href="#open-${index}">Link ${index}</a>`,
    (index: number) => `<button type="button" data-toast>Button ${index}</button>`,
    (index: number) => `<a href="#open-${index}">Link ${index}</a>`,
    (index: number) => `<input aria-label="Input ${index}" placeholder="Input ${index}" size="10">`,
];

/**
 * Cells with links, buttons and inputs for a two-dimensional board, numbered after the existing ones
 */
export function fillBoard(board: HTMLElement, count: number): void {
    const start = board.children.length + 1;
    for (let index = start; index < start + count; index++) {
        const cell = document.createElement('div');
        cell.className = 'cell';
        const control = CELL_CONTROLS[index % CELL_CONTROLS.length];
        cell.innerHTML = `<strong>Cell ${index}</strong>${control?.(index) ?? ''}`;
        board.append(cell);
    }
}

/**
 * Cards with a link for a horizontal strip, numbered after the existing ones
 */
export function fillStrip(strip: HTMLElement, count: number, label = 'Card'): void {
    const start = strip.children.length + 1;
    for (let index = start; index < start + count; index++) {
        const card = document.createElement('div');
        card.className = 'card';
        card.innerHTML = `<strong>${label} ${index}</strong><a href="#open-${index}">Open ${label.toLowerCase()} ${index}</a>`;
        strip.append(card);
    }
}

/**
 * Text that makes the page scroll around a demo
 */
export function fillText(element: HTMLElement, paragraphs: number): void {
    const text =
        'Filler text so that the page itself scrolls. Wheel, trackpad and touch gestures over the demo go to the ' +
        'content while it can move along the gesture, then to the page. ';
    for (let index = 0; index < paragraphs; index++) {
        const paragraph = document.createElement('p');
        paragraph.textContent = text.repeat(3);
        element.append(paragraph);
    }
}

const PANEL_FIELDS = [
    'position',
    'maxPosition',
    'dragOffset',
    'dragAngle',
    'isMoving',
    'isDragging',
    'borderCollision',
    'viewport',
    'content',
    'touch-action',
    'refresh rate',
    'onUpdate/s',
] as const;

type PanelField = (typeof PANEL_FIELDS)[number];

const format = (value: number): string => String(Math.round(value * 10) / 10);

/**
 * Live view of `getState()` with the measured refresh rate and the current `touch-action` of viewport.
 * Returns the function to call from `onUpdate`.
 */
export function createPanel(host: HTMLElement, getViewport: () => HTMLElement): (state: ScrollBoosterState) => void {
    const panel = document.createElement('dl');
    panel.className = 'panel';
    const values = new Map<PanelField, HTMLElement>();
    for (const field of PANEL_FIELDS) {
        const row = document.createElement('div');
        const name = document.createElement('dt');
        const value = document.createElement('dd');
        name.textContent = field;
        value.textContent = '–';
        row.append(name, value);
        panel.append(row);
        values.set(field, value);
    }
    host.append(panel);

    const set = (field: PanelField, text: string, isOn = false) => {
        const value = values.get(field);
        if (value) {
            value.textContent = text;
            value.classList.toggle('on', isOn);
        }
    };

    // Median frame interval of the last second: the display refresh rate, or less when frames are dropped
    const intervals: number[] = [];
    let lastFrame = 0;
    let lastReport = 0;
    let updates = 0;
    const measure = (time: number) => {
        if (lastFrame) {
            intervals.push(time - lastFrame);
            if (intervals.length > 60) {
                intervals.shift();
            }
        }
        lastFrame = time;
        if (time - lastReport >= 500) {
            const sorted = [...intervals].sort((a, b) => a - b);
            const median = sorted[sorted.length >> 1];
            set('refresh rate', median ? `${Math.round(1000 / median)} Hz` : '–');
            set('onUpdate/s', lastReport ? String(Math.round((updates * 1000) / (time - lastReport))) : '–');
            set('touch-action', getComputedStyle(getViewport()).touchAction);
            updates = 0;
            lastReport = time;
        }
        requestAnimationFrame(measure);
    };
    requestAnimationFrame(measure);

    return (state) => {
        updates++;
        const { borderCollision } = state;
        const sides = (['left', 'right', 'top', 'bottom'] as const).filter((side) => borderCollision[side]);
        set('position', `${format(state.position.x)}, ${format(state.position.y)}`);
        set('maxPosition', `${format(state.maxPosition.x)}, ${format(state.maxPosition.y)}`);
        set('dragOffset', `${format(state.dragOffset.x)}, ${format(state.dragOffset.y)}`);
        set('dragAngle', `${format(state.dragAngle)}°`);
        set('isMoving', String(state.isMoving), state.isMoving);
        set('isDragging', String(state.isDragging), state.isDragging);
        set('borderCollision', sides.join(' ') || 'none');
        set('viewport', `${format(state.viewport.width)} × ${format(state.viewport.height)}`);
        set('content', `${format(state.content.width)} × ${format(state.content.height)}`);
    };
}

/**
 * Last callback calls, newest first
 */
export function createLog(host: HTMLElement): (message: string) => void {
    const list = document.createElement('ol');
    list.className = 'log';
    list.setAttribute('aria-label', 'Callback log');
    host.append(list);
    return (message) => {
        const item = document.createElement('li');
        const time = new Date();
        item.textContent = `${time.toLocaleTimeString()}.${String(time.getMilliseconds()).padStart(3, '0')} ${message}`;
        list.prepend(item);
        while (list.children.length > 50) {
            list.lastElementChild?.remove();
        }
    };
}

/**
 * Element by selector that must be on the page
 */
export function $<T extends HTMLElement = HTMLElement>(selector: string, parent: ParentNode = document): T {
    const element = parent.querySelector<T>(selector);
    if (!element) {
        throw new Error(`Demo: no element ${selector}`);
    }
    return element;
}
