import type { BrowserCommand } from 'vitest/node';

/**
 * Emulate `prefers-reduced-motion` for the whole page. Command arguments cannot be null, so `'reset'` resets emulation
 */
export const emulateReducedMotion: BrowserCommand<[value: 'reduce' | 'no-preference' | 'reset']> = async (
    context,
    value
) => {
    if (context.provider.name !== 'playwright') {
        throw new Error('emulateReducedMotion command needs Playwright provider');
    }
    await context.page.emulateMedia({ reducedMotion: value === 'reset' ? null : value });
};
