import { test, expect } from 'claude-code/testing'
import * as bars from './bars'
import { allocate, bandSvg, contextCells, detailSvg, layoutWidth, limitCells, terminalLayout, untilReset, usd } from './bars'
import type { TerminalLayout } from './bars'

const full: TerminalLayout = { bar: 10, labels: 'long', gap: 3, spend: true, system: true, panels: ['day', 'week', 'ctx'], bars: true }
const tiers: TerminalLayout[] = [
  full,
  { ...full, system: false },
  { ...full, bar: 6, gap: 2, system: false },
  { ...full, bar: 6, gap: 2, spend: false, system: false },
  { ...full, bar: 4, labels: 'short', gap: 2, spend: false, system: false },
  { ...full, bar: 0, labels: 'short', gap: 2, spend: false, system: false, bars: false },
  { ...full, bar: 0, labels: 'short', gap: 2, spend: false, system: false, panels: ['day'], bars: false },
  { ...full, bar: 0, labels: 'short', gap: 2, spend: false, system: false, panels: [], bars: false }
]

// Build the worst-case text independently so an undercount in layoutWidth cannot hide overflow.
function worstCaseWidth(layout: TerminalLayout, spendChars: number): number {
  const labels = { day: 'Day', week: 'Week', ctx: 'Ctx' }
  const panels = layout.panels.map(p =>
    `${layout.labels === 'long' ? labels[p] : labels[p][0]}${layout.bars ? ' ' + '#'.repeat(layout.bar) : ''} 100%`
  ).join(' '.repeat(layout.gap))
  return (panels +
    (layout.spend && spendChars > 0 ? ' '.repeat(layout.gap) + '$'.repeat(spendChars) : '') +
    (layout.system ? '   CPU 100%   Mem 100%   Disk 100%' : '')).length
}

test('every terminal width leaves one spare cell for every dollar text length', () => {
  for (let spendChars = 0; spendChars <= 6; spendChars++) {
    for (let columns = 1; columns <= 200; columns++) {
      const layout = terminalLayout(columns, spendChars)
      const width = worstCaseWidth(layout, spendChars)
      expect(width, `band at ${columns} columns, ${spendChars} dollar cells`).toBeLessThanOrEqual(columns - 1)
      expect(layoutWidth(layout, spendChars), `width estimate at ${columns} columns, ${spendChars} dollar cells`).toBe(width)
    }
  }
})

test('a wider terminal never chooses a leaner band', () => {
  for (let spendChars = 0; spendChars <= 6; spendChars++) {
    let previous = tiers.length - 1
    for (let columns = 1; columns <= 200; columns++) {
      const layout = terminalLayout(columns, spendChars)
      const tier = tiers.findIndex(t => JSON.stringify(t) === JSON.stringify(layout))
      expect(tier).toBeGreaterThanOrEqual(0)
      expect(tier).toBeLessThanOrEqual(previous)
      previous = tier
    }
  }
})

test('the terminal keeps the full band before its width is measured', () => {
  expect(terminalLayout(undefined, 6)).toEqual(full)
})

test('each band tier counts its labels, bars, percentages, gaps, dollars and system readings', () => {
  expect(tiers.map(t => layoutWidth(t, 5))).toEqual([106, 72, 57, 50, 37, 22, 6, 0])
  expect(layoutWidth(full, 0)).toBe(98)
  expect(layoutWidth(full, 6)).toBe(107)
})

test('each terminal tier begins exactly when it fits with one spare cell', () => {
  for (let spendChars = 1; spendChars <= 6; spendChars++) {
    for (let i = 0; i < tiers.length - 1; i++) {
      const width = worstCaseWidth(tiers[i]!, spendChars)
      expect(terminalLayout(width + 1, spendChars)).toEqual(tiers[i])
      expect(terminalLayout(width, spendChars)).toEqual(tiers[i + 1])
    }
  }
})

