import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { Limit, Segment, Spend, System } from '../types'
import { bandInset, bandParts, bandSvg, contextCells, detailSvg, drawer, limitCells, machinesSvg, terminalLayout, usd, weekHover } from './bars'
import type { Cell, Panel } from './bars'
import { parseLedger, record, totals } from './ledger'
import type { Ledger } from './ledger'
import { parseCpu, parseDisk, parseMemory } from './system'
import { cleanupActions, initialView } from './actions'
import { drawerView } from './drawer'
import { gaugeFor } from './gauge'
import { askOverSsh, CARD_DIR, parseConfig, readCards, roster, STALE_MS } from './machines'
import type { Card, MachinesConfig } from './machines'
import type { MachineRow } from '../types'

const segments = atom({ plugin: 'usage-bars', key: 'segments' } as const, [] as Segment[])
const window_ = atom({ plugin: 'usage-bars', key: 'window' } as const, 0)
const contextPercent = atom({ plugin: 'usage-bars', key: 'contextPercent' } as const, null as number | null)
const limits = atom({ plugin: 'usage-bars', key: 'limits' } as const, [] as Limit[])
const spend = atom({ plugin: 'usage-bars', key: 'spend' } as const, null as Spend | null)
const system = atom({ plugin: 'usage-bars', key: 'system' } as const, null as System | null)
const openPanel = atom({ plugin: 'usage-bars', key: 'panel' } as const, null as Panel | null)
const weekOpen = atom({ plugin: 'usage-bars', key: 'weekOpen' } as const, false)
const machines = atom({ plugin: 'usage-bars', key: 'machines' } as const, [] as MachineRow[])
const machinesOpen = atom({ plugin: 'usage-bars', key: 'machinesOpen' } as const, false)

const cleanupView = atom({ plugin: 'usage-bars', key: 'cleanupView' } as const, initialView())

const SYSTEM_MS = 10_000
const SSH_MS = 30_000

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
    const s = {
      cpu: parseCpu(ps, cores),
      cores,
      memory: parseMemory(pressure),
      memoryGb: memoryBytes ? memoryBytes / 1e9 : null,
      disk: parseDisk(df),
      battery: null
    }
    await update($, system, () => s)
    await shareLoad($, s)
  } finally {
    polling = false
  }
}

// Each machine's own settings, kept beside the mod and out of git: its short name, the synced folder its
// card goes to, the folder other machines' cards arrive in, and the machines to ask over ssh.
const CONFIG = 'machines.local.json'
let config: MachinesConfig | null = null
const asked = new Map<string, Card>()
let asking = false

/** Posts this machine's card, then gathers every machine's latest one into the All row. */
async function shareLoad($: any, s: { cpu: number | null; memory: number | null; disk: { percent: number; freeGb: number } | null }) {
  config = parseConfig(await $.fs.read(`${$.plugin.root}/${CONFIG}`).catch(() => undefined))
  const cfg = config
  if (!cfg) return update($, machines, () => [])
  const mine: Card = { name: cfg.name, at: await $.clock.now(), cpu: s.cpu, memory: s.memory, disk: s.disk }
  if (cfg.outbox) await $.fs.write(`${cfg.outbox}/${CARD_DIR}/${cfg.name}.json`, JSON.stringify(mine)).catch(() => {})
  const posted = cfg.inbox ? await readCards({ list: p => $.fs.list(p), read: p => $.fs.read(p) }, cfg.inbox) : []
  const cards = [mine, ...posted.filter(c => c.name !== cfg.name), ...asked.values()]
  await update($, machines, () => roster(cfg, cards).map(r => ({
    name: r.name, cpu: r.card?.cpu ?? null, memory: r.card?.memory ?? null, disk: r.card?.disk?.percent ?? null, at: r.card?.at ?? null
  })))
}

