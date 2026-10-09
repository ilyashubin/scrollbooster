// Content of the landing examples. It is built before the example scripts run, so they find their elements.

const $ = (selector: string): HTMLElement => {
    const element = document.querySelector<HTMLElement>(selector);
    if (!element) {
        throw new Error(`Landing: ${selector} not found`);
    }
    return element;
};

const PLACES = [
    'Kyoto',
    'Lisbon',
    'Reykjavik',
    'Marrakesh',
    'Hanoi',
    'Valparaiso',
    'Tbilisi',
    'Oaxaca',
    'Bergen',
    'Zanzibar',
    'Matera',
    'Hoi An',
];

function buildGallery(): void {
    const cards = $('#gallery-cards');
    PLACES.forEach((place, index) => {
        const card = document.createElement('a');
        card.className = 'card';
        card.href = `#${place.toLowerCase().replace(' ', '-')}`;
        card.style.setProperty('--hue', String((index * 67 + 10) % 360));
        card.innerHTML = `<span class="card-art"></span><strong>${place}</strong><span>Open guide →</span>`;
        cards.append(card);
    });
}

const SLIDES = [
    ['Drag', 'Mouse, pen and touch move the content, one pointer at a time'],
    ['Throw', 'Inertia continues the motion and fades out the same way at 60 and 120 Hz'],
    ['Bounce', 'Past an edge the content resists and springs back on release'],
    ['Snap', 'Choose where the motion ends: slides, pages or grid cells'],
    ['Scroll', 'Wheel, trackpad and keys move the content when it can move'],
];

function buildCarousel(): void {
    const track = $('#carousel-track');
    const dots = $('#carousel-dots');
    SLIDES.forEach(([title, text], index) => {
        const slide = document.createElement('div');
        slide.className = 'slide';
        slide.style.setProperty('--hue', String((index * 55 + 190) % 360));
        slide.innerHTML = `<span class="slide-number">0${index + 1}</span><strong>${title}</strong><p>${text}</p>`;
        track.append(slide);
        const dot = document.createElement('button');
        dot.type = 'button';
        dot.setAttribute('aria-label', `Slide ${index + 1}`);
        dots.append(dot);
    });
}

const REGIONS = ['North', 'South', 'East', 'West', 'Central'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function buildTable(): void {
    const table = $('#table-content');
    // Deterministic numbers, the same on every load
    let seed = 7;
    const next = () => {
        seed = (seed * 16807) % 2147483647;
        return seed / 2147483647;
    };
    const head = `<thead><tr><th>Store</th><th>Region</th>${MONTHS.map((month) => `<th>${month}</th>`).join('')}<th>Done</th></tr></thead>`;
    const rows = Array.from({ length: 24 }, (_, row) => {
        const cells = MONTHS.map(() => `<td>${(next() * 90 + 10).toFixed(1)}k</td>`).join('');
        const checked = next() > 0.5 ? ' checked' : '';
        return `<tr><th>Store ${String(row + 1).padStart(2, '0')}</th><td>${REGIONS[row % REGIONS.length]}</td>${cells}<td><input type="checkbox" aria-label="Done"${checked}></td></tr>`;
    });
    table.innerHTML = `${head}<tbody>${rows.join('')}</tbody>`;
}

const TOPICS = [
    'All',
    'Design',
    'Engineering',
    'Product',
    'Research',
    'Marketing',
    'Sales',
    'Support',
    'Operations',
    'Finance',
    'Legal',
    'People',
    'Security',
    'Data',
];

function buildTabs(): void {
    const track = $('#tabs-track');
    TOPICS.forEach((topic, index) => {
        const tab = document.createElement('button');
        tab.type = 'button';
        tab.setAttribute('role', 'tab');
        tab.setAttribute('aria-selected', String(index === 0));
        tab.textContent = topic;
        track.append(tab);
    });
}

// Hills of a layer as an SVG path: a wavy line over the given width
function hills(width: number, height: number, base: number, amplitude: number, waves: number, phase: number): string {
    const points: string[] = [];
    for (let x = 0; x <= width; x += 20) {
        const y =
            base -
            amplitude * Math.sin((x / width) * Math.PI * waves + phase) -
            (amplitude / 3) * Math.sin((x / width) * Math.PI * waves * 3.1 + phase * 2);
        points.push(`${x},${y.toFixed(1)}`);
    }
    return `<path d="M0,${height} L${points.join(' L')} L${width},${height} Z"/>`;
}

function buildScene(): void {
    const width = 2400;
    const height = 320;
    const svg = (content: string) =>
        `<svg viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" preserveAspectRatio="none">${content}</svg>`;
    $('#scene-far').innerHTML = svg(hills(width, height, 170, 60, 7, 0.4));
    $('#scene-mid').innerHTML = svg(hills(width, height, 230, 40, 11, 1.7));
    // Trees on the near hills
    const trees = Array.from({ length: 40 }, (_, index) => {
        const x = index * 60 + ((index * 37) % 25);
        const top = 250 - ((index * 53) % 40);
        return `<path d="M${x},${top} l14,40 h-28 Z M${x - 3},${top + 40} h6 v10 h-6 Z"/>`;
    }).join('');
    $('#scene-near').innerHTML = svg(`${hills(width, height, 290, 14, 13, 2.3)}${trees}`);
}

buildGallery();
buildCarousel();
buildTable();
buildTabs();
buildScene();
