import { test, expect } from 'claude-code/testing'
import { allocate, bandSvg, BAND_W, contextCells, detailSvg, limitCells, untilReset, usd } from './bars'

test('allocate always fills the width', () => {
  for (const w of [1, 7, 20, 33]) {
    expect(allocate([5, 3, 1, 1], w).reduce((a, b) => a + b, 0)).toBe(w)
  }
})

test('limit bar shows at least one cell for a small reading', () => {
  expect(limitCells(1, 20)[0].width).toBe(1)
  expect(limitCells(0, 20)[0].width).toBe(0)
  expect(limitCells(50, 20)[0].width).toBe(10)
})

test('context bar gives one color per used category', () => {
  const { cells, legend } = contextCells(
    [
      { name: 'System', tokens: 100, kind: 'used' },
      { name: 'Messages', tokens: 300, kind: 'used' },
      { name: 'Free', tokens: 600, kind: 'free' }
    ],
    20
  )
  expect(legend.length).toBe(2)
  expect(legend[0].color === legend[1].color).toBe(false)
  expect(cells.reduce((a, c) => a + c.width, 0)).toBe(20)
})

test('untilReset formats days, hours, minutes', () => {
  const now = Date.parse('2026-10-02T00:00:00Z')
  expect(untilReset('2026-10-05T04:00:00Z', now)).toBe('3d 4h')
  expect(untilReset('2026-10-02T02:10:00Z', now)).toBe('2h 10m')
  expect(untilReset('2026-10-02T00:20:00Z', now)).toBe('20m')
})

test('band shows a dash when a limit has no reading', () => {
  const { source, alt } = bandSvg({ segments: [], contextPercent: null, spend: null, system: null, now: 0 })
  expect(source.includes(`width="${BAND_W}"`)).toBe(true)
  expect(source.includes('>–<')).toBe(true)
  expect(alt).toBe('Day no reading, Week no reading, Context no reading')
})

test('band fills a limit bar in proportion, colored by severity', () => {
  const { source } = bandSvg({ day: { percentUsed: 50 }, week: { percentUsed: 90 }, segments: [], contextPercent: null, spend: null, system: null, now: 0 })
  expect(source.includes('<rect x="0" width="28" height="4" fill="#9ece6a"/>')).toBe(true)
  expect(source.includes('fill="#f7768e"')).toBe(true)
  expect(source.includes('>50%<')).toBe(true)
})

test('hover row says when there is no limit reading, and gives reset times when there is', () => {
  const now = Date.parse('2026-10-02T00:00:00Z')
  expect(detailSvg({ segments: [], contextPercent: null, spend: null, system: null, now }).alt).toBe('No limit reading yet')
  const { alt } = detailSvg({ day: { percentUsed: 5, resetsAt: '2026-10-02T02:10:00Z' }, week: { percentUsed: 9, resetsAt: '2026-10-05T04:00:00Z' }, segments: [], contextPercent: null, spend: null, system: null, now })
  expect(alt).toBe('Day resets in 2h 10m, Week resets in 3d 4h')
})

test('hover row escapes category names and colors each like its bar', () => {
  const segs = [{ name: 'A<b>&"c', tokens: 12000, kind: 'used' as const }, { name: 'Free', tokens: 9000, kind: 'free' as const }]
  const { source } = detailSvg({ segments: segs, contextPercent: 6, spend: null, system: null, now: 0 })
  expect(source.includes('A&lt;b&gt;&amp;&quot;c 12k')).toBe(true)
  expect(source.includes('A<b>')).toBe(false)
  expect(source.includes(`fill="${contextCells(segs, 56).legend[0]!.color}"`)).toBe(true)
  expect(source.includes('Free')).toBe(false)
})

test('usd cuts digits short and never rounds up', () => {
  expect(usd(0)).toBe('$0.00')
  expect(usd(0.29)).toBe('$0.29')
  expect(usd(0.426)).toBe('$0.42')
  expect(usd(3.49)).toBe('$3.4')
  expect(usd(9.99)).toBe('$9.9')
  expect(usd(12.99)).toBe('$12')
  expect(usd(999.9)).toBe('$999')
  expect(usd(1299)).toBe('$1.2k')
  expect(usd(12999)).toBe('$12k')
})

test("band shows the week's spend at the right, and leaves it out when unknown", () => {
  const spend = { week: 140.129, today: 27.41, sessionsToday: 6, session: 3.41 }
  const shown = bandSvg({ segments: [], contextPercent: null, spend, system: null, now: 0 })
  expect(shown.source.includes('>$140<')).toBe(true)
  expect(shown.alt.endsWith(', This week $140')).toBe(true)
  expect(bandSvg({ segments: [], contextPercent: null, spend: null, system: null, now: 0 }).source.includes('$')).toBe(false)
  expect(detailSvg({ segments: [], contextPercent: null, spend, system: null, now: 0 }).alt.includes('Week $140.13 · today $27.41 in 6 sessions · this session $3.41 · API prices')).toBe(true)
})

test('band adds a ring per system reading, widens to fit, and skips a missing battery', () => {
  const system = { cpu: 27, cores: 10, memory: 32, memoryGb: 34, disk: { percent: 77, freeGb: 224 }, battery: null }
  const b = bandSvg({ segments: [], contextPercent: null, spend: null, system, now: 0 })
  expect(b.width > BAND_W).toBe(true)
  expect(b.source.includes(`width="${b.width}"`)).toBe(true)
  expect(b.source.includes('>CPU 27%<') && b.source.includes('>Mem 32%<') && b.source.includes('>Disk 77%<')).toBe(true)
  expect(b.source.includes('Bat')).toBe(false)
  expect(b.alt.endsWith(', CPU 27%, Memory 32%, Disk 77%')).toBe(true)
  const d = detailSvg({ segments: [], contextPercent: null, spend: null, system, now: 0 })
  expect(d.alt.includes('CPU 27% of 10 cores, Memory 32% of 34 GB, Disk 224 GB free')).toBe(true)
})
