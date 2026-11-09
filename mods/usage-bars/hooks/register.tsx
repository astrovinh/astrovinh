import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { Limit, Segment, Spend, System } from '../types'
import { bandSvg, contextCells, detailSvg, drawer, limitCells, spacerSvg, systemPills, terminalLayout, usd, weekHover } from './bars'
import type { Cell, Panel } from './bars'
import { parseLedger, record, totals } from './ledger'
import type { Ledger } from './ledger'
import { parseCpu, parseDisk, parseMemory } from './system'

const segments = atom({ plugin: 'usage-bars', key: 'segments' } as const, [] as Segment[])
const window_ = atom({ plugin: 'usage-bars', key: 'window' } as const, 0)
const contextPercent = atom({ plugin: 'usage-bars', key: 'contextPercent' } as const, null as number | null)
const limits = atom({ plugin: 'usage-bars', key: 'limits' } as const, [] as Limit[])
const spend = atom({ plugin: 'usage-bars', key: 'spend' } as const, null as Spend | null)
const system = atom({ plugin: 'usage-bars', key: 'system' } as const, null as System | null)
const openPanel = atom({ plugin: 'usage-bars', key: 'panel' } as const, null as Panel | null)

const SYSTEM_MS = 10_000

/** A command's output, or '' when it fails: a missing reading leaves its ring out. */
async function run($: any, argv: string[]): Promise<string> {
  const r = await $.process.run(argv, { timeoutMs: 3000 }).catch(() => null)
  return r && r.exitCode === 0 ? r.stdout : ''
}

let cores = 0
let memoryBytes = 0
let polling = false

/** Reads CPU, memory, disk and battery; about 0.03 s of work, skipped while one is running. */
async function pollSystem($: any) {
  if (polling) return
  polling = true
  try {
    if (!cores) cores = Number((await run($, ['sysctl', '-n', 'hw.ncpu'])).trim()) || 0
    if (!memoryBytes) memoryBytes = Number((await run($, ['sysctl', '-n', 'hw.memsize'])).trim()) || 0
    const [ps, pressure] = await Promise.all([
      run($, ['ps', '-A', '-o', '%cpu=']),
      run($, ['memory_pressure', '-Q'])
    ])
    // macOS keeps user files on the Data volume; `/` is the sealed system snapshot.
    const df = (await run($, ['df', '-k', '/System/Volumes/Data'])) || (await run($, ['df', '-k', '/']))
    await update($, system, () => ({
      cpu: parseCpu(ps, cores),
      cores,
      memory: parseMemory(pressure),
      memoryGb: memoryBytes ? memoryBytes / 1e9 : null,
      disk: parseDisk(df),
      battery: null
    }))
  } finally {
    polling = false
  }
}

async function refresh($: any) {
  const u = await $.session.usage({ breakdown: 'summary' })
  await update($, segments, () => (u.context.breakdown?.categories ?? []).map((c: any) => ({ name: c.name, tokens: c.tokens, kind: c.kind })))
  await update($, window_, () => u.context.breakdown?.rawMaxTokens ?? u.context.window)
  await update($, contextPercent, () => u.context.breakdown?.percentage ?? u.context.percent ?? null)
  await update($, limits, () => u.rateLimits)
  if (u.cost) await tally($, u.cost.usd)
  return u
}

