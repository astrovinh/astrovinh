// Approved mockup's pixel engine. SMIL runs in the SVG, without timer redraws.
import type { AgentState, AnimalKey, ToolKind } from '../types'
import { STATE_LABEL } from './roster-labels'

export const SPECIES: Record<string, { rows: string[]; coats: string[][] }> = {
  cat: {
    rows: ['.F......F.', '.FF....FF.', '.FFFFFFFF.', 'FFFFFFFFFF', 'FFEFFFFEFF', 'FFFFNNFFFF', 'FFLLLLLLFF', '.FLLLLLLF.', '..FFFFFF..', '..........'],
    coats: [['#e08a3c', '#f6d9b0', '#7a3f12'], ['#8a8f98', '#d7dade', '#4b4f56'], ['#2e2e33', '#6a6a72', '#111114'], ['#e8d2a6', '#fbf1dc', '#9a7b4a']]
  },
  dog: {
    rows: ['..........', '..FFFFFF..', '.DFFFFFFD.', 'DDFFFFFFDD', 'DDEFFFFEDD', 'DDLLLLLLDD', '.DLLNNLLD.', '..LLPPLL..', '...LLLL...', '..........'],
    coats: [['#c99560', '#f3dfc4', '#7a4f2b'], ['#8a5a3a', '#e3c8a8', '#4a2e1c'], ['#ece8e0', '#ffffff', '#9a8f80'], ['#3a3a3f', '#d7d2c8', '#1d1d20']]
  },
  fox: {
    rows: ['D........D', 'FF......FF', 'FFF....FFF', 'FFFFFFFFFF', 'FEFFFFFFEF', 'LLFFFFFFLL', '.LLLLLLLL.', '..LLNNLL..', '...LLLL...', '..........'],
    coats: [['#e0662f', '#fbefe2', '#3a2418'], ['#9aa3ad', '#f2f4f6', '#3b3f45']]
  },
  bear: {
    rows: ['.FF....FF.', 'FLLFFFFLLF', 'FFFFFFFFFF', 'FFFFFFFFFF', 'FFEFFFFEFF', 'FFFLLLLFFF', 'FFLLNNLLFF', '.FLLLLLLF.', '..FFFFFF..', '..........'],
    coats: [['#7a4f33', '#d8b48a', '#3a2416'], ['#b8823e', '#ecd2a2', '#5a3a14'], ['#2b2b2e', '#8a8a90', '#111113']]
  },
  panda: {
    rows: ['.DD....DD.', 'DDDLLLLDDD', '.LLLLLLLL.', 'LLLLLLLLLL', 'LDDLLLLDDL', 'LDWLLLLWDL', 'LLLLNNLLLL', '.LLLLLLLL.', '..LLLLLL..', '..........'],
    coats: [['#f2f2ee', '#f2f2ee', '#1f1f22']]
  },
  rabbit: {
    rows: ['..FF..FF..', '..FP..PF..', '..FP..PF..', '.FFFFFFFF.', 'FFEFFFFEFF', 'FFFFNNFFFF', 'FFLLLLLLFF', '.FLLLLLLF.', '..FFFFFF..', '..........'],
    coats: [['#efece6', '#ffffff', '#9a948a'], ['#9a8f86', '#e6ded6', '#4f4740'], ['#b98a5e', '#efdcc4', '#5e4127']]
  },
  owl: {
    rows: ['.F......F.', '.FF....FF.', 'FFFFFFFFFF', 'FWWFFFFWWF', 'FWEFFFFEWF', 'FFFFBBFFFF', 'FLLLBBLLLF', 'FLLLLLLLLF', '.FLLLLLLF.', '..B....B..'],
    coats: [['#8a6a4a', '#e6d3b6', '#3a2a1c'], ['#7d828a', '#e2e4e8', '#3a3d42']]
  },
  frog: {
    rows: ['..........', '.FF....FF.', 'FWEF..FEWF', 'FFFFFFFFFF', 'FFFFFFFFFF', 'FPFFFFFFPF', 'FFDDDDDDFF', '.FFFFFFFF.', '..LLLLLL..', '..........'],
    coats: [['#5fae4f', '#cfe8a8', '#2c5a24'], ['#3f9a8a', '#bfe6dc', '#1d4d45']]
  },
  penguin: {
    rows: ['..DDDDDD..', '.DDDDDDDD.', 'DDLLDDLLDD', 'DDLELLELDD', 'DDLLBBLLDD', 'DLLLLLLLLD', 'DLLLLLLLLD', 'DDLLLLLLDD', '.DDLLLLDD.', '..BB..BB..'],
    coats: [['#26282e', '#f4f4f0', '#26282e'], ['#7d828a', '#e2e4e8', '#3a3d42']]
  }
}
const BASE_ANIMALS = {
  ember: { name: 'Ember', kind: 'fox',     coat: 0, bg: '#4a3a2c', role: 'Lead',          maps: 'Your main session' },
  hop:   { name: 'Hop',   kind: 'rabbit',  coat: 0, bg: '#2f4448', role: 'Scout',         maps: 'Explore agents' },
  sage:  { name: 'Sage',  kind: 'owl',     coat: 0, bg: '#363252', role: 'Planner',       maps: 'Plan agents' },
  bruno: { name: 'Bruno', kind: 'bear',    coat: 0, bg: '#2f4a3f', role: 'Builder',       maps: 'General-purpose agents' },
  pan:   { name: 'Pan',   kind: 'panda',   coat: 0, bg: '#2c3a55', role: 'Reviewer',      maps: 'Code review agents' },
  pip:   { name: 'Pip',   kind: 'frog',    coat: 0, bg: '#4a2f42', role: 'Little helper', maps: 'Background tasks' },
  mochi: { name: 'Mochi', kind: 'cat',     coat: 1, bg: '#47432c', role: 'Spare',         maps: 'A second agent of any job' },
  biscuit:{name: 'Biscuit',kind: 'dog',    coat: 0, bg: '#3a3a3e', role: 'Spare',         maps: 'A third agent of any job' },
  waddle:{ name: 'Waddle',kind: 'penguin', coat: 0, bg: '#2f4a3f', role: 'Spare',         maps: 'A fourth agent of any job' }
};
export const ANIMALS: Record<AnimalKey, { name: string; kind: string; coat: number; bg: string; role: string; maps: string }> = { ...BASE_ANIMALS, ember2: { ...BASE_ANIMALS.ember, coat: 1 }, mochi2: { ...BASE_ANIMALS.mochi, coat: 2 }, biscuit2: { ...BASE_ANIMALS.biscuit, coat: 1 }, waddle2: { ...BASE_ANIMALS.waddle, coat: 1 } };

