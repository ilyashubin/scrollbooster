import { ScrollBooster } from '../src/index.ts';
import { $, createPanel, fillText, mountNav } from './shared/demo.ts';

mountNav();
fillText($('#filler'), 8);

// Fields are not wrapped in labels: a press on a label focuses the field and does not drag
const FIELDS = [
    (id: string) => `<input id="${id}" placeholder="Text field">`,
    (id: string) => `<textarea id="${id}" rows="3">Text area with some text to select</textarea>`,
    (id: string) => `<select id="${id}"><option>First option</option><option>Second option</option></select>`,
    (id: string) => `<button id="${id}" type="button" data-toast>Button</button>`,
    (id: string) => `<a id="${id}" href="#open-${id}">Link</a>`,
];

const viewport = $('#form');
const form = $('.form', viewport);
for (let index = 1; index <= 24; index++) {
    const field = document.createElement('div');
    field.className = 'field';
    field.innerHTML = `<label for="field-${index}">Field ${index}</label>${FIELDS[index % FIELDS.length]?.(`field-${index}`) ?? ''}`;
    form.append(field);
}

const sb = new ScrollBooster({ viewport, onUpdate: createPanel($('#form-panel'), () => viewport) });
for (const option of ['inputsFocus', 'textSelection', 'keyboard'] as const) {
    const checkbox = $<HTMLInputElement>(`#${option.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`);
    checkbox.addEventListener('change', () => sb.updateOptions({ [option]: checkbox.checked }));
}

const article = $('#article');
fillText($('.article', article), 10);
const articleSb = new ScrollBooster({
    viewport: article,
    direction: 'horizontal',
    onUpdate: createPanel($('#article-panel'), () => article),
});
const articleTextSelection = $<HTMLInputElement>('#article-text-selection');
articleTextSelection.addEventListener('change', () =>
    articleSb.updateOptions({ textSelection: articleTextSelection.checked })
);
