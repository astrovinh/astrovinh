import type { Piece } from './strip'
import { test, expect } from 'claude-code/testing'
import { bubbleSvg, esc, noteWidth, rowSvg, ROW_SVG_W, severity, STRIP_SVG_W, stripSvg, textBar, textStrip } from './draw'
test('severity matches usage-bars: green, amber from 60, red from 85', () => {
  expect([severity(10), severity(60), severity(85)]).toEqual(['#9ece6a', '#e0af68', '#f7768e'])
})

test('opened usage draws only two bars at a fixed width', () => {
  const { source, alt } = rowSvg({ fiveHour: 64, week: 41, name: 'Linh' })
  expect(source.includes(`width="${ROW_SVG_W}"`)).toBe(true)
  expect(source.includes('>64%<') && source.includes('>41%<')).toBe(true)
  expect(source.includes('12h')).toBe(false)
  expect(alt).toBe('Linh: 5-hour 64%, week 41%')
})

test('missing limits draw a dash, never a bar', () => {
  const { source } = rowSvg({ fiveHour: null, week: null, name: 'Hoa' })
  expect(source.split('>\u2013<').length - 1).toBe(2)
})

test('names and lines are escaped', () => {
  expect(esc('<b>&"x"')).toBe('&lt;b&gt;&amp;&quot;x&quot;')
  const { source } = rowSvg({ fiveHour: 1, week: 1, name: '<script>' })
  expect(source.includes('<script>')).toBe(false)
})

test('terminal bars fill in proportion', () => {
  expect(textBar(50, 10)).toBe('\u2501\u2501\u2501\u2501\u2501\u2500\u2500\u2500\u2500\u2500')
  expect(textBar(null, 4)).toBe('\u00b7\u00b7\u00b7\u00b7')
})

const textLines = (source: string) => [...source.matchAll(/<tspan x="10" y="([\d.]+)" fill="#ecebe6">([^<]*)<\/tspan>/g)].map(m => m[2]!)
const heightOf = (lines: number) => 6 + 8 + lines * 15 + 6

test('a 30-character note is one line and the bubble is narrower than the maximum', () => {
  const note = 'Back from lunch around two pm.'
  expect(note.length).toBe(30)
  const b = bubbleSvg(note, '3h', 290)
  expect(textLines(b.source)).toEqual([note])
  expect(b.source.includes('\u2026')).toBe(false)
  expect(b.width < 290).toBe(true)
  expect(b.height).toBe(heightOf(1))
  expect(b.alt).toBe(`Status: ${note}, 3h`)
})

test('a short note keeps its age on the same line', () => {
  const b = bubbleSvg('lunch', '3h', 290)
  expect(b.source.includes('>lunch<')).toBe(true)
  expect(b.source.includes(' \u00b7 3h')).toBe(true)
  expect(b.alt).toBe('Status: lunch, 3h')
  expect(textLines(b.source).length).toBe(1)
})

test('a 200-character note wraps to several lines, fills the width and grows the height', () => {
  const note = Array.from({ length: 40 }, () => 'word').join(' ').slice(0, 199) + 'x'
  expect(note.length).toBe(200)
  const b = bubbleSvg(note, '3h', 290)
  const lines = textLines(b.source)
  expect(lines.length).toBeGreaterThanOrEqual(3)
  expect(lines.length).toBeLessThanOrEqual(5)
  expect(b.width).toBe(290)
  const ageLine = /<tspan x="10" y="[\d.]+" fill="#AAA69A"/.test(b.source) ? 1 : 0
  expect(b.height).toBe(heightOf(lines.length + ageLine))
  for (const l of lines) expect(noteWidth(l) <= 270).toBe(true)
  expect(b.height > bubbleSvg('hi', '3h', 290).height).toBe(true)
  expect(b.alt).toBe(`Status: ${note}, 3h`)
})

