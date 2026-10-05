import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { Limit, Segment, Spend, System } from '../types'
import { bandSvg, BAND_H, contextCells, detailSvg, limitCells, usd } from './bars'
import type { Cell } from './bars'
import { parseLedger, record, totals } from './ledger'
import type { Ledger } from './ledger'
import { parseCpu, parseDisk, parseMemory } from './system'

const segments = atom({ plugin: 'usage-bars', key: 'segments' } as const, [] as Segment[])
const window_ = atom({ plugin: 'usage-bars', key: 'window' } as const, 0)
const contextPercent = atom({ plugin: 'usage-bars', key: 'contextPercent' } as const, null as number | null)
const limits = atom({ plugin: 'usage-bars', key: 'limits' } as const, [] as Limit[])
const spend = atom({ plugin: 'usage-bars', key: 'spend' } as const, null as Spend | null)
const system = atom({ plugin: 'usage-bars', key: 'system' } as const, null as System | null)

const BAR = 10 // terminal bar cells
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
      const { Box, Svg } = $.ui.resolve(e)
      const input = { day, week, segments: segs, contextPercent: pct, spend: spent, system: sys, now }
      const band = bandSvg(input)
      const detail = detailSvg(input)
      return (
        <Box key="usage-bars" flexDirection="column" paddingX={1}>
          <Svg source={band.source} alt={band.alt} width={band.width} height={BAND_H} />
          <Box display="none" hover={{ display: 'flex' }}>
            <Svg source={detail.source} alt={detail.alt} width={detail.width} height={detail.height} />
          </Box>
        </Box>
      )
    }

    const { Box, Text } = $.ui.resolve(e)

    const drawCells = (cells: Cell[]) =>
      cells
        .filter(c => c.width > 0)
        .map((c, i) => (
          <Text key={String(i)} color={c.color} dimColor={c.dim}>
            {c.glyph.repeat(c.width)}
          </Text>
        ))

    const panel = (label: string, cells: Cell[] | null, value: number | null, last = false) => (
      <Box marginRight={last ? 0 : 3}>
        <Text dimColor>{label} </Text>
        {cells ? drawCells(cells) : <Text dimColor>{'━'.repeat(BAR)}</Text>}
        <Text dimColor>{value === null ? ' –' : ` ${Math.round(value)}%`}</Text>
      </Box>
    )

    return (
      <Box>
        {panel('Day', day ? limitCells(day.percentUsed, BAR) : null, day?.percentUsed ?? null)}
        {panel('Week', week ? limitCells(week.percentUsed, BAR) : null, week?.percentUsed ?? null)}
        {panel('Ctx', segs.length ? contextCells(segs, BAR).cells : null, segs.length ? pct : null, true)}
        {spent === null ? null : <Text dimColor>{`   ${usd(spent.week)}`}</Text>}
        {sys === null ? null : (
          <Text dimColor>
            {[
              sys.cpu === null ? '' : `CPU ${Math.round(sys.cpu)}%`,
              sys.memory === null ? '' : `Mem ${Math.round(sys.memory)}%`,
              sys.disk === null ? '' : `Disk ${Math.round(sys.disk.percent)}%`
            ]
              .filter(Boolean)
              .map(t => `   ${t}`)
              .join('')}
          </Text>
        )}
      </Box>
    )
  })
}
