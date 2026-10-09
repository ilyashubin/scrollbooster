import type { Direction, ScrollBoosterOptions } from './types';

export type Props = Required<ScrollBoosterOptions>;

const DEFAULTS: Omit<Props, 'viewport' | 'content'> = {
    direction: 'all',
    pointerMode: 'all',
    scrollMode: 'transform',
    bounce: true,
    bounceForce: 0.1,
    friction: 0.05,
    textSelection: false,
    inputsFocus: true,
    wheel: true,
    keyboard: true,
    reducedMotion: 'auto',
    onPointerDown() {},
    onPointerUp() {},
    onPointerMove() {},
    onClick() {},
    onUpdate() {},
    onWheel() {},
    snap: () => undefined,
    shouldDrag() {
        return true;
    },
};

// Native touch gestures left to the browser for each drag direction, the rest are handled as drag
export const TOUCH_ACTION: Record<Direction, string> = {
    horizontal: 'pan-y pinch-zoom',
    vertical: 'pan-x pinch-zoom',
    all: 'pinch-zoom',
};

// Option check: predicate and expected value for the error message
type Check = [test: (value: unknown) => boolean, expected: string];

const oneOf = (...values: unknown[]): Check => [
    (value) => values.includes(value),
    `one of ${values.map(String).join(', ')}`,
];

const BOOLEAN: Check = [(value) => typeof value === 'boolean', 'a boolean'];
const FUNCTION: Check = [(value) => typeof value === 'function', 'a function'];
const ELEMENT: Check = [(value) => value instanceof HTMLElement, 'an HTMLElement'];
// Factors per 60 Hz frame: 0 makes motion endless or still, 1 stops it at once or freezes drag
const FACTOR: Check = [(value) => typeof value === 'number' && value > 0 && value < 1, 'a number between 0 and 1'];

// Keyed by Props, so an option without a check does not compile
const CHECKS: Record<keyof Props, Check> = {
    viewport: ELEMENT,
    content: ELEMENT,
    direction: oneOf('all', 'horizontal', 'vertical'),
    pointerMode: oneOf('all', 'touch', 'mouse'),
    scrollMode: oneOf('transform', 'native', 'none'),
    bounce: BOOLEAN,
    bounceForce: FACTOR,
    friction: FACTOR,
    textSelection: BOOLEAN,
    inputsFocus: BOOLEAN,
    wheel: oneOf(true, false, 'horizontal'),
    keyboard: BOOLEAN,
    reducedMotion: oneOf('auto', 'always', 'never'),
    onPointerDown: FUNCTION,
    onPointerUp: FUNCTION,
    onPointerMove: FUNCTION,
    onClick: FUNCTION,
    onUpdate: FUNCTION,
    onWheel: FUNCTION,
    snap: FUNCTION,
    shouldDrag: FUNCTION,
};
// Lookup by the name of any passed option, unknown ones have no check
const CHECK_BY_NAME: Partial<Record<string, Check>> = CHECKS;

// Declared as a function: TypeScript narrows types after calls only to explicitly typed `never` functions
function fail(message: string): never {
    throw new TypeError(`ScrollBooster: ${message}`);
}

/**
 * Throw TypeError for unknown options and invalid values
 */
function validateOptions(options: unknown): void {
    if (typeof options !== 'object' || options === null) {
        fail('options must be an object');
    }
    for (const [key, value] of Object.entries(options)) {
        const check = CHECK_BY_NAME[key];
        if (!check) {
            fail(`unknown option "${key}"`);
        } else if (!check[0](value)) {
            fail(`option "${key}" must be ${check[1]}`);
        }
    }
}

/**
 * Throw TypeError unless content is an HTMLElement inside viewport
 */
function validateElements(viewport: unknown, content: unknown): asserts content is HTMLElement {
    if (!(viewport instanceof HTMLElement)) {
        fail('option "viewport" must be an HTMLElement');
    }
    if (!(content instanceof HTMLElement)) {
        fail('first child of viewport is not an HTMLElement, pass the "content" option');
    }
    if (content === viewport || !viewport.contains(content)) {
        fail('option "content" must be an element inside "viewport"');
    }
}

/**
 * Options with defaults. Throws TypeError for invalid options, content defaults to the first viewport child.
 */
export function resolveOptions(options: ScrollBoosterOptions): Props {
    validateOptions(options);
    const content = options.content ?? options.viewport?.firstElementChild;
    validateElements(options.viewport, content);
    return { ...DEFAULTS, ...options, content };
}

/**
 * Current options with given ones. Throws TypeError before anything changes, a new viewport without
 * explicit content gets its first child as content.
 */
export function mergeOptions(props: Props, options: Partial<ScrollBoosterOptions>): Props {
    validateOptions(options);
    const isNewViewport = options.viewport && options.viewport !== props.viewport;
    const content = options.content ?? (isNewViewport ? options.viewport?.firstElementChild : props.content);
    const next = { ...props, ...options };
    validateElements(next.viewport, content);
    return { ...next, content };
}
