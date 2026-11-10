import { test, expect } from 'claude-code/testing'
import * as bars from './bars'
import { allocate, bandSvg, contextCells, desktopLayout, detailSvg, layoutWidth, limitCells, pillHits, terminalLayout, untilReset, usd, weekHover } from './bars'
import type { TerminalLayout } from './bars'

const full: TerminalLayout = { bar: 10, labels: 'long', gap: 3, spend: true, system: true, panels: ['week'], bars: true }
const tiers: TerminalLayout[] = [
  full,
  { ...full, system: false },
  { ...full, bar: 6, gap: 2, system: false },
  { ...full, bar: 6, gap: 2, spend: false, system: false },
  { ...full, bar: 4, labels: 'short', gap: 2, spend: false, system: false },
  { ...full, bar: 0, labels: 'short', gap: 2, spend: false, system: false, bars: false },
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
  expect(tiers.map(t => layoutWidth(t, 5))).toEqual([62, 28, 23, 16, 11, 6, 0])
  expect(layoutWidth(full, 0)).toBe(54)
  expect(layoutWidth(full, 6)).toBe(63)
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
  expect(terminalLayout(21, 0)).toEqual(tiers[1])
  expect(terminalLayout(17, 0)).toEqual(tiers[2])
  expect(terminalLayout(16, 0)).toEqual(tiers[4])
})

test('a 63-column terminal gets the full band, with Week only', () => {
  expect(terminalLayout(63, 5)).toEqual(tiers[0])
  expect(terminalLayout(200, 5).panels).toEqual(['week'])
})

test('a 24-column terminal keeps a six-cell bar and fitting dollars without system readouts', () => {
  expect(terminalLayout(24, 5)).toEqual(tiers[2])
})

test('a 17-column terminal keeps a six-cell bar but drops the dollars', () => {
  expect(terminalLayout(17, 5)).toEqual(tiers[3])
})

test('a 7-column terminal shows only the W percentage', () => {
  expect(terminalLayout(7, 5)).toEqual(tiers[5])
})

