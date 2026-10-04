import { test, expect } from 'claude-code/testing'
import { bubbleSvg, esc, noteWidth, rowSvg, ROW_SVG_W, severity, textBar } from './draw'

test('severity matches usage-bars: green, amber from 60, red from 85', () => {
  expect([severity(10), severity(60), severity(85)]).toEqual(['#9ece6a', '#e0af68', '#f7768e'])
})

test('a row draws two bars and a strip at a fixed width', () => {
  const { source, alt } = rowSvg({ fiveHour: 64, week: 41, pieces: [{ from: 0.5, to: 0.75, running: true }], hours: 3, name: 'Linh' })
  expect(source.includes(`width="${ROW_SVG_W}"`)).toBe(true)
  expect(source.includes('>64%<') && source.includes('>41%<') && source.includes('>3.0h<')).toBe(true)
  expect(alt).toBe('Linh: 5-hour 64%, week 41%, 3.0 hours in the last 12 hours')
})

test('missing limits draw a dash, never a bar', () => {
  const { source } = rowSvg({ fiveHour: null, week: null, pieces: [], hours: 0, name: 'Hoa' })
  expect(source.split('>\u2013<').length - 1).toBe(2)
})

test('names and lines are escaped', () => {
  expect(esc('<b>&"x"')).toBe('&lt;b&gt;&amp;&quot;x&quot;')
  const { source } = rowSvg({ fiveHour: 1, week: 1, pieces: [], hours: 0, name: '<script>' })
  expect(source.includes('<script>')).toBe(false)
})

test('terminal bars fill in proportion', () => {
  expect(textBar(50, 10)).toBe('\u2501\u2501\u2501\u2501\u2501\u2500\u2500\u2500\u2500\u2500')
  expect(textBar(null, 4)).toBe('\u00b7\u00b7\u00b7\u00b7')
})

test('a short note fits whole and the bubble is narrower than the maximum', () => {
  const b = bubbleSvg('lunch', '3h', 290)
  expect(b.source.includes('>lunch<')).toBe(true)
  expect(b.source.includes('\u2026')).toBe(false)
  expect(b.width < 290).toBe(true)
  expect(b.height).toBe(26)
  expect(b.alt).toBe('Status: lunch, 3h')
})

test('a long note is cut with an ellipsis and the bubble is exactly the maximum', () => {
  const b = bubbleSvg('x'.repeat(200), '3h', 290)
  expect(b.source.includes('\u2026')).toBe(true)
  expect(b.source.includes('x'.repeat(200))).toBe(false)
  expect(b.width).toBe(290)
  // the text itself must fit inside the padding
  const shown = /<tspan[^>]*>(x+)\u2026<\/tspan>/.exec(b.source)
  expect(shown).not.toBe(null)
  expect(noteWidth(`${shown![1]}\u2026`) + noteWidth(' \u00b7 3h') + 20 <= 290).toBe(true)
})

test('the age is always shown, even when the note is cut', () => {
  expect(bubbleSvg('x'.repeat(200), '3h', 290).source.includes(' \u00b7 3h')).toBe(true)
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

test('an emoji note keeps the emoji whole, also when cut', () => {
  const e = '\u{1F634}'
  expect(bubbleSvg(`${e} sleeping`, '3h', 290).source.includes(`${e} sleeping`)).toBe(true)
  const cut = bubbleSvg(`${e.repeat(40)}`, null, 100).source
  const lone = /[\ud800-\udbff](?![\udc00-\udfff])|(?<![\ud800-\udbff])[\udc00-\udfff]/.test(cut)
  expect(lone).toBe(false)
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