const tr = (type: string, values: string, d: number, extra = '') => `<animateTransform attributeName="transform" type="${type}" values="${values}" dur="${d}s" repeatCount="indefinite" ${extra}/>`;
const an = (attr: string, values: string, d: number, extra = '') => `<animate attributeName="${attr}" values="${values}" dur="${d}s" repeatCount="indefinite" ${extra}/>`;
let UID = 0;

const GLY = {
  read:  '<circle cx="7" cy="7" r="4.2" fill="none" stroke="#2a2724" stroke-width="2"/><path d="M10.2 10.2 L14.5 14.5" stroke="#2a2724" stroke-width="2.4" stroke-linecap="round"/>',
  edit:  '<path d="M2.5 14 L3.6 9.6 L11 2.2 L14 5.2 L6.6 12.6 Z" fill="#2a2724"/>',
  run:   '<path d="M2 3.5 L7.5 8 L2 12.5" fill="none" stroke="#2a2724" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/><path d="M9 13.5 H15" stroke="#2a2724" stroke-width="2.2" stroke-linecap="round"/>',
  think: '<circle cx="3" cy="8" r="1.9" fill="#2a2724"/><circle cx="8" cy="8" r="1.9" fill="#2a2724"/><circle cx="13" cy="8" r="1.9" fill="#2a2724"/>',
  check: '<path d="M2 8.5 L6.2 12.5 L14.5 3" fill="none" stroke="#2e9b5f" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>',
  bang:  '<rect x="6.2" y="1" width="3.6" height="8.6" rx="1.8" fill="#d64545"/><circle cx="8" cy="13.2" r="2" fill="#d64545"/>',
  stop:  '<rect x="3" y="3" width="10" height="10" rx="2" fill="#8a8782"/>'
};
// Badge at the bottom-right corner: tells the state or the tool at a glance, drawn in cells (12 x 12 canvas).
function badge(g: keyof typeof GLY, pulse: boolean) {
  const cx = 9.9, cy = 9.9, r = 2.3, s = (r * 1.45) / 16;
  return `<g>${pulse ? an('opacity', '1;.35;1', 1.3) : ''}<circle cx="${cx}" cy="${cy}" r="${r}" fill="#f6f1e6" stroke="#1a1816" stroke-width=".35"/><g transform="translate(${(cx - 8 * s).toFixed(2)} ${(cy - 8 * s).toFixed(2)}) scale(${s.toFixed(4)})">${GLY[g]}</g></g>`;
}
const zee = (x: number, y: number, s: number, begin: number) => `<g transform="translate(${x} ${y})"><g>${tr('translate', '0 0;.5 -.9', 2.4, `begin="${begin}s"`)}${an('opacity', '0;1;1;0', 2.4, `begin="${begin}s" keyTimes="0;.2;.7;1"`)}<path d="M0 0 H1.2 L0 1.5 H1.2" fill="none" stroke="#9db4ff" stroke-width=".38" stroke-linecap="round" stroke-linejoin="round" transform="scale(${s})"/></g></g>`;
const spark = (x: number, y: number, begin: number) => `<g transform="translate(${x} ${y})"><g>${tr('scale', '0;1;0', 1.4, `begin="${begin}s"`)}<path d="M0 -1 L.28 -.28 L1 0 L.28 .28 L0 1 L-.28 .28 L-1 0 L-.28 -.28 Z" fill="#ffe58a"/></g></g>`;