/** Asks the machines that post no card (the PC, an idle Mini) over ssh; a machine that does not answer keeps its last card until it goes stale. */
async function askMachines($: any) {
  if (asking || !config) return
  asking = true
  try {
    const cfg = config
    await Promise.all(cfg.ssh.filter(m => m.name !== cfg.name).map(async m => {
      const c = await askOverSsh((argv, init) => $.process.run(argv, init), m.name, m.host, () => $.clock.now())
      if (c) asked.set(m.name, c)
    }))
  } finally {
    asking = false
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

let actions: ReturnType<typeof cleanupActions> | null = null
const controls = ($: any) => actions ??= cleanupActions({
  run: (argv, init) => $.process.run(argv, init), fs: { stat: (path, options) => $.fs.stat(path, options), list: path => $.fs.list(path) },
  home: () => $.env.get('HOME'), tmp: () => $.env.get('TMPDIR'),
  cwd: () => $.session.cwd(), now: () => $.clock.now(),
  after: (ms, fn) => $.clock.after(ms, fn),
  // Local only (.debug is git-ignored): the last failure's real reason, for tracing.
  log: async reason => { await $.fs.write(`${$.plugin.root}/.debug/last-error.txt`, `${new Date(await $.clock.now()).toISOString()}\n${reason}\n`) }
}, view => update($, cleanupView, () => view).then(() => {}))
const closeDrawer = async ($: any) => {
  await update($, openPanel, () => null)
  await controls($).close()
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await refresh($).catch(() => {})
    void pollSystem($).catch(() => {})
    $.clock.every(SYSTEM_MS, () => void pollSystem($).catch(() => {}))
    $.clock.every(SSH_MS, () => void askMachines($).catch(() => {}))
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
      const rows = await read($, machines)
      const rings = rows.map(r => {
        const load = [r.cpu, r.memory].filter((n): n is number => n !== null)
        return { name: r.name, load: load.length ? Math.max(...load) : null, off: r.at === null || now - r.at > STALE_MS }
      })
      const band = bandSvg({ ...input, machines: rings }, e.viewport?.columns)
      if (!band.width) return next(e)
      const { scale } = band.layout
      const hover = weekHover(band.layout)
      const detail = detailSvg(input, scale, band.width)
      const weekShown = await read($, weekOpen)
      const opened = drawer(await read($, openPanel), sys, scale, band.width)
      const allShown = await read($, machinesOpen)
      const press = async (panel: Panel | 'week' | 'machines') => {
        if (panel === 'week') return update($, weekOpen, open => !open)
        if (panel === 'machines') {
          if (!allShown && await read($, openPanel)) await closeDrawer($)
          return update($, machinesOpen, open => !open)
        }
        await update($, machinesOpen, () => false)
        if (await read($, openPanel) === panel) return closeDrawer($)
        await update($, openPanel, () => panel)
        await controls($).open(panel)
      }
      // The band picture cut into windows, with each pressable label a native button in the row between them.
      const row = bandParts(band, sys).map((part, i) => part.kind === 'picture'
        ? <Svg key={`usage-band-${i}`} source={part.source} alt={part.alt} width={part.width} height={part.height} />
        : (
          <Button key={part.key} plain onPress={async () => { await press(part.panel) }}>
            <Text size="footnote" dimColor tabular>{part.label}</Text>
          </Button>
        ))
      // SVGs size the row and its spacers in pixels; Boxes only align the controls.
      return (
        <Box key="usage-bars" flexDirection="column" alignItems="center">
          <Box flexDirection="row" alignItems="center" flexShrink={0}>
            {row}
          </Box>
          {!weekShown || !hover ? null : (
            <Box key="usage-week-detail">
              <Svg source={detail.source} alt={detail.alt} width={detail.width} height={detail.height} />
            </Box>
          )}
          {!allShown || !band.layout.machines ? null : (() => {
            const all = machinesSvg(rows, now, scale, band.width - 2 * bandInset(band.layout), STALE_MS)
            return (
              <Box key="usage-machines-detail">
                <Svg source={all.source} alt={all.alt} width={all.width} height={all.height} />
              </Box>
            )
          })()}
          {!opened ? null : drawerView({ Box, Text, Button, Svg }, gaugeFor((await read($, openPanel))!, sys!), await read($, cleanupView) ?? initialView(), controls($), () => closeDrawer($), band.width - 2 * bandInset(band.layout))}
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
