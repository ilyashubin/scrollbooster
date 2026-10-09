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
const DIRECTIONS = ['all', 'horizontal', 'vertical'];

const CHECKS: Record<string, Check> = {
    viewport: ELEMENT,
    content: ELEMENT,
    direction: oneOf(...DIRECTIONS),
    pointerMode: oneOf('all', 'touch', 'mouse'),
    scrollMode: oneOf(undefined, 'transform', 'native'),
    bounce: BOOLEAN,
    bounceForce: FACTOR,
    friction: FACTOR,
    textSelection: BOOLEAN,
    inputsFocus: BOOLEAN,
    emulateScroll: BOOLEAN,
    preventDefaultOnEmulateScroll: oneOf(false, 'horizontal', 'vertical'),
    lockScrollOnDragDirection: oneOf(false, ...DIRECTIONS),
    pointerDownPreventDefault: BOOLEAN,
    dragDirectionTolerance: [
        (value) => typeof value === 'number' && value >= 0 && value <= 90,
        'a number of degrees from 0 to 90',
    ],
    reducedMotion: oneOf('auto', 'always', 'never'),
    onPointerDown: FUNCTION,
    onPointerUp: FUNCTION,
    onPointerMove: FUNCTION,
    onClick: FUNCTION,
    onUpdate: FUNCTION,
    onWheel: FUNCTION,
    shouldScroll: FUNCTION,
};

const fail = (message: string): never => {
    throw new TypeError(`ScrollBooster: ${message}`);
};

/**
 * Throw TypeError for unknown options and invalid values, before anything is applied
 */
export function validateOptions(options: unknown): void {
    if (typeof options !== 'object' || options === null) {
        fail('options must be an object');
    }
    for (const [key, value] of Object.entries(options as object)) {
        const check = CHECKS[key];
        if (!check) {
            fail(`unknown option "${key}"`);
        } else if (!check[0](value)) {
            fail(`option "${key}" must be ${check[1]}`);
        }
    }
}

/**
 * Throw TypeError unless content is an element inside viewport
 */
export function validateElements(viewport: unknown, content: unknown): void {
    if (!(viewport instanceof HTMLElement)) {
        fail('option "viewport" must be an HTMLElement');
    }
    if (!content) {
        fail('viewport has no child element, pass the "content" option');
    }
    if (content === viewport || !(viewport as HTMLElement).contains(content as Node)) {
        fail('option "content" must be an element inside "viewport"');
    }
}