export function animalSvg(key: AnimalKey, state: AgentState, tool: ToolKind, px = 3, opts: { still?: boolean } = {}): { source: string; alt: string } {
  const a = ANIMALS[key], sp = SPECIES[a.kind]!, u = 'a' + (++UID) + '_';
  const [fur, light, dark] = (sp.coats[a.coat] ?? sp.coats[0])!;
  const col: Record<string, string | undefined> = { F: fur, L: light, D: dark, W: '#ffffff', N: '#e07a8a', P: '#f2a7b5', B: '#e8a33a' };
  const cells: string[] = [], eyes: { x: number; y: number; under: string }[] = [];
  sp.rows.forEach((row, y) => [...row].forEach((c, x) => {
    if (c === 'E') { const n = row[x - 1] && row[x - 1] !== 'E' ? row[x - 1] : row[x + 1]; eyes.push({ x, y, under: col[n ?? ''] || fur! }); cells.push(`<rect x="${1 + x}" y="${1 + y}" width="1.04" height="1.04" fill="${col[n ?? ''] || fur!}"/>`); }
    else if (col[c]) cells.push(`<rect x="${1 + x}" y="${1 + y}" width="1.04" height="1.04" fill="${col[c]}"/>`);
  }));
  const eyeOpen = (c = '#141416') => eyes.map(e => `<rect x="${1 + e.x}" y="${1 + e.y}" width="1.04" height="1.04" fill="${c}"/>`).join('');
  const eyeShut = eyes.map(e => `<rect x="${1 + e.x}" y="${1 + e.y + .6}" width="1.04" height=".36" fill="#141416"/>`).join('');
  const eyeHappy = eyes.map(e => `<rect x="${1 + e.x}" y="${1 + e.y + .35}" width="1.04" height=".36" fill="#141416"/><rect x="${1 + e.x}" y="${1 + e.y + 1.02}" width="1.04" height=".5" fill="#f2a7b5" opacity=".75"/>`).join('');
  const eyeX = eyes.map(e => `<rect x="${1 + e.x}" y="${1 + e.y}" width="1.04" height="1.04" fill="#e0584a"/>`).join('');
  let eyeG = '';
  if (state === 'idle') eyeG = `<g>${eyeOpen()}${an('opacity', '1;1;0;1;1', 3.8, 'keyTimes="0;.9;.93;.96;1" calcMode="discrete"')}</g><g opacity="0">${eyeShut}${an('opacity', '0;0;1;0;0', 3.8, 'keyTimes="0;.9;.93;.96;1" calcMode="discrete"')}</g>`;
  else if (state === 'running') eyeG = `<g>${tr('translate', '-.3 .2;.3 .2;-.3 .2', 2.4)}${eyeOpen()}</g>`;
  else if (state === 'waiting') eyeG = eyeOpen();
  else if (state === 'completed') eyeG = eyeHappy;
  else if (state === 'failed') eyeG = eyeX;
  else eyeG = eyeShut;
  const bob = { idle: tr('translate', '0 0;0 .25;0 0', 3.4), pending: tr('translate', '0 0;0 .5;0 0', 3.8), running: tr('translate', '0 0;0 -.35;0 0', .6), waiting: tr('translate', '-.3 0;.3 0;-.3 0', 1.1), completed: tr('translate', '0 0;0 -1.3;0 0', 1, 'calcMode="spline" keyTimes="0;.45;1" keySplines=".3 0 .5 1;.5 0 .7 1"'), failed: tr('translate', '0 0;0 .15;0 0', 1.4), killed: tr('translate', '0 0;0 -.4;0 0', 3) }[state];
  const tilt = state === 'failed' ? ' transform="rotate(-9 6 10)"' : '';
  const fx = { running: badge(tool || 'think', false), waiting: badge('bang', true), pending: opts.still ? '' : zee(8.4, 3.2, 1, 0) + zee(9.4, 2.2, 1.15, .8) + zee(10.4, 1.1, 1.3, 1.6), completed: badge('check', false) + (opts.still ? '' : spark(1.2, 1.6, 0) + spark(10.8, 2, .5) + spark(1.6, 10.6, 1)),
    failed: badge('bang', false).replace('#d64545', '#d64545'), killed: badge('stop', false), idle: '' }[state] || '';
  const gray = state === 'killed';
  const inner = `<g clip-path="url(#${u}c)"><rect width="12" height="12" fill="${a.bg}"/><g${tilt}><g>${bob}${cells.join('')}${eyeG}</g></g></g>${fx}`;
  const defs = `<defs><clipPath id="${u}c"><rect width="12" height="12" rx="2.6"/></clipPath><filter id="${u}g"><feColorMatrix type="saturate" values=".05"/></filter></defs>`;
  let source = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 12 12" width="${12 * px}" height="${12 * px}" shape-rendering="crispEdges">${defs}${gray ? `<g filter="url(#${u}g)" opacity=".6">${inner}</g>` : inner}</svg>`;
  if (opts.still) source = source.replace(/<animate[^>]*\/>/g, '');
  return { source, alt: `${a.name} the ${a.kind}, ${STATE_LABEL[state].toLowerCase()}` };
}

