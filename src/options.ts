const DIRECTIONS = ['all', 'horizontal', 'vertical'];

// Allowed values of options with a fixed set of values
const ALLOWED_VALUES: Record<string, readonly unknown[]> = {
    direction: DIRECTIONS,
    pointerMode: ['all', 'touch', 'mouse'],
    scrollMode: [undefined, 'transform', 'native'],
    reducedMotion: ['auto', 'always', 'never'],
    lockScrollOnDragDirection: [false, ...DIRECTIONS],
    preventDefaultOnEmulateScroll: [false, 'horizontal', 'vertical'],
};

/**
 * Warn about unknown options and invalid values. Invalid options are still applied, as in 3.x.
 */
export function validateOptions(options: object, knownKeys: readonly string[]): void {
    for (const [key, value] of Object.entries(options)) {
        const allowed = ALLOWED_VALUES[key];
        const problem = !knownKeys.includes(key)
            ? 'is unknown'
            : allowed && !allowed.includes(value)
              ? `must be one of ${allowed.map(String).join(', ')}`
              : // Factors per 60 Hz frame: 0 and 1 make motion endless or stop it
                (key === 'friction' || key === 'bounceForce') && !(typeof value === 'number' && value > 0 && value < 1)
                ? 'must be a number between 0 and 1'
                : key === 'preventPointerMoveDefault'
                  ? 'is deprecated and has no effect'
                  : '';
        if (problem) {
            console.warn(`ScrollBooster: option "${key}" ${problem}`);
        }
    }
}