test('unknown dollars use no space and retain the richer tier when widths tie', () => {
  expect(terminalLayout(65, 0)).toEqual(tiers[1])
  expect(terminalLayout(51, 0)).toEqual(tiers[2])
  expect(terminalLayout(50, 0)).toEqual(tiers[4])
})

test('a 110-column terminal gets the full band', () => {
  expect(terminalLayout(110, 5)).toEqual(tiers[0])
})

test('a 60-column terminal keeps six-cell bars and fitting dollars without system readouts', () => {
  expect(terminalLayout(60, 5)).toEqual(tiers[2])
})

test('a 51-column terminal keeps six-cell bars but drops the dollars', () => {
  expect(terminalLayout(51, 5)).toEqual(tiers[3])
})

test('a 30-column terminal shows only percentages', () => {
  expect(terminalLayout(30, 5)).toEqual(tiers[5])
})

test('a 12-column terminal shows only the Day percentage', () => {
  expect(terminalLayout(12, 5)).toEqual(tiers[6])
})

test('a terminal narrower than seven columns draws nothing', () => {
  for (let columns = 1; columns < 7; columns++) expect(terminalLayout(columns, 5)).toEqual(tiers[7])
})

test('allocate always fills the width', () => {
  for (const w of [1, 7, 20, 33]) {
    expect(allocate([5, 3, 1, 1], w).reduce((a, b) => a + b, 0)).toBe(w)
  }
})

test('limit bar shows at least one cell for a small reading', () => {
  expect(limitCells(1, 20)[0]!.width).toBe(1)
  expect(limitCells(0, 20)[0]!.width).toBe(0)
  expect(limitCells(50, 20)[0]!.width).toBe(10)
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
  expect(legend[0]!.color === legend[1]!.color).toBe(false)
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
  expect(source.includes('>Day<')).toBe(true)
  expect(source.includes('>\u2013<')).toBe(true)
  expect(alt).toBe('Day no reading, Week no reading, Context no reading')
})

test('band fills a limit bar in proportion, colored by severity', () => {
  const { source } = bandSvg({ day: { percentUsed: 50 }, week: { percentUsed: 90 }, segments: [], contextPercent: null, spend: null, system: null, now: 0 })
  expect(source.includes('<rect x="0" width="28" height="4" fill="#9ece6a"/>')).toBe(true)
  expect(source.includes('fill="#f7768e"')).toBe(true)
  expect(source.includes('>50%<')).toBe(true)
})

test('hover is one line with day, week and today', () => {
  const now = Date.parse('2026-11-08T00:00:00Z')
  const detail = detailSvg({
    day: { percentUsed: 5, resetsAt: '2026-11-08T00:37:00Z' },
    week: { percentUsed: 9, resetsAt: '2026-11-12T12:00:00Z' },
    segments: [], contextPercent: null,
    spend: { week: 140.129, today: 101.58, sessionsToday: 6, session: 3.41 },
    system: null, now
  })
  const line = 'Day resets in 37m \u00b7 Week resets in 4d 12h \u00b7 Today $101.58'
  expect(detail.alt).toBe(line)
  expect([...detail.source.matchAll(/<text\b[^>]*>(.*?)<\/text>/g)].map(m => m[1])).toEqual([line])
  expect(detail.source).toContain('font-size="14"')
})

test('no reading shows one plain line', () => {
  const detail = detailSvg({ segments: [], contextPercent: null, spend: null, system: null, now: 0 })
  expect(detail.alt).toBe('No limit reading yet')
  expect([...detail.source.matchAll(/<text\b[^>]*>(.*?)<\/text>/g)].map(m => m[1])).toEqual(['No limit reading yet'])
})

