import { ScrollBooster } from '../src/index.ts';
import { $, createPanel, fillBoard, fillStrip, mountNav } from './shared/demo.ts';

mountNav();

const board = $('#board');
const rows = $('.rows', board);
for (let index = 1; index <= 8; index++) {
    const row = document.createElement('div');
    row.className = 'row';
    row.innerHTML = `<strong>Row ${index}</strong><div class="viewport"><div class="strip"></div></div>`;
    rows.append(row);
    const viewport = $('.viewport', row);
    fillStrip($('.strip', viewport), 12, `Row ${index} item`);
    new ScrollBooster({ viewport, direction: 'horizontal' });
}
new ScrollBooster({ viewport: board, direction: 'vertical', onUpdate: createPanel($('#board-panel'), () => board) });

const map = $('#map');
const inner = $('#inner');
fillBoard($('.board', inner), 48);
fillBoard($('#outer-board'), 96);
new ScrollBooster({ viewport: map, onUpdate: createPanel($('#map-panel'), () => map) });
new ScrollBooster({ viewport: inner, onUpdate: createPanel($('#inner-panel'), () => inner) });
