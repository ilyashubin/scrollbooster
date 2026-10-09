// Content first: example scripts look up their elements when they run, imports run in this order
import './content.ts';
import './examples/gallery.js';
import './examples/picture.js';
import './examples/carousel.js';
import './examples/table.js';
import './examples/tabs.js';
import './examples/parallax.js';
import carousel from './examples/carousel.js?raw';
import gallery from './examples/gallery.js?raw';
import parallax from './examples/parallax.js?raw';
import picture from './examples/picture.js?raw';
import table from './examples/table.js?raw';
import tabs from './examples/tabs.js?raw';

const SOURCES: Record<string, string> = { gallery, picture, carousel, table, tabs, parallax };

const QUICK_START = `<div class="viewport">
  <div class="content">…</div>
</div>

<style>
  .viewport { overflow: hidden; }
</style>

<script type="module">
  import { ScrollBooster } from 'scrollbooster';

  new ScrollBooster({
    viewport: document.querySelector('.viewport'),
  });
</script>`;

/**
 * Source of an example as a user would write it: imported from the package, indented by two spaces
 */
function toUserCode(source: string): string {
    return source
        .replace(/from '[./]+src\/index\.ts'/, "from 'scrollbooster'")
        .replace(/^(?: {4})+/gm, (indent) => ' '.repeat(indent.length / 2))
        .trim();
}

const KEYWORDS = new Set([
    'import',
    'from',
    'const',
    'let',
    'new',
    'return',
    'if',
    'else',
    'for',
    'of',
    'true',
    'false',
    'null',
    'undefined',
]);

const escapeHtml = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Comments, strings, template literals, numbers, words and the rest, in this order
const JS_TOKENS =
    /(\/\/[^\n]*)|('(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"|`(?:\\.|[^`\\])*`)|(\b\d+(?:\.\d+)?\b)|([A-Za-z_$][\w$]*)|([\s\S])/g;

/**
 * Minimal JavaScript highlighting: enough for short examples without a dependency
 */
function highlightJs(code: string): string {
    let html = '';
    for (const match of code.matchAll(JS_TOKENS)) {
        const [token, comment, string, number, word] = match;
        const rest = code.slice((match.index ?? 0) + token.length);
        if (comment) {
            html += `<span class="t-comment">${escapeHtml(comment)}</span>`;
        } else if (string) {
            html += `<span class="t-string">${escapeHtml(string)}</span>`;
        } else if (number) {
            html += `<span class="t-number">${number}</span>`;
        } else if (word && KEYWORDS.has(word)) {
            html += `<span class="t-keyword">${word}</span>`;
        } else if (word && /^\s*\(/.test(rest)) {
            html += `<span class="t-call">${word}</span>`;
        } else if (word && /^\s*:/.test(rest) && !/^\s*::/.test(rest)) {
            html += `<span class="t-key">${word}</span>`;
        } else {
            html += escapeHtml(token);
        }
    }
    return html;
}

/**
 * HTML highlighting for the quick start: tags and attributes, the script inside goes through highlightJs()
 */
function highlightHtml(code: string): string {
    return code
        .split(/(<script type="module">[\s\S]*?<\/script>)/)
        .map((part) => {
            const script = part.match(/^(<script type="module">)([\s\S]*?)(<\/script>)$/);
            if (script) {
                return `${highlightTag(script[1])}${highlightJs(script[2])}${highlightTag(script[3])}`;
            }
            return part
                .split(/(<[^>]+>)/)
                .map((piece) => (piece.startsWith('<') ? highlightTag(piece) : escapeHtml(piece)))
                .join('');
        })
        .join('');
}

function highlightTag(tag: string): string {
    return `<span class="t-tag">${escapeHtml(tag).replace(/(\w[\w-]*)=(&quot;|")([^"]*)"/g, '<span class="t-key">$1</span>=<span class="t-string">"$3"</span>')}</span>`;
}

let toastTimer: ReturnType<typeof setTimeout> | undefined;

function toast(message: string): void {
    const element = document.querySelector('#toast');
    if (!element) {
        return;
    }
    element.textContent = message;
    element.classList.add('shown');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => element.classList.remove('shown'), 1600);
}

function copy(text: string): void {
    navigator.clipboard.writeText(text).then(
        () => toast('Copied'),
        () => toast('Copy failed')
    );
}

function addCopyButton(block: Element, text: string): void {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'copy';
    button.textContent = 'Copy';
    button.addEventListener('click', () => copy(text));
    block.querySelector('.code-bar')?.append(button);
}

function renderCode(): void {
    for (const block of document.querySelectorAll<HTMLElement>('.code[data-example]')) {
        const code = toUserCode(SOURCES[block.dataset.example ?? ''] ?? '');
        const element = block.querySelector('code');
        if (element) {
            element.innerHTML = highlightJs(code);
        }
        addCopyButton(block, code);
    }
    const quick = document.querySelector('#quick-code');
    const block = quick?.closest('.code');
    if (quick && block) {
        quick.innerHTML = highlightHtml(QUICK_START);
        addCopyButton(block, QUICK_START);
    }
}

function mountInstall(): void {
    const command = document.querySelector('#install-command');
    const tabs = document.querySelectorAll<HTMLButtonElement>('.install-tabs [role="tab"]');
    for (const tab of tabs) {
        tab.addEventListener('click', () => {
            for (const other of tabs) {
                other.setAttribute('aria-selected', String(other === tab));
            }
            if (command) {
                command.textContent = tab.dataset.command ?? '';
            }
        });
    }
    document.querySelector('[data-copy="#install-command"]')?.addEventListener('click', () => {
        copy(command?.textContent ?? '');
    });
}

// Gallery cards are links to nowhere: show what a click would open. A click that ends a drag never gets here.
document.querySelector('#gallery')?.addEventListener('click', (event) => {
    const card = event.target instanceof Element ? event.target.closest('a') : null;
    if (card) {
        event.preventDefault();
        toast(`Opened ${card.querySelector('strong')?.textContent ?? 'card'}`);
    }
});

renderCode();
mountInstall();
