import { ScrollBooster, type ScrollBoosterOptions } from '../src/index.ts';
import { $, createLog, createPanel, fillBoard, mountNav } from './shared/demo.ts';

mountNav();

type Settings = typeof DEFAULTS;

// Library defaults plus demo switches that map to callbacks and styles
const DEFAULTS = {
    direction: 'all' as NonNullable<ScrollBoosterOptions['direction']>,
    pointerMode: 'all' as NonNullable<ScrollBoosterOptions['pointerMode']>,
    scrollMode: 'transform' as NonNullable<ScrollBoosterOptions['scrollMode']>,
    reducedMotion: 'auto' as NonNullable<ScrollBoosterOptions['reducedMotion']>,
    bounce: true,
    bounceForce: 0.1,
    friction: 0.05,
    textSelection: false,
    axisLock: false,
    inputsFocus: true,
    wheel: true,
    keyboard: true,
    snapToCells: false,
    dragFromLinks: true,
    nativeScrollbars: false,
};

const SELECTS: Partial<Record<keyof Settings, string[]>> = {
    direction: ['all', 'horizontal', 'vertical'],
    pointerMode: ['all', 'touch', 'mouse'],
    scrollMode: ['transform', 'native', 'none'],
    reducedMotion: ['auto', 'always', 'never'],
};

const RANGES: Partial<Record<keyof Settings, { min: number; max: number; step: number }>> = {
    bounceForce: { min: 0.01, max: 0.5, step: 0.01 },
    friction: { min: 0.01, max: 0.5, step: 0.01 },
};

const STORAGE_KEY = 'scrollbooster-demo-sandbox';

// Stored values of other types or of settings that no longer exist are dropped: updateOptions() would throw
function loadSettings(): Settings {
    const settings = { ...DEFAULTS };
    try {
        const stored: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
        for (const [name, value] of Object.entries(stored ?? {})) {
            const values = SELECTS[name as keyof Settings];
            const isKnown = name in DEFAULTS && typeof value === typeof DEFAULTS[name as keyof Settings];
            if (isKnown && (!values || values.includes(value))) {
                Object.assign(settings, { [name]: value });
            }
        }
    } catch {
        // Storage may be unavailable or hold broken JSON, defaults are used then
    }
    return settings;
}

function saveSettings(): void {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {
        // Storage may be unavailable in a private window, settings then live until reload
    }
}

const settings = loadSettings();
const viewport = $('#viewport');
const board = $('#board');
fillBoard(board, 96);

// Cell pitch: width or height plus the gap of `.board`
const CELL = { x: 160, y: 120 };

const updatePanel = createPanel($('#panel'), () => viewport);
const log = createLog($('#panel'));
let wasMoving = false;

function toOptions(): Partial<ScrollBoosterOptions> {
    const { snapToCells, dragFromLinks, nativeScrollbars, ...options } = settings;
    viewport.style.overflow = nativeScrollbars ? 'auto' : '';
    if (options.scrollMode !== 'none') {
        board.style.translate = '';
    }
    return {
        ...options,
        snap: snapToCells
            ? (rest) => ({ x: Math.round(rest.x / CELL.x) * CELL.x, y: Math.round(rest.y / CELL.y) * CELL.y })
            : () => undefined,
        shouldDrag: (_state, event) => dragFromLinks || !(event.target instanceof Element && event.target.closest('a')),
    };
}

const sb = new ScrollBooster({
    viewport,
    ...toOptions(),
    onUpdate(state) {
        updatePanel(state);
        if (settings.scrollMode === 'none') {
            // Custom render: the same picture as transform mode, without bounce beyond the edges
            board.style.translate = `${-state.position.x}px ${-state.position.y}px`;
        }
        if (wasMoving && !state.isMoving) {
            log('motion ended');
        }
        wasMoving = state.isMoving;
    },
    onPointerDown: (_state, event) => log(`onPointerDown ${event.pointerType}`),
    onPointerUp: (state, event) =>
        log(
            `onPointerUp ${event.type}, dragOffset ${Math.round(state.dragOffset.x)}, ${Math.round(state.dragOffset.y)}`
        ),
    onClick: (_state, event) => log(`onClick ${event.defaultPrevented ? 'prevented after drag' : 'passed'}`),
    onWheel: (_state, event) => log(`onWheel ${Math.round(event.deltaX)}, ${Math.round(event.deltaY)}`),
});

// Exposed for experiments from the browser console
Object.assign(window, { sb });

function renderSettings(): void {
    const form = $('#settings');
    form.replaceChildren();
    for (const name of Object.keys(DEFAULTS) as (keyof Settings)[]) {
        const label = document.createElement('label');
        label.append(name);
        const value = settings[name];
        const values = SELECTS[name];
        const range = RANGES[name];
        let control: HTMLInputElement | HTMLSelectElement;
        if (values) {
            control = document.createElement('select');
            control.append(...values.map((option) => new Option(option, option, false, option === value)));
        } else if (range) {
            control = Object.assign(document.createElement('input'), { type: 'range', ...range, value });
            const output = document.createElement('output');
            output.textContent = String(value);
            control.addEventListener('input', () => {
                output.textContent = control.value;
            });
            label.append(output);
        } else {
            control = Object.assign(document.createElement('input'), { type: 'checkbox', checked: value });
        }
        control.name = name;
        control.addEventListener('change', () => {
            const next =
                control instanceof HTMLInputElement && control.type === 'checkbox'
                    ? control.checked
                    : range
                      ? Number(control.value)
                      : control.value;
            Object.assign(settings, { [name]: next });
            saveSettings();
            sb.updateOptions(toOptions());
            log(`updateOptions({ ${name}: ${JSON.stringify(next)} })`);
        });
        label.append(control);
        form.append(label);
    }
    const reset = document.createElement('button');
    reset.type = 'button';
    reset.textContent = 'Reset to defaults';
    reset.addEventListener('click', () => {
        Object.assign(settings, DEFAULTS);
        saveSettings();
        sb.updateOptions(toOptions());
        renderSettings();
        log('settings reset');
    });
    form.append(reset);
}

function renderMethods(): void {
    const methods: [string, () => void][] = [
        ['scrollTo start', () => sb.scrollTo({ x: 0, y: 0 })],
        ['scrollTo end', () => sb.scrollTo(sb.getState().maxPosition)],
        ['scrollBy x +320', () => sb.scrollBy({ x: 320 })],
        ['scrollBy y −240', () => sb.scrollBy({ y: -240 })],
        [
            'scrollIntoView random cell',
            () => {
                const cells = board.children;
                const cell = cells[Math.floor(Math.random() * cells.length)];
                if (cell) {
                    cell.animate([{ opacity: 0.3 }, { opacity: 1 }], 600);
                    sb.scrollIntoView(cell, { align: 'center' });
                }
            },
        ],
        [
            'setPosition center',
            () => {
                const { maxPosition } = sb.getState();
                sb.setPosition({ x: maxPosition.x / 2, y: maxPosition.y / 2 });
            },
        ],
        ['Add a row', () => fillBoard(board, 12)],
    ];
    for (const [title, run] of methods) {
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = title;
        button.addEventListener('click', () => {
            run();
            log(title);
        });
        $('#methods').append(button);
    }
}

renderSettings();
renderMethods();
// Options take the whole screen of a phone, they start folded there
$<HTMLDetailsElement>('#options').open = matchMedia('(min-width: 761px)').matches;
