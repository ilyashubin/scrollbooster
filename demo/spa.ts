import { ScrollBooster } from '../src/index.ts';
import { $, createLog, createPanel, fillBoard, mountNav } from './shared/demo.ts';

mountNav();

const viewports = [$('#first'), $('#second')] as const;
for (const viewport of viewports) {
    fillBoard($('.board', viewport), 48);
}

let sb: ScrollBooster | null = null;
let current: HTMLElement = viewports[0];
const updatePanel = createPanel($('#panel'), () => current);
const log = createLog($('#panel'));

// Inline styles the library sets and removes: touch-action on viewport, transform on content
function showStyles(): void {
    $('#styles').textContent = viewports
        .map((viewport) => {
            const content = viewport.firstElementChild;
            return (
                `${viewport.id} viewport style="${viewport.getAttribute('style') ?? ''}"\n` +
                `${viewport.id} content style="${content?.getAttribute('style') ?? ''}"`
            );
        })
        .join('\n');
    for (const viewport of viewports) {
        viewport.classList.toggle('current', Boolean(sb) && viewport === current);
    }
}

function create(): ScrollBooster {
    return new ScrollBooster({
        viewport: current,
        onUpdate(state) {
            updatePanel(state);
            showStyles();
        },
    });
}

$('#mount').addEventListener('click', () => {
    if (sb) {
        log('already created');
        return;
    }
    sb = create();
    log(`created on ${current.id}`);
    showStyles();
});

$('#destroy').addEventListener('click', () => {
    sb?.destroy();
    sb = null;
    log('destroyed');
    showStyles();
});

$('#switch').addEventListener('click', () => {
    current = current === viewports[0] ? viewports[1] : viewports[0];
    // Content defaults to the first child of the new viewport
    sb?.updateOptions({ viewport: current });
    log(`viewport is ${current.id}`);
    showStyles();
});

$('#replace').addEventListener('click', () => {
    const board = document.createElement('div');
    board.className = 'board';
    fillBoard(board, 12 + Math.floor(Math.random() * 84));
    current.replaceChildren(board);
    // The instance keeps the removed content element, pass the new one
    sb?.updateOptions({ content: board });
    log(`content replaced: ${board.children.length} cells`);
    showStyles();
});

$('#stress').addEventListener('click', () => {
    sb?.destroy();
    const start = performance.now();
    for (let index = 0; index < 1000; index++) {
        create().destroy();
    }
    log(`1000 instances in ${Math.round(performance.now() - start)} ms`);
    sb = null;
    showStyles();
});

sb = create();
showStyles();
