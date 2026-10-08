/**
 * Known bugs from the modernization plan (Б5, Б6), written as tests of the expected behavior.
 * `it.fails` passes while the bug exists; when a fix lands, the test starts failing
 * and must be switched to `it` and moved to the relevant test file.
 */
import { describe, expect, it } from 'vitest';
import { mount, tick } from './helpers.js';

// Drag at constant speed (px/s) for given duration and release, at given refresh rate
function flingAt(frameRate, { speed = 1000, duration = 200 } = {}) {
    const frameDuration = 1000 / frameRate;
    const { sb, pointer } = mount();
    const frames = Math.round(duration / frameDuration);
    const distance = (speed * duration) / 1000;
    pointer.mouseDrag([250, 150], [250 - distance, 150], { steps: frames, frameDuration });
    tick(Math.round(1000 / frameDuration), frameDuration);
    return sb.getState().position.x;
}

describe('known bugs', () => {
    it.fails('Б5: inertia travels the same distance at 60 Hz and 120 Hz', () => {
        const at60 = flingAt(60);
        const at120 = flingAt(120);

        expect(Math.abs(at120 - at60) / at60).toBeLessThan(0.05);
    });

    // Expected semantics depend on open question В3 in the plan
    it.fails('Б6: isDragging is false after release', () => {
        const { sb, pointer } = mount();

        pointer.mouseDrag([200, 200], [100, 200]);

        expect(sb.getState().isDragging).toBe(false);
    });
});
