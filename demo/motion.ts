import { type ReducedMotion, ScrollBooster } from '../src/index.ts';
import { $, createPanel, fillStrip, mountNav } from './shared/demo.ts';

// Lower refresh rate is simulated by running animation frame callbacks on every n-th display frame only.
// Patched before anything requests a frame, the panel then measures the simulated rate too.
let divisor = 1;
const requestFrame = window.requestAnimationFrame.bind(window);
const cancelFrame = window.cancelAnimationFrame.bind(window);
// Public frame id and the id of the display frame it currently waits for
const waiting = new Map<number, number>();
let lastId = 0;
window.requestAnimationFrame = (callback) => {
    const id = ++lastId;
    let frames = 0;
    const step = (time: number) => {
        if (++frames < divisor) {
            waiting.set(id, requestFrame(step));
        } else {
            waiting.delete(id);
            callback(time);
        }
    };
    waiting.set(id, requestFrame(step));
    return id;
};
window.cancelAnimationFrame = (id) => {
    const frame = waiting.get(id);
    if (frame !== undefined) {
        cancelFrame(frame);
        waiting.delete(id);
    }
};

mountNav();

const viewport = $('#strip');
fillStrip($('.strip', viewport), 30);
const updatePanel = createPanel($('#panel'), () => viewport);

interface Trace {
    label: string;
    color: string;
    points: [time: number, x: number][];
}

const COLORS = ['#5b3cc4', '#e0603a', '#1f8a4c', '#c43c8f', '#2f7fd1', '#a68a00'];
const traces: Trace[] = [];
let trace: Trace | null = null;
let traceStart = 0;
let frameTimes: number[] = [];

const canvas = $<HTMLCanvasElement>('#chart');

function draw(): void {
    const ratio = window.devicePixelRatio;
    canvas.width = canvas.clientWidth * ratio;
    canvas.height = canvas.clientHeight * ratio;
    const context = canvas.getContext('2d');
    if (!context) {
        return;
    }
    context.scale(ratio, ratio);
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    const all = trace ? [...traces, trace] : traces;
    const maxTime = Math.max(1000, ...all.flatMap((item) => item.points.map(([time]) => time)));
    const xs = all.flatMap((item) => item.points.map(([, x]) => x));
    const minX = Math.min(0, ...xs);
    const maxX = Math.max(1, ...xs);
    context.font = '11px system-ui';
    context.fillStyle = getComputedStyle(document.body).color;
    context.fillText(`${Math.round(maxTime)} ms`, width - 60, height - 6);
    context.fillText(`${Math.round(maxX)} px`, 6, 14);
    for (const item of all) {
        context.strokeStyle = item.color;
        context.lineWidth = 2;
        context.beginPath();
        for (const [index, [time, x]] of item.points.entries()) {
            const pointX = 8 + (time / maxTime) * (width - 16);
            const pointY = height - 20 - ((x - minX) / (maxX - minX)) * (height - 40);
            if (index === 0) {
                context.moveTo(pointX, pointY);
            } else {
                context.lineTo(pointX, pointY);
            }
        }
        context.stroke();
    }
}

function renderLegend(): void {
    $('#legend').replaceChildren(
        ...traces.map((item) => {
            const entry = document.createElement('li');
            entry.textContent = item.label;
            entry.style.color = item.color;
            return entry;
        })
    );
}

// Frame rate of a motion: median interval between its onUpdate calls
function measuredRate(): string {
    const intervals = frameTimes.slice(1).map((time, index) => time - (frameTimes[index] ?? time));
    const median = intervals.sort((a, b) => a - b)[intervals.length >> 1];
    return median ? `${Math.round(1000 / median)} Hz` : 'one frame';
}

// A line starts where the motion was started: the first onUpdate comes one frame later, and a frame is 4 times
// longer at 15 Hz than at 60 Hz
function startTrace(x: number): void {
    traceStart = performance.now();
    frameTimes = [];
    trace = { label: '', color: COLORS[traces.length % COLORS.length] ?? 'gray', points: [[0, x]] };
}

const sb = new ScrollBooster({
    viewport,
    direction: 'horizontal',
    onPointerDown: (state) => startTrace(state.position.x),
    onUpdate(state) {
        updatePanel(state);
        const now = performance.now();
        // Motions started by wheel or keys have no start call
        if (state.isMoving && !trace) {
            startTrace(state.position.x);
        }
        if (trace) {
            frameTimes.push(now);
            trace.points.push([now - traceStart, state.position.x]);
            if (!state.isMoving) {
                trace.label = `${traces.length + 1}: ${measuredRate()}, ${Math.round(now - traceStart)} ms`;
                traces.push(trace);
                trace = null;
                renderLegend();
            }
            draw();
        }
    },
});

const media = matchMedia('(prefers-reduced-motion: reduce)');
const showMedia = () => {
    $('#media').textContent = `prefers-reduced-motion: ${media.matches ? 'reduce' : 'no-preference'}`;
};
media.addEventListener('change', showMedia);
showMedia();

const reducedMotion = $<HTMLSelectElement>('#reduced-motion');
reducedMotion.addEventListener('change', () => {
    sb.updateOptions({ reducedMotion: reducedMotion.value as ReducedMotion });
});
const divisorSelect = $<HTMLSelectElement>('#divisor');
divisorSelect.addEventListener('change', () => {
    divisor = Number(divisorSelect.value);
});
$('#to-end').addEventListener('click', () => {
    const { position, maxPosition } = sb.getState();
    startTrace(position.x);
    sb.scrollTo({ x: maxPosition.x });
});
$('#to-start').addEventListener('click', () => {
    startTrace(sb.getState().position.x);
    sb.scrollTo({ x: 0 });
});
$('#clear').addEventListener('click', () => {
    traces.length = 0;
    renderLegend();
    draw();
});
window.addEventListener('resize', draw);
draw();
