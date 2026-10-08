import type { BrowserCommand } from 'vitest/node';

type MouseStep = ['move', number, number] | ['down'] | ['up'];

/**
 * Real mouse input through Playwright. Coordinates are client coordinates inside the test iframe,
 * `innerWidth` of the iframe window is passed to account for iframe scaling in the orchestrator page.
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
        } else if (action === 'down') {
            await mouse.down();
        } else {
            await mouse.up();
        }
    }
};
