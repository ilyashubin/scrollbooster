import{t as e}from"./scroll-booster-C3eI9fs7.js";var t=e=>{let t=document.querySelector(e);if(!t)throw Error(`Landing: ${e} not found`);return t},n=[`Kyoto`,`Lisbon`,`Reykjavik`,`Marrakesh`,`Hanoi`,`Valparaiso`,`Tbilisi`,`Oaxaca`,`Bergen`,`Zanzibar`,`Matera`,`Hoi An`];function r(){let e=t(`#gallery-cards`);n.forEach((t,n)=>{let r=document.createElement(`a`);r.className=`card`,r.href=`#${t.toLowerCase().replace(` `,`-`)}`,r.style.setProperty(`--hue`,String((n*67+10)%360)),r.innerHTML=`<span class="card-art"></span><strong>${t}</strong><span>Open guide →</span>`,e.append(r)})}var i=[[`Drag`,`Mouse, pen and touch move the content, one pointer at a time`],[`Throw`,`Inertia continues the motion and fades out the same way at 60 and 120 Hz`],[`Bounce`,`Past an edge the content resists and springs back on release`],[`Snap`,`Choose where the motion ends: slides, pages or grid cells`],[`Scroll`,`Wheel, trackpad and keys move the content when it can move`]];function a(){let e=t(`#carousel-track`),n=t(`#carousel-dots`);i.forEach(([t,r],i)=>{let a=document.createElement(`div`);a.className=`slide`,a.style.setProperty(`--hue`,String((i*55+190)%360)),a.innerHTML=`<span class="slide-number">0${i+1}</span><strong>${t}</strong><p>${r}</p>`,e.append(a);let o=document.createElement(`button`);o.type=`button`,o.setAttribute(`aria-label`,`Slide ${i+1}`),n.append(o)})}var o=[`North`,`South`,`East`,`West`,`Central`],s=[`Jan`,`Feb`,`Mar`,`Apr`,`May`,`Jun`,`Jul`,`Aug`,`Sep`,`Oct`,`Nov`,`Dec`];function c(){let e=t(`#table-content`),n=7,r=()=>(n=n*16807%2147483647,n/2147483647);e.innerHTML=`${`<thead><tr><th>Store</th><th>Region</th>${s.map(e=>`<th>${e}</th>`).join(``)}<th>Done</th></tr></thead>`}<tbody>${Array.from({length:24},(e,t)=>{let n=s.map(()=>`<td>${(r()*90+10).toFixed(1)}k</td>`).join(``),i=r()>.5?` checked`:``;return`<tr><th>Store ${String(t+1).padStart(2,`0`)}</th><td>${o[t%o.length]}</td>${n}<td><input type="checkbox" aria-label="Done"${i}></td></tr>`}).join(``)}</tbody>`}var l=[`All`,`Design`,`Engineering`,`Product`,`Research`,`Marketing`,`Sales`,`Support`,`Operations`,`Finance`,`Legal`,`People`,`Security`,`Data`];function u(){let e=t(`#tabs-track`);l.forEach((t,n)=>{let r=document.createElement(`button`);r.type=`button`,r.setAttribute(`role`,`tab`),r.setAttribute(`aria-selected`,String(n===0)),r.textContent=t,e.append(r)})}function d(e,t,n,r,i,a){let o=[];for(let t=0;t<=e;t+=20){let s=n-r*Math.sin(t/e*Math.PI*i+a)-r/3*Math.sin(t/e*Math.PI*i*3.1+a*2);o.push(`${t},${s.toFixed(1)}`)}return`<path d="M0,${t} L${o.join(` L`)} L${e},${t} Z"/>`}function f(){let e=2400,n=t=>`<svg viewBox="0 0 ${e} 320" width="${e}" height="320" preserveAspectRatio="none">${t}</svg>`;t(`#scene-far`).innerHTML=n(d(e,320,170,60,7,.4)),t(`#scene-mid`).innerHTML=n(d(e,320,230,40,11,1.7));let r=Array.from({length:40},(e,t)=>{let n=t*60+t*37%25,r=250-t*53%40;return`<path d="M${n},${r} l14,40 h-28 Z M${n-3},${r+40} h6 v10 h-6 Z"/>`}).join(``);t(`#scene-near`).innerHTML=n(`${d(e,320,290,14,13,2.3)}${r}`)}r(),a(),c(),u(),f();var p=document.querySelector(`#gallery`),m=document.querySelector(`#gallery-progress`);new e({viewport:p,direction:`horizontal`,onUpdate:({position:e,maxPosition:t})=>{let n=t.x?e.x/t.x:0;m.style.scale=`${n} 1`}});var h=document.querySelector(`#picture`),g=h.querySelector(`img`),_=new e({viewport:h}),v=()=>{let{maxPosition:e}=_.getState();_.setPosition({x:e.x/2,y:e.y/2})};g.complete?v():g.addEventListener(`load`,v);var y=document.querySelector(`#carousel`),b=document.querySelectorAll(`#carousel-dots button`),x=new e({viewport:y,direction:`horizontal`,snap:(e,{viewport:t})=>({x:Math.round(e.x/t.width)*t.width}),onUpdate:({position:e,viewport:t})=>{let n=Math.round(e.x/t.width);for(let[e,t]of b.entries())t.toggleAttribute(`aria-current`,e===n)}}),S=e=>e*x.getState().viewport.width,C=document.querySelector(`#carousel-prev`),w=document.querySelector(`#carousel-next`);C.addEventListener(`click`,()=>x.scrollBy({x:S(-1)})),w.addEventListener(`click`,()=>x.scrollBy({x:S(1)}));for(let[e,t]of b.entries())t.addEventListener(`click`,()=>x.scrollTo({x:S(e)}));new e({viewport:document.querySelector(`#table`),scrollMode:`native`,pointerMode:`mouse`,axisLock:!0});var T=document.querySelector(`#tabs`),E=new e({viewport:T,direction:`horizontal`,wheel:`horizontal`,onClick:(e,t)=>{let n=t.target.closest(`[role="tab"]`);n&&!t.defaultPrevented&&(T.querySelector(`[aria-selected="true"]`).setAttribute(`aria-selected`,`false`),n.setAttribute(`aria-selected`,`true`),E.scrollIntoView(n,{align:`center`}))}}),D=document.querySelector(`#scene`),O=D.querySelectorAll(`[data-depth]`);new e({viewport:D,content:D.querySelector(`[data-depth="1"]`),direction:`horizontal`,scrollMode:`none`,onUpdate:({position:e})=>{for(let t of O){let n=-e.x*Number(t.dataset.depth);t.style.translate=`${n}px 0`}}});var k={gallery:`import { ScrollBooster } from '../../../src/index.ts';

const viewport = document.querySelector('#gallery');
const progress = document.querySelector('#gallery-progress');

new ScrollBooster({
    viewport,
    // Vertical swipes and the wheel still scroll the page
    direction: 'horizontal',
    onUpdate: ({ position, maxPosition }) => {
        const share = maxPosition.x
            ? position.x / maxPosition.x
            : 0;
        progress.style.scale = \`\${share} 1\`;
    },
});
`,picture:`import { ScrollBooster } from '../../../src/index.ts';

const viewport = document.querySelector('#picture');
const image = viewport.querySelector('img');

// Both directions, inertia and bounce are on by default
const sb = new ScrollBooster({ viewport });

// Start from the middle of the picture
const center = () => {
    const { maxPosition } = sb.getState();
    sb.setPosition({
        x: maxPosition.x / 2,
        y: maxPosition.y / 2,
    });
};
if (image.complete) {
    center();
} else {
    image.addEventListener('load', center);
}
`,carousel:`import { ScrollBooster } from '../../../src/index.ts';

const viewport = document.querySelector('#carousel');
const dots = document.querySelectorAll('#carousel-dots button');

const sb = new ScrollBooster({
    viewport,
    direction: 'horizontal',
    // Stop on the slide where inertia would end
    snap: (rest, { viewport }) => {
        const index = Math.round(rest.x / viewport.width);
        return { x: index * viewport.width };
    },
    onUpdate: ({ position, viewport }) => {
        const current = Math.round(position.x / viewport.width);
        for (const [index, dot] of dots.entries()) {
            dot.toggleAttribute(
                'aria-current',
                index === current
            );
        }
    },
});

// Slides are as wide as the viewport
const slide = (index) => index * sb.getState().viewport.width;
const prev = document.querySelector('#carousel-prev');
const next = document.querySelector('#carousel-next');
prev.addEventListener('click', () =>
    sb.scrollBy({ x: slide(-1) })
);
next.addEventListener('click', () =>
    sb.scrollBy({ x: slide(1) })
);
for (const [index, dot] of dots.entries()) {
    dot.addEventListener('click', () =>
        sb.scrollTo({ x: slide(index) })
    );
}
`,table:`import { ScrollBooster } from '../../../src/index.ts';

new ScrollBooster({
    viewport: document.querySelector('#table'),
    // The browser scrolls the viewport: sticky cells,
    // scrollbars and touch scrolling keep working
    scrollMode: 'native',
    // Drag with the mouse, touch scrolls natively
    pointerMode: 'mouse',
    // A drag moves along a row or a column
    axisLock: true,
});
`,tabs:`import { ScrollBooster } from '../../../src/index.ts';

const viewport = document.querySelector('#tabs');

const sb = new ScrollBooster({
    viewport,
    direction: 'horizontal',
    // The mouse wheel scrolls the tabs, then the page
    wheel: 'horizontal',
    // The click that ends a drag comes prevented
    onClick: (_state, event) => {
        const tab = event.target.closest('[role="tab"]');
        if (!tab || event.defaultPrevented) {
            return;
        }
        const selected = viewport.querySelector(
            '[aria-selected="true"]'
        );
        selected.setAttribute('aria-selected', 'false');
        tab.setAttribute('aria-selected', 'true');
        sb.scrollIntoView(tab, { align: 'center' });
    },
});
`,parallax:`import { ScrollBooster } from '../../../src/index.ts';

const viewport = document.querySelector('#scene');
const layers = viewport.querySelectorAll('[data-depth]');

new ScrollBooster({
    viewport,
    // The front layer sets the scroll range
    content: viewport.querySelector('[data-depth="1"]'),
    direction: 'horizontal',
    // Draw the position yourself: far layers move slower
    scrollMode: 'none',
    onUpdate: ({ position }) => {
        for (const layer of layers) {
            const x = -position.x * Number(layer.dataset.depth);
            layer.style.translate = \`\${x}px 0\`;
        }
    },
});
`},A=`<div class="viewport">
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
<\/script>`;function j(e){return e.replace(/from '[./]+src\/index\.ts'/,`from 'scrollbooster'`).replace(/^(?: {4})+/gm,e=>` `.repeat(e.length/2)).trim()}var M=new Set([`import`,`from`,`const`,`let`,`new`,`return`,`if`,`else`,`for`,`of`,`true`,`false`,`null`,`undefined`]),N=e=>e.replace(/&/g,`&amp;`).replace(/</g,`&lt;`).replace(/>/g,`&gt;`),P=/(\/\/[^\n]*)|('(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"|`(?:\\.|[^`\\])*`)|(\b\d+(?:\.\d+)?\b)|([A-Za-z_$][\w$]*)|([\s\S])/g;function F(e){let t=``;for(let n of e.matchAll(P)){let[r,i,a,o,s]=n,c=e.slice((n.index??0)+r.length);i?t+=`<span class="t-comment">${N(i)}</span>`:a?t+=`<span class="t-string">${N(a)}</span>`:o?t+=`<span class="t-number">${o}</span>`:s&&M.has(s)?t+=`<span class="t-keyword">${s}</span>`:s&&/^\s*\(/.test(c)?t+=`<span class="t-call">${s}</span>`:s&&/^\s*:/.test(c)&&!/^\s*::/.test(c)?t+=`<span class="t-key">${s}</span>`:t+=N(r)}return t}function I(e){return e.split(/(<script type="module">[\s\S]*?<\/script>)/).map(e=>{let t=e.match(/^(<script type="module">)([\s\S]*?)(<\/script>)$/);return t?`${L(t[1])}${F(t[2])}${L(t[3])}`:e.split(/(<[^>]+>)/).map(e=>e.startsWith(`<`)?L(e):N(e)).join(``)}).join(``)}function L(e){return`<span class="t-tag">${N(e).replace(/(\w[\w-]*)=(&quot;|")([^"]*)"/g,`<span class="t-key">$1</span>=<span class="t-string">"$3"</span>`)}</span>`}var R;function z(e){let t=document.querySelector(`#toast`);t&&(t.textContent=e,t.classList.add(`shown`),clearTimeout(R),R=setTimeout(()=>t.classList.remove(`shown`),1600))}function B(e){navigator.clipboard.writeText(e).then(()=>z(`Copied`),()=>z(`Copy failed`))}function V(e,t){let n=document.createElement(`button`);n.type=`button`,n.className=`copy`,n.textContent=`Copy`,n.addEventListener(`click`,()=>B(t)),e.querySelector(`.code-bar`)?.append(n)}function H(){for(let e of document.querySelectorAll(`.code[data-example]`)){let t=j(k[e.dataset.example??``]??``),n=e.querySelector(`code`);n&&(n.innerHTML=F(t)),V(e,t)}let e=document.querySelector(`#quick-code`),t=e?.closest(`.code`);e&&t&&(e.innerHTML=I(A),V(t,A))}function U(){let e=document.querySelector(`#install-command`),t=document.querySelectorAll(`.install-tabs [role="tab"]`);for(let n of t)n.addEventListener(`click`,()=>{for(let e of t)e.setAttribute(`aria-selected`,String(e===n));e&&(e.textContent=n.dataset.command??``)});document.querySelector(`[data-copy="#install-command"]`)?.addEventListener(`click`,()=>{B(e?.textContent??``)})}document.querySelector(`#gallery`)?.addEventListener(`click`,e=>{let t=e.target instanceof Element?e.target.closest(`a`):null;t&&(e.preventDefault(),z(`Opened ${t.querySelector(`strong`)?.textContent??`card`}`))}),H(),U();