test('wrapping happens between words, never inside one that fits', () => {
  const b = bubbleSvg('alpha beta gamma delta epsilon zeta eta theta iota kappa lambda mu nu xi omicron pi rho', null, 290)
  const lines = textLines(b.source)
  expect(lines.length).toBeGreaterThanOrEqual(2)
  expect(lines.join(' ')).toBe('alpha beta gamma delta epsilon zeta eta theta iota kappa lambda mu nu xi omicron pi rho')
})

test('a 400-character note stops at five lines and the fifth ends with an ellipsis', () => {
  const note = Array.from({ length: 80 }, (_, i) => `w${i}xyz`).join(' ')
  expect(note.length > 400).toBe(true)
  const b = bubbleSvg(note.slice(0, 400), '3h', 290)
  const lines = textLines(b.source)
  expect(lines.length).toBe(5)
  expect(lines[4]!.endsWith('\u2026')).toBe(true)
  expect(lines.slice(0, 4).some(l => l.includes('\u2026'))).toBe(false)
  for (const l of lines) expect(noteWidth(l) <= 270).toBe(true)
  expect(b.width).toBe(290)
  expect(b.alt).toBe(`Status: ${note.slice(0, 400)}, 3h`)
})

test('the age goes on its own extra line when the last line has no room for it', () => {
  // A last line that nearly fills the width cannot take the age.
  const full = 'x'.repeat(42)
  const b = bubbleSvg(`${full} ${full}`, '3h', 290)
  const lines = textLines(b.source)
  expect(lines.length).toBe(2)
  expect(noteWidth(lines[1]! + ' \u00b7 3h') > 270).toBe(true)
  expect(b.height).toBe(heightOf(3))
  // the age line is drawn below the note lines, without the leading separator
  expect(/<tspan x="10" y="[\d.]+" fill="#AAA69A">3h<\/tspan>/.test(b.source)).toBe(true)
  expect(b.source.includes('\u00b7')).toBe(false)
})

test('a 60-character single word is broken safely across lines', () => {
  const word = 'x'.repeat(60)
  const b = bubbleSvg(word, null, 200)
  const lines = textLines(b.source)
  expect(lines.length).toBeGreaterThanOrEqual(2)
  expect(lines.join('')).toBe(word)
  for (const l of lines) expect(noteWidth(l) <= 180).toBe(true)
  expect(b.source.includes('\u2026')).toBe(false)
})

test('the age is always shown, with or without a cut', () => {
  expect(/>3h</.test(bubbleSvg('x'.repeat(2000), '3h', 290).source)).toBe(true)
  expect(bubbleSvg('lunch', '12m', 290).source.includes(' \u00b7 12m')).toBe(true)
  expect(bubbleSvg('lunch', null, 290).source.includes('\u00b7')).toBe(false)
  expect(bubbleSvg('lunch', null, 290).alt).toBe('Status: lunch')
})

test('markup in the note is escaped', () => {
  const b = bubbleSvg('<b>hi</b> & "you"', null, 290)
  expect(b.source.includes('<b>')).toBe(false)
  expect(b.source.includes('&lt;b&gt;')).toBe(true)
  expect(b.alt.includes('<b>')).toBe(false)
})

test('an emoji note keeps the emoji whole, also when wrapped and cut', () => {
  const e = '\u{1F634}'
  expect(bubbleSvg(`${e} sleeping`, '3h', 290).source.includes(`${e} sleeping`)).toBe(true)
  const lone = /[\ud800-\udbff](?![\udc00-\udfff])|(?<![\ud800-\udbff])[\udc00-\udfff]/
  for (const [note, w] of [[e.repeat(40), 100], [e.repeat(140), 290], [`${e} `.repeat(120), 290]] as const) {
    expect(lone.test(bubbleSvg(note, '3h', w).source)).toBe(false)
  }
})