/** Records this session's spend in its own ledger file, then sums every session's. */
async function tally($: any, total: number) {
  const now = await $.clock.now()
  const dir = `${$.plugin.root}/.ledger`
  const mine = `${dir}/${String(await $.session.id()).replace(/[^\w-]/g, '_')}.json`
  const prev = parseLedger(await $.fs.read(mine).catch(() => undefined))
  await $.fs.write(mine, JSON.stringify(record(prev, total, now)))

  const ledgers: Ledger[] = []
  for (const f of await $.fs.list(dir)) {
    if (f.kind !== 'file' || !f.name.endsWith('.json')) continue
    const l = parseLedger(await $.fs.read(`${dir}/${f.name}`).catch(() => undefined))
    if (l) ledgers.push(l)
  }
  await update($, spend, () => totals(ledgers, total, now))
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await refresh($).catch(() => {})
    void pollSystem($).catch(() => {})
    $.clock.every(SYSTEM_MS, () => void pollSystem($).catch(() => {}))
    return next(e)
  })

  on('session.measure', async ($, e, next) => {
    await refresh($).catch(() => {})
    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) return next(e)

    const now = await $.clock.now()
    const lims = await read($, limits)
    const segs = await read($, segments)
    const pct = await read($, contextPercent)
    const spent = await read($, spend)
    const sys = await read($, system)

    const day = lims.find(l => l.kind === 'five_hour')
    const week = lims.find(l => l.kind === 'seven_day')

    if (e.surface === 'desktop') {
      const { Box, Svg, Button, Text } = $.ui.resolve(e)
      const input = { day, week, segments: segs, contextPercent: pct, spend: spent, system: sys, now }
      const band = bandSvg(input, e.viewport?.columns)
      if (!band.width) return next(e)
      const { scale } = band.layout
      const hover = weekHover(band.layout)
      const detail = detailSvg(input, scale, hover ? band.width - hover.left : band.width)
      const opened = drawer(await read($, openPanel), sys, scale, band.width)
      const pills = systemPills(sys).map(pill => (
        <Box key={`pill-${pill.panel}`} marginRight={2}>
          {pill.enabled ? (
            <Button key={`usage-${pill.panel}`} plain hover={{ inverse: true }}
              onPress={async () => { await update($, openPanel, current => current === pill.panel ? null : pill.panel) }}>
              <Text tabular color={pill.color}>{`\u25cf ${pill.label} ${pill.value}`}</Text>
            </Button>
          ) : <Text tabular>{`${pill.label} ${pill.value}`}</Text>}
        </Box>
      ))
      // SVGs size the row and its spacers in pixels; Boxes only align the controls.
      return (
        <Box key="usage-bars" flexDirection="column" paddingX={1}>
          <Box alignSelf="flex-start" flexShrink={0}>
            <Svg source={band.source} alt={band.alt} width={band.width} height={band.height} />
            {!hover ? null : (
              <Box key="usage-week-hover" position="absolute" top={0} left={0} flexDirection="row">
                <Svg source={spacerSvg(hover.left)} alt="" width={hover.left} height={1} />
                <Box flexDirection="column">
                  <Svg source={spacerSvg(hover.width, hover.height)} alt="" width={hover.width} height={hover.height} />
                  <Box display="none" hover={{ display: 'flex' }}>
                    <Svg source={detail.source} alt={detail.alt} width={detail.width} height={detail.height} />
                  </Box>
                </Box>
              </Box>
            )}
          </Box>
          {!band.layout.system ? null : (
            <Box flexDirection="row" alignItems="center" alignSelf="flex-start" flexShrink={0}>
              {pills}
            </Box>
          )}
          {/* TEMP DEBUG: remove once the pills are confirmed */}
          <Text size="caption">{`debug v4 cols=${e.viewport?.columns} sys=${sys === null ? 'null' : 'ok'} layoutSystem=${band.layout.system} below=${band.layout.pillsBelow} panels=${band.layout.panels.length} pills=${pills.length}`}</Text>
          {!opened ? null : (
            <Box key="usage-drawer" flexDirection="column" alignSelf="flex-start">
              <Svg source={opened.source} alt={opened.alt} width={opened.width} height={opened.height} />
              <Box position="absolute" bottom={0} left={0} width="100%" flexDirection="row" justifyContent="flex-end" paddingX={1}>
                <Button key="usage-close" plain onPress={async () => { await update($, openPanel, () => null) }}>Close</Button>
              </Box>
            </Box>
          )}
        </Box>
      )
    }

    const dollars = spent === null ? '' : usd(spent.week)
    const layout = terminalLayout(e.viewport?.columns, dollars.length)
    if (!layout.panels.length) return next(e)

    const { Box, Text } = $.ui.resolve(e)

    const drawCells = (cells: Cell[]) =>
      cells
        .filter(c => c.width > 0)
        .map((c, i) => (
          <Box key={String(i)} flexShrink={0}>
            <Text wrap="truncate" color={c.color} dimColor={c.dim}>
              {c.glyph.repeat(c.width)}
            </Text>
          </Box>
        ))

    const panel = (label: string, cells: Cell[] | null, value: number | null, last = false) => (
      <Box key={label} flexShrink={0} marginRight={last ? 0 : layout.gap}>
        <Box flexShrink={0}>
          <Text wrap="truncate" dimColor>{label} </Text>
        </Box>
        {layout.bars ? (
          cells ? drawCells(cells) : (
            <Box flexShrink={0}>
              <Text wrap="truncate" dimColor>{'\u2501'.repeat(layout.bar)}</Text>
            </Box>
          )
        ) : null}
        <Box flexShrink={0}>
          <Text wrap="truncate" dimColor>{`${layout.bars ? ' ' : ''}${value === null ? '\u2013' : `${Math.round(value)}%`}`}</Text>
        </Box>
      </Box>
    )

    return (
      <Box flexShrink={0}>
        {layout.panels.map((kind, i) => {
          const long = { day: 'Day', week: 'Week', ctx: 'Ctx' }[kind]
          const label = layout.labels === 'long' ? long : long[0]!
          const reading = kind === 'day' ? day : week
          const value = kind === 'ctx' ? (segs.length ? pct : null) : reading?.percentUsed ?? null
          const cells = !layout.bars ? null : kind === 'ctx'
            ? (segs.length ? contextCells(segs, layout.bar).cells : null)
            : (reading ? limitCells(reading.percentUsed, layout.bar) : null)
          return panel(label, cells, value, i === layout.panels.length - 1)
        })}
        {!layout.spend || !dollars ? null : (
          <Box flexShrink={0}>
            <Text wrap="truncate" dimColor>{`${' '.repeat(layout.gap)}${dollars}`}</Text>
          </Box>
        )}
        {!layout.system || sys === null ? null : (
          <Box flexShrink={0}>
            <Text wrap="truncate" dimColor>
              {[
                sys.cpu === null ? '' : `CPU ${Math.round(sys.cpu)}%`,
                sys.memory === null ? '' : `Mem ${Math.round(sys.memory)}%`,
                sys.disk === null ? '' : `Disk ${Math.round(sys.disk.percent)}%`
              ]
                .filter(Boolean)
                .map(t => `   ${t}`)
                .join('')}
            </Text>
          </Box>
        )}
      </Box>
    )
  })
}
