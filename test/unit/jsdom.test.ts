// @vitest-environment jsdom
/**
 * Component tests of applications mount ScrollBooster in jsdom: no layout, no ResizeObserver, no PointerEvent
 * constructor in older versions
 */
import { expect, it } from 'vitest';
import { ScrollBooster } from '../../src/index';

it('creates, updates and destroys an instance in jsdom', () => {
    const viewport = document.createElement('div');
    viewport.append(document.createElement('div'));
    document.body.append(viewport);

    const sb = new ScrollBooster({ viewport });
    sb.updateOptions({ direction: 'horizontal' });
    sb.updateMetrics();
    sb.scrollTo({ x: 100 });
    sb.setPosition({ x: 0 });
    viewport.dispatchEvent(new Event('scroll'));

    expect(sb.getState().position).toEqual({ x: 0, y: 0 });
    sb.destroy();
    viewport.remove();
});