test('noteWidth sizes characters by kind', () => {
  expect(noteWidth('')).toBe(0)
  expect(Math.round(noteWidth('a') * 1000)).toBe(Math.round(5.9 * 1.05 * 1000))
  expect(Math.round(noteWidth('A') * 1000)).toBe(Math.round(7.5 * 1.05 * 1000))
  expect(Math.round(noteWidth('1') * 1000)).toBe(Math.round(6.6 * 1.05 * 1000))
  expect(Math.round(noteWidth(' ') * 1000)).toBe(Math.round(3.1 * 1.05 * 1000))
  expect(Math.round(noteWidth('\u{1F634}') * 1000)).toBe(Math.round(14 * 1.05 * 1000))
  expect(Math.round(noteWidth('.') * 1000)).toBe(Math.round(4.6 * 1.05 * 1000))
})

test('noteWidth counts accented letters wider than plain ones', () => {
  expect(noteWidth('\u0110\u1ee9c \u0111i \u0111\u00f3n con')).toBeGreaterThan(noteWidth('Duc di don con'))
  expect(Math.round(noteWidth('\u00e9') * 1000)).toBe(Math.round(6.4 * 1.05 * 1000))
})

test('the strip draws active pieces blue and idle pieces yellow, brighter while running', () => {
  const draw = (pieces: Piece[]) => stripSvg(pieces).source
  expect(draw([{ from: 0.1, to: 0.2, running: false, active: true }]).includes('fill="rgba(148,183,232,0.55)"')).toBe(true)
  expect(draw([{ from: 0.1, to: 0.2, running: true, active: true }]).includes('fill="#94B7E8"')).toBe(true)
  const idle = draw([{ from: 0.1, to: 0.2, running: false, active: false }])
  expect(idle.includes('fill="rgba(214,186,123,0.55)"')).toBe(true)
  expect(idle.includes('rgba(148,183,232,0.55)')).toBe(false)
  expect(draw([{ from: 0.1, to: 0.2, running: true, active: false }]).includes('fill="#D6BA7B"')).toBe(true)
})

test('the compact strip has a 12h label without usage bars or an hours number', () => {
  const { source, alt } = stripSvg([])
  expect(source.includes('>12h<')).toBe(true)
  expect(source.includes('5h') || source.includes('Week') || source.includes('0.0h')).toBe(false)
  expect(source.includes('fill="#AAA69A"')).toBe(true)
  expect(alt).toBe('Claude activity in the last 12 hours')
})

test('the strip leaves room for the More button inside the bar width', () => {
  const { source } = stripSvg([])
  expect(Number(source.match(/^<svg[^>]* width="(\d+)"/)?.[1])).toBe(STRIP_SVG_W)
  expect(STRIP_SVG_W + 8 + 44).toBeLessThanOrEqual(ROW_SVG_W)
})

test('the strip label and track keep their left alignment with the usage bars', () => {
  const { source } = stripSvg([])
  const bars = rowSvg({ fiveHour: 64, week: 41, name: 'Linh' }).source
  expect(source.includes('<text x="0" y="11"')).toBe(true)
  const stripX = Number(source.match(/<g transform="translate\((\d+) /)?.[1])
  const barX = Number(bars.match(/<g transform="translate\((\d+) /)?.[1])
  expect(stripX).toBe(40)
  expect(stripX).toBe(barX)
})

test('the entire activity track fits inside the compact strip SVG', () => {
  const { source } = stripSvg([{ from: 0.5, to: 1, active: true, running: true }])
  const trackX = Number(source.match(/<g transform="translate\((\d+) /)?.[1])
  const trackWidth = Number(source.match(/<rect y="-1" width="(\d+)"/)?.[1])
  expect(trackWidth).toBe(STRIP_SVG_W - trackX - 8)
  const piece = source.match(/<rect x="([\d.]+)" y="-1" width="([\d.]+)"/)
  expect(trackX + Number(piece?.[1]) + Number(piece?.[2])).toBeLessThanOrEqual(STRIP_SVG_W)
})

test('the terminal strip keeps active, idle and quiet time in order', () => {
  expect(textStrip([
    { from: 0.25, to: 0.5, active: true, running: false },
    { from: 0.5, to: 0.75, active: false, running: true }
  ], 4)).toBe('\u2500\u2501\u2504\u2500')
})
