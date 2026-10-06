// A small pixel animal for each teammate, drawn from their member id so it never changes on a rename.
// Ported from the approved mockup: FNV-1a hash seeds a tiny PRNG that picks a species, a coat and a background.

import type { Status } from './rows'

function hash(s: string): number {
  let h = 2166136261
  for (const c of s) {
    h ^= c.codePointAt(0)!
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function rng(seed: number): () => number {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const pick = <T,>(r: () => number, list: T[]): T => list[Math.floor(r() * list.length)]!

// 10 x 10 grid. F fur, L light fur, D dark, E eye, W white, N nose, P pink, B beak/feet, . empty
type Species = { rows: string[]; coats: string[][] }
const SPECIES: Record<string, Species> = {
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
    coats: [['#26282e', '#f4f4f0', '#26282e']]
  }
}
const KINDS = Object.keys(SPECIES)
const BG = ['#2c3a55', '#2f4a3f', '#4a3a2c', '#4a2f42', '#363252', '#2f4448', '#47432c', '#3a3a3e']

// The panel color, used as the ring around the status dot so it reads as cut out of the picture.
const PANEL = '#20201f'
const DOT: Record<Status, string> = { live: '#8CC9A1', idle: '#D6BA7B', offline: '#7B776C' }

function draw(seed: string) {
  const r = rng(hash(seed))
  const kind = pick(r, KINDS)
  const sp = SPECIES[kind]!
  const [fur, light, dark] = pick(r, sp.coats) as [string, string, string]
  const bg = pick(r, BG)
  return { kind, sp, colors: { F: fur, L: light, D: dark, E: '#141416', W: '#ffffff', N: '#e07a8a', P: '#f2a7b5', B: '#e8a33a' } as Record<string, string>, bg }
}

/** The species a seed draws, for tests. */
export function speciesOf(seed: string): string {
  return draw(seed).kind
}

/** Square avatar of `size` px with a status dot at the bottom-right corner. */
export function avatarSvg(seed: string, size: number, status: Status, waved = false): { source: string; alt: string } {
  const { kind, sp, colors, bg } = draw(seed)
  const px = size / 12
  const cells: string[] = []
  sp.rows.forEach((row, y) =>
    [...row].forEach((c, x) => {
      const fill = colors[c]
      if (fill) cells.push(`<rect x="${(px + x * px).toFixed(2)}" y="${(px + y * px).toFixed(2)}" width="${(px + 0.05).toFixed(2)}" height="${(px + 0.05).toFixed(2)}" fill="${fill}"/>`)
    })
  )
  const rad = size * 0.16
  const c = (size - rad - 2).toFixed(2)
  const hand: string[] = []
  if (waved) {
    ['..X.X.X.', '..X.X.XX', '..XXXXXX', 'X.XXXXXX', 'XXXXXXXX', '.XXXXXXX', '..XXXXX.', '...XXX..'].forEach((row, y) => {
      [...row].forEach((cell, x) => {
        if (cell === 'X') hand.push(`<rect x="${x}" y="${y}" width="1" height="1" fill="#F2C27A"/>`)
      })
    })
  }
  const source =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">` +
    `<clipPath id="a"><rect width="${size}" height="${size}" rx="${(size * 0.22).toFixed(2)}"/></clipPath>` +
    `<g clip-path="url(#a)" shape-rendering="crispEdges"><rect width="${size}" height="${size}" fill="${bg}"/>${cells.join('')}</g>` +
    `<circle cx="${c}" cy="${c}" r="${(rad + 2).toFixed(2)}" fill="${PANEL}"/>` +
    `<circle cx="${c}" cy="${c}" r="${rad.toFixed(2)}" fill="${DOT[status]}"/>` +
    (waved ? `<g shape-rendering="crispEdges">${hand.join('')}</g>` : '') +
    `</svg>`
  return { source, alt: `${kind} avatar${waved ? ', waved' : ''}` }
}
