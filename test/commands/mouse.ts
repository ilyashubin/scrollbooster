import type { BrowserCommand } from 'vitest/node';

export type MouseStep =
    | ['move', number, number]
    | ['down']
    | ['up']
    | ['downRight']
    | ['upRight']
    | ['dblclick']
    | ['wheel', number, number];

/**
 * Real mouse input through Playwright. Coordinates are client coordinates inside the test iframe, wheel takes
 * deltas in pixels. `innerWidth` of the iframe window is passed to account for iframe scaling in the orchestrator
 * page.
 */
export const mouse: BrowserCommand<[steps: MouseStep[], innerWidth: number]> = async (context, steps, innerWidth) => {
    if (context.provider.name !== 'playwright') {
        throw new Error('mouse command needs Playwright provider');
    }
    const frame = await context.frame();
    const box = await (await frame.frameElement()).boundingBox();
    if (!box) {
        throw new Error('Test iframe is not visible');
    }
    const scale = box.width / innerWidth;
    const { mouse } = context.page;
    for (const [action, x, y] of steps) {
        if (action === 'move') {
            await mouse.move(box.x + (x as number) * scale, box.y + (y as number) * scale);
        } else if (action === 'wheel') {
            await mouse.wheel(x as number, y as number);
        } else if (action === 'down') {
            await mouse.down();
        } else if (action === 'downRight') {
            await mouse.down({ button: 'right' });
        } else if (action === 'upRight') {
            await mouse.up({ button: 'right' });
        } else if (action === 'dblclick') {
            await mouse.down();
            await mouse.up();
            await mouse.down({ clickCount: 2 });
            await mouse.up({ clickCount: 2 });
        } else {
            await mouse.up();
        }
    }
};