test('hover joins only present day, week and today parts', () => {
  for (let mask = 0; mask < 8; mask++) {
    const day = mask & 1 ? { percentUsed: 5, resetsAt: '1970-01-01T00:37:00Z' } : undefined
    const week = mask & 2 ? { percentUsed: 9, resetsAt: '1970-01-05T12:00:00Z' } : undefined
    const spend = mask & 4 ? { week: 140, today: 0, sessionsToday: 6, session: 3 } : null
    const parts = [day ? 'Day resets in 37m' : '', week ? 'Week resets in 4d 12h' : '', spend ? 'Today $0.00' : ''].filter(Boolean)
    const detail = detailSvg({ day, week, spend, segments: [], contextPercent: null, system: null, now: 0 })
    const line = parts.join(' \u00b7 ') || 'No limit reading yet'
    expect(detail.alt).toBe(line)
    expect([...detail.source.matchAll(/<text\b[^>]*>(.*?)<\/text>/g)].map(m => m[1])).toEqual([line])
  }
})

test('hover omits limits without reset times', () => {
  const a = { day: { percentUsed: 5 }, week: { percentUsed: 9, resetsAt: '' }, segments: [], contextPercent: null, system: null, now: 0 }
  expect(detailSvg({ ...a, spend: null }).alt).toBe('No limit reading yet')
  expect(detailSvg({ ...a, spend: { week: 140, today: 27.416, sessionsToday: 6, session: 3 } }).alt).toBe('Today $27.42')
})

test('hover drops system and spend detail', () => {
  const detail = detailSvg({
    segments: [{ name: 'A<b>&"c', tokens: 12000, kind: 'used' }, { name: 'Free', tokens: 9000, kind: 'free' }],
    contextPercent: 6,
    spend: { week: 140.129, today: 27.41, sessionsToday: 6, session: 3.41 },
    system: { cpu: 27, cores: 10, memory: 32, memoryGb: 34, disk: { percent: 77, freeGb: 224 }, battery: { percent: 80, state: 'charging' } },
    now: 0
  })
  for (const omitted of ['CPU', 'Memory', 'Disk', 'Battery', 'Week $', 'sessions', 'this session', 'API prices', 'A<b>', 'A&lt;b&gt;', '12k', 'Free', '<circle']) {
    expect(detail.alt.includes(omitted), `alt omits ${omitted}`).toBe(false)
    expect(detail.source.includes(omitted), `SVG omits ${omitted}`).toBe(false)
  }
  expect(detail.alt).toBe('Today $27.41')
  expect([...detail.source.matchAll(/<text\b[^>]*>(.*?)<\/text>/g)].map(m => m[1])).toEqual(['Today $27.41'])
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
  expect(detailSvg({ segments: [], contextPercent: null, spend, system: null, now: 0 }).alt).toBe('Today $27.41')
})

test('band keeps its system alt text while pills replace the old rings', () => {
  const system = { cpu: 27, cores: 10, memory: 32, memoryGb: 34, disk: { percent: 77, freeGb: 224 }, battery: null }
  const b = bandSvg({ segments: [], contextPercent: null, spend: null, system, now: 0 })
  expect(b.source.includes('stroke-dasharray')).toBe(false)
  expect(b.source.includes('Bat')).toBe(false)
  expect(b.alt.endsWith(', CPU 27%, Memory 32%, Disk 77%')).toBe(true)
  const d = detailSvg({ segments: [], contextPercent: null, spend: null, system, now: 0 })
  expect(d.alt).toBe('No limit reading yet')
})

const desktop = bars
const sys = { cpu: 18, cores: 8, memory: 71, memoryGb: 32, disk: { percent: 83, freeGb: 170 }, battery: null }
const input = { segments: [], contextPercent: null, spend: { week: 1, today: 1, sessionsToday: 1, session: 1 }, system: sys, now: 0 }

test('desktop scale clamps and is monotone over columns 1 through 300', () => {
  expect(typeof desktop.bandScale).toBe('function')
  expect(desktop.bandScale(undefined)).toBe(1.15)
  expect(desktop.bandScale(1)).toBe(1.15)
  expect(desktop.bandScale(300)).toBe(1.6)
  let previous = 1.15
  for (let columns = 1; columns <= 300; columns++) {
    const scale = desktop.bandScale(columns)
    expect(scale).toBeGreaterThanOrEqual(previous)
    expect(scale).toBeLessThanOrEqual(1.6)
    previous = scale
  }
})

