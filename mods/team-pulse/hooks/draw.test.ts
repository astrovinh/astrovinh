import { test, expect } from 'claude-code/testing'
import { esc, rowSvg, ROW_SVG_W, severity, textBar } from './draw'

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
