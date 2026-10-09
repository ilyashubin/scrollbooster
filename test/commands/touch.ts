import type { CDPSession, Page } from 'playwright';
import type { BrowserCommand } from 'vitest/node';

export type TouchStep = ['start', number, number] | ['move', number, number] | ['end'] | ['longPress', number, number];

// Touch in progress belongs to the CDP session, so one gesture can span several command calls
const sessions = new WeakMap<Page, CDPSession>();

/**
 * Real touch input through Chrome DevTools Protocol, Chromium only. Coordinates are client coordinates inside
 * the test iframe, `innerWidth` of the iframe window is passed to account for iframe scaling in the orchestrator
 * page. Each step waits until the browser has handled the event.
 */
export const touch: BrowserCommand<[steps: TouchStep[], innerWidth: number]> = async (context, steps, innerWidth) => {
    if (
        context.provider.name !== 'playwright' ||
        context.page.context().browser()?.browserType().name() !== 'chromium'
    ) {
        throw new Error('touch command needs Playwright provider with Chromium');
    }
    const frame = await context.frame();
    const box = await (await frame.frameElement()).boundingBox();
    if (!box) {
        throw new Error('Test iframe is not visible');
    }
    const scale = box.width / innerWidth;
    const { page } = context;
    let session = sessions.get(page);
    if (!session) {
        session = await page.context().newCDPSession(page);
        sessions.set(page, session);
    }
    for (const [action, x, y] of steps) {
        if (action === 'longPress') {
            // Held touch from dispatchTouchEvent is not recognized as a long press, a synthesized gesture is
            await session.send('Input.synthesizeTapGesture', {
                x: box.x + x * scale,
                y: box.y + y * scale,
                duration: 1000,
                gestureSourceType: 'touch',
            });
            continue;
        }
        await session.send('Input.dispatchTouchEvent', {
            type: action === 'start' ? 'touchStart' : action === 'move' ? 'touchMove' : 'touchEnd',
            touchPoints: action === 'end' ? [] : [{ x: box.x + x * scale, y: box.y + y * scale }],
        });
    }
};
