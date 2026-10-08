/**
 * Known bugs from the modernization plan (Б6), written as tests of the expected behavior.
 * `it.fails` passes while the bug exists; when a fix lands, the test starts failing
 * and must be switched to `it` and moved to the relevant test file.
 */
import { describe, expect, it } from 'vitest';
import { mount } from './helpers.js';

describe('known bugs', () => {
    // Expected semantics depend on open question В3 in the plan
    it.fails('Б6: isDragging is false after release', () => {
        const { sb, pointer } = mount();

        pointer.mouseDrag([200, 200], [100, 200]);

        expect(sb.getState().isDragging).toBe(false);
    });
});