test('a terminal narrower than seven columns draws nothing', () => {
  for (let columns = 1; columns < 7; columns++) expect(terminalLayout(columns, 5)).toEqual(tiers[6])
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

test('band shows a dash when Week has no reading, and draws no Day or Ctx', () => {
  const { source, alt } = bandSvg({ day: { percentUsed: 50 }, segments: [{ name: 'Messages', tokens: 9, kind: 'used' }], contextPercent: 40, spend: null, system: null, now: 0 })
  expect(source.includes('>\u2013<')).toBe(true)
  expect(source).not.toContain('>D<')
  expect(source).not.toContain('>Ctx<')
  expect(source).not.toContain('>50%<')
  expect(source).not.toContain('>40%<')
  expect(alt).toBe('Week no reading')
})

test('band fills the Week bar in proportion, colored by severity', () => {
  const { source } = bandSvg({ week: { percentUsed: 50 }, segments: [], contextPercent: null, spend: null, system: null, now: 0 })
  expect(source.includes('<rect x="0" width="28" height="4" fill="#9ece6a"/>')).toBe(true)
  expect(source.includes('>50%<')).toBe(true)
  expect(bandSvg({ week: { percentUsed: 90 }, segments: [], contextPercent: null, spend: null, system: null, now: 0 }).source).toContain('fill="#f7768e"')
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

test('band keeps its system alt text and draws the three pill rings itself', () => {
  const system = { cpu: 27, cores: 10, memory: 32, memoryGb: 34, disk: { percent: 77, freeGb: 224 }, battery: null }
  const b = bandSvg({ segments: [], contextPercent: null, spend: null, system, now: 0 })
  expect(b.source.match(/stroke-dasharray/g)).toHaveLength(3)
  expect(b.source.includes('Bat')).toBe(false)
  expect(b.alt.endsWith(', CPU 27%, Memory 32%, Disk 77%')).toBe(true)
  const d = detailSvg({ segments: [], contextPercent: null, spend: null, system, now: 0 })
  expect(d.alt).toBe('No limit reading yet')
})

const desktop = bars
const sys = { cpu: 18, cores: 8, memory: 71, memoryGb: 32, disk: { percent: 83, freeGb: 170 }, battery: null }
const input = { segments: [], contextPercent: null, spend: { week: 1, today: 1, sessionsToday: 1, session: 1 }, system: sys, now: 0 }

test('the band keeps one text scale and widens to the session, centred room going before the pills', () => {
  for (let columns = 1; columns <= 300; columns++) {
    expect(desktop.bandScale(columns)).toBe(1.15)
    const layout = desktop.desktopLayout(columns)
    const available = columns * 7 - 16
    // As wide as the session allows, up to the cap, never narrower than its content.
    if (layout.panels.length) {
      expect(layout.width).toBe(Math.min(available, desktop.MODULE_MAX_PX))
    } else {
      // Pills alone keep their own width, so the centred band has even room on both sides.
      expect(layout.width).toBe(desktop.desktopLayout(1).width)
      expect(layout.pillsX).toBe(0)
    }
    // The pills end one pad short of the right edge.
    expect(Math.round((12 + layout.pillsX + 170 + 12) * layout.scale)).toBe(Math.round(layout.width))
  }
  expect(desktop.desktopLayout(300).width).toBe(desktop.MODULE_MAX_PX)
  expect(desktop.desktopLayout(100).width).toBe(100 * 7 - 16)
})

test('desktop drawn width fits every pane, or is the pills alone at their smallest, without shrinking text', () => {
  expect(typeof desktop.desktopLayout).toBe('function')
  for (let columns = 1; columns <= 300; columns++) {
    const layout = desktop.desktopLayout(columns)
    const band = bandSvg(input, columns)
    expect(layout.scale).toBeGreaterThanOrEqual(1.15)
    expect(band.width <= Math.max(columns * 7 - 16, desktop.desktopLayout(1).width), `drawn width at ${columns} columns`).toBe(true)
    expect(band.width).toBeGreaterThan(0)
    expect(band.width).toBe(layout.width)
  }
})

test('desktop fits one line: the bar shrinks first, then dollars, then the machine rings, never W or the pills', () => {
  expect(typeof desktop.desktopLayout).toBe('function')
  expect(desktop.desktopLayout(160, true, true, 5)).toMatchObject({ spend: true, system: true, barW: 56, panels: ['week'], machines: 5 })
  expect(desktop.desktopLayout(82, true, true, 5)).toMatchObject({ spend: true, panels: ['week'], machines: 5 })
  expect(desktop.desktopLayout(81, true, true, 5)).toMatchObject({ spend: false, panels: ['week'], machines: 5 })
  expect(desktop.desktopLayout(72, true, true, 5)).toMatchObject({ spend: false, panels: ['week'], machines: 5 })
  expect(desktop.desktopLayout(71, true, true, 5)).toMatchObject({ spend: false, panels: ['week'], machines: 0 })
  expect(desktop.desktopLayout(49, true, true, 5)).toMatchObject({ panels: ['week'], machines: 0 })
  expect(desktop.desktopLayout(48, true, true, 5)).toMatchObject({ system: true, panels: [], machines: 0 })
  for (let columns = 1; columns <= 300; columns++) {
    const l = desktop.desktopLayout(columns, true, true, 5)
    // Rings never come without W, and W never goes while a ring stays.
    if (l.machines) expect(l.panels).toEqual(['week'])
  }
  for (let columns = 1; columns <= 300; columns++) {
    const layout = desktop.desktopLayout(columns)
    expect(layout.system).toBe(true)
    // The pills are inside the band now, so the whole drawn width is the band's.
    expect(layout.width).toBeLessThanOrEqual(Math.max(columns * 7 - 16, desktop.desktopLayout(1).width))
  }
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
  expect(desktop.systemPills(sys).map(p => `${p.label} ${p.value}`)).toEqual(['C 18%', 'M 71%', 'D 83%'])
  expect(desktop.systemPills(sys).map(p => p.color)).toEqual(['#9ece6a', '#e0af68', '#e0af68'])
  for (const percent of [0, 59, 60, 84, 85, 100]) {
    const pills = desktop.systemPills({ ...sys, cpu: percent, memory: percent, disk: { percent, freeGb: 0 } })
    expect(pills.map(p => p.color)).toEqual(Array(3).fill(bars.severityColor(percent)))
  }
  expect(desktop.systemPills({ ...sys, cpu: null })[0]).toMatchObject({ label: 'C', value: '\u2013', enabled: false })
  expect(desktop.systemPills(null)).toEqual([])
})

test('drawer uses existing readings only and disappears without a panel or system', () => {
  expect(typeof desktop.drawer).toBe('function')
  expect(desktop.drawer('cpu', sys, 1.15)?.alt).toBe('CPU 18% busy')
  expect(desktop.drawer('mem', sys, 1.15)?.alt).toBe('Memory 71% used')
  expect(desktop.drawer('disk', sys, 1.15)?.alt).toBe('Disk 83% used, 170 GB free')
  expect(desktop.drawer(null, sys, 1.15)).toBe(null)
  expect(desktop.drawer('mem', null, 1.15)).toBe(null)
})

test('the hover area covers only the Week group', () => {
  const layout = desktopLayout(160)
  const hover = weekHover(layout)!
  const groupW = 24 + layout.barW + 5 + 30
  expect(Math.round(hover.left)).toBe(Math.round(12 * layout.scale))
  expect(Math.round(hover.width)).toBe(Math.round(groupW * layout.scale))
  expect(weekHover(desktopLayout(20))).toBe(null)
})

test('the band draws each pill letter in a severity ring, and only pills with a reading are pressable', () => {
  const band = bandSvg({ segments: [], contextPercent: null, spend: null, system: { ...sys, cpu: null }, now: 0 }, 160)
  expect(band.source).toContain('>C</text>')
  expect(band.source).toContain('stroke="#e0af68"')
  expect(band.source.match(/stroke-dasharray/g)).toHaveLength(2)
  const hits = pillHits(band.layout, { ...sys, cpu: null })
  expect(hits.map(h => h.panel)).toEqual(['mem', 'disk'])
  for (const h of hits) expect(h.left + h.width).toBeLessThanOrEqual(band.width)
  expect(pillHits(desktopLayout(160, true, false), sys)).toEqual([])
})

test('band windows shift the drawing and keep every viewBox at 0 0', () => {
  const s = { cpu: 22, cores: 10, memory: 25, memoryGb: 32, disk: { percent: 64, freeGb: 62 }, battery: null }
  const band = bandSvg({ day: { percentUsed: 10 }, week: { percentUsed: 66 }, segments: [], contextPercent: null, spend: null, system: s, now: 0 }, 150)
  const pictures = bars.bandParts(band, s).filter(p => p.kind === 'picture') as { source: string }[]
  expect(pictures.length).toBeGreaterThan(1)
  for (const pic of pictures) expect(pic.source).toMatch(/viewBox="0 0 /)
  expect(pictures.slice(1).every(pic => /translate\(-[\d.]+ 0\)/.test(pic.source))).toBe(true)
})

const rings = [
  { name: '26', load: 22, off: false },
  { name: '21', load: 72, off: false },
  { name: 'PC', load: 91, off: false },
  { name: 'M4', load: 20, off: false },
  { name: 'M2', load: null, off: true }
]

test('machine rings are the same size as the C M D rings and carry no percent', () => {
  const band = bandSvg({ ...input, week: { percentUsed: 64 }, machines: rings }, 160)
  const radii = [...band.source.matchAll(/<circle [^>]*r="([\d.]+)"/g)].map(m => Number(m[1]))
  expect(new Set(radii)).toEqual(new Set([7]))
  for (const m of rings) expect(band.source).toContain(`>${m.name}</text>`)
  for (const p of ['22%', '72%', '91%', '20%']) expect(band.source).not.toContain(`>${p}<`)
  // The off machine draws a dotted track and no fill.
  expect(band.source).toContain('stroke-dasharray="2 2"')
  expect(band.alt).toBe('Week 64%, This week $1.0, 26 22%, 21 72%, PC 91%, M4 20%, M2 off, CPU 18%, Memory 71%, Disk 83%')
})

test('the All label is a native button between W and the pills, and the rings sit centred in that room', () => {
  for (const columns of [72, 82, 120, 160, 300]) {
    const band = bandSvg({ ...input, week: { percentUsed: 64 }, machines: rings }, columns)
    const buttons = bars.bandParts(band, sys).filter(p => p.kind === 'button') as { label: string; panel: string }[]
    expect(buttons.map(b => b.label)).toEqual(['W', 'All', '18%', '71%', '83%'])
    expect(buttons[1]!.panel).toBe('machines')
    const l = band.layout
    const end = 24 + 5 + 30 + l.barW + (l.spend ? 14 + 48 : 0)
    const left = l.machinesX - end
    const right = l.pillsX - (l.machinesX + 22 + 5 * 16 + 4 * 7)
    expect(Math.abs(left - right)).toBeLessThan(1)
  }
  const none = bandSvg({ ...input, week: { percentUsed: 64 } }, 160)
  expect((bars.bandParts(none, sys).filter(p => p.kind === 'button') as { label: string }[]).map(b => b.label)).toEqual(['W', '18%', '71%', '83%'])
})

test('the All drawer lists each machine with its bars and when it last reported', () => {
  const now = 1_000_000
  const rows = [
    { name: '26', cpu: 18, memory: 35, disk: 64, at: now - 2_000 },
    { name: 'PC', cpu: 91, memory: 80, disk: 30, at: now - 40_000 },
    { name: 'M2', cpu: 10, memory: 10, disk: 10, at: now - 7_200_000 },
    { name: 'M4', cpu: null, memory: null, disk: null, at: null }
  ]
  const card = bars.machinesSvg(rows, now, 1.15, 600, 90_000)
  expect(card.alt).toBe('26 CPU 18%, memory 35%, disk 64%; PC CPU 91%, memory 80%, disk 30%; M2 off; M4 off')
  for (const t of ['now', '40 s ago', 'off, 2 h ago', 'no reading yet']) expect(card.source).toContain(`>${t}</text>`)
  expect(card.width).toBe(600)
  expect(card.source).toMatch(/viewBox="0 0 /)
})