test('desktop drawn width fits every pane or draws nothing, without shrinking text', () => {
  expect(typeof desktop.desktopLayout).toBe('function')
  for (let columns = 1; columns <= 300; columns++) {
    const layout = desktop.desktopLayout(columns)
    const band = bandSvg(input, columns)
    expect(layout.scale).toBeGreaterThanOrEqual(1.15)
    expect(band.width === 0 || band.width <= columns * 7 - 16, `drawn width at ${columns} columns`).toBe(true)
    expect(band.width).toBe(layout.width)
  }
})

test('desktop drops dollars, pills, context, then week at four compact widths', () => {
  expect(typeof desktop.desktopLayout).toBe('function')
  expect(desktop.desktopLayout(125)).toMatchObject({ spend: false, system: true, panels: ['day', 'week', 'ctx'] })
  expect(desktop.desktopLayout(100)).toMatchObject({ spend: false, system: false, panels: ['day', 'week', 'ctx'] })
  expect(desktop.desktopLayout(60)).toMatchObject({ spend: false, system: false, panels: ['day', 'week'] })
  expect(desktop.desktopLayout(40)).toMatchObject({ spend: false, system: false, panels: ['day'] })
  expect(desktop.desktopLayout(160)).toMatchObject({ spend: true, system: true, panels: ['day', 'week', 'ctx'] })
})

test('hover card uses one 14px body line and never renders text below 13px', () => {
  for (let columns = 1; columns <= 300; columns++) {
    const scale = typeof desktop.bandScale === 'function' ? desktop.bandScale(columns) : 1
    const detail = detailSvg(input, scale)
    const fonts = [...detail.source.matchAll(/font-size="([\d.]+)"/g)].map(m => Number(m[1]))
    expect(fonts.length).toBeGreaterThanOrEqual(2)
    expect(fonts.includes(14)).toBe(true)
    expect(fonts.includes(13)).toBe(false)
    for (const font of fonts) expect(font * scale).toBeGreaterThanOrEqual(13)
    expect(detail.source).toContain('font-variant-numeric:tabular-nums')
  }
})

test('system pills label each reading, preserve severity, and disable missing readings', () => {
  expect(typeof desktop.systemPills).toBe('function')
  expect(desktop.systemPills(sys).map(p => `${p.label} ${p.value}`)).toEqual(['CPU 18%', 'Mem 71%', 'Disk 83%'])
  expect(desktop.systemPills(sys).map(p => p.color)).toEqual(['#9ece6a', '#e0af68', '#e0af68'])
  for (const percent of [0, 59, 60, 84, 85, 100]) {
    const pills = desktop.systemPills({ ...sys, cpu: percent, memory: percent, disk: { percent, freeGb: 0 } })
    expect(pills.map(p => p.color)).toEqual(Array(3).fill(bars.severityColor(percent)))
  }
  expect(desktop.systemPills({ ...sys, cpu: null })[0]).toMatchObject({ label: 'CPU', value: '\u2013', enabled: false })
  expect(desktop.systemPills(null)).toEqual([])
})

test('drawer uses existing readings only and disappears without a panel or system', () => {
  expect(typeof desktop.drawer).toBe('function')
  expect(desktop.drawer('cpu', sys, 1.15)?.alt).toBe('CPU, CPU 18% used')
  expect(desktop.drawer('mem', sys, 1.15)?.alt).toBe('Memory, Memory 71% used')
  expect(desktop.drawer('disk', sys, 1.15)?.alt).toBe('Disk, Disk 83% used')
  expect(desktop.drawer(null, sys, 1.15)).toBe(null)
  expect(desktop.drawer('mem', null, 1.15)).toBe(null)
})
