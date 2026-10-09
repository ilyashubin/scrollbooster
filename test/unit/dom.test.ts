import { expect, it } from 'vitest';
import { prefersReducedMotion } from '../../src/dom';

// Server rendering and test environments without matchMedia, such as jsdom
it('prefersReducedMotion is false without matchMedia', () => {
    expect(typeof globalThis.matchMedia).toBe('undefined');
    expect(prefersReducedMotion()).toBe(false);
});
