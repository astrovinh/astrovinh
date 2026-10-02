import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { Limit, Segment } from '../types'
import { contextCells, labelFor, limitCells, untilReset } from './bars'
import type { Cell } from './bars'

const segments = atom({ plugin: 'usage-bars', key: 'segments' } as const, [] as Segment[])
const window_ = atom({ plugin: 'usage-bars', key: 'window' } as const, 0)
const contextPercent = atom({ plugin: 'usage-bars', key: 'contextPercent' } as const, null as number | null)
const limits = atom({ plugin: 'usage-bars', key: 'limits' } as const, [] as Limit[])

const GAP = 2
const LABEL = 5 // "Day  "
const PCT = 5 // " 100%"

async function refresh($: any) {
  const u = await $.session.usage({ breakdown: 'summary' })
  await update($, segments, () => (u.context.breakdown?.categories ?? []).map((c: any) => ({ name: c.name, tokens: c.tokens, kind: c.kind })))
  await update($, window_, () => u.context.breakdown?.rawMaxTokens ?? u.context.window)
  await update($, contextPercent, () => u.context.breakdown?.percentage ?? u.context.percent ?? null)
  await update($, limits, () => u.rateLimits)
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await refresh($).catch(() => {})
    return next(e)
  })

  on('session.measure', async ($, e, next) => {
    await refresh($).catch(() => {})
    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) return next(e)

    const { Box, Text } = $.ui.resolve(e)
    const now = await $.clock.now()
    const lims = await read($, limits)
    const segs = await read($, segments)
    const pct = await read($, contextPercent)

    const day = lims.find(l => l.kind === 'five_hour')
    const week = lims.find(l => l.kind === 'seven_day')
    const others = lims.filter(l => l.kind !== 'five_hour' && l.kind !== 'seven_day')

    const cols = Math.max(30, e.props.bodyColumns)
    const panels = 3
    const panelWidth = Math.floor((cols - GAP * (panels - 1)) / panels)
    const barWidth = Math.max(4, panelWidth - LABEL - PCT)

    const drawCells = (cells: Cell[]) =>
      cells
        .filter(c => c.width > 0)
        .map((c, i) => (
          <Text key={i} color={c.color} dimColor={c.dim}>
            {c.glyph.repeat(c.width)}
          </Text>
        ))

    const limitPanel = (label: string, l: Limit | undefined) => (
      <Box width={panelWidth} marginRight={GAP}>
        <Text bold>{label.padEnd(LABEL)}</Text>
        {l ? drawCells(limitCells(l.percentUsed, barWidth)) : <Text dimColor>{'·'.repeat(barWidth)}</Text>}
        <Text>{l ? ` ${Math.round(l.percentUsed)}%`.padStart(PCT) : ' n/a'.padStart(PCT)}</Text>
      </Box>
    )

    const ctx = contextCells(segs, barWidth)

    const resets = [day && ['Day', day] as const, week && ['Wk', week] as const]
      .filter(Boolean)
      .map(r => `${r![0]} resets ${untilReset(r![1].resetsAt, now)}`)
      .concat(others.map(o => `${labelFor(o.kind)} ${Math.round(o.percentUsed)}%`))

    return (
      <Box flexDirection="column">
        <Box>
          {limitPanel('Day', day)}
          {limitPanel('Week', week)}
          <Box width={panelWidth}>
            <Text bold>{'Ctx'.padEnd(LABEL)}</Text>
            {segs.length ? drawCells(ctx.cells) : <Text dimColor>{'·'.repeat(barWidth)}</Text>}
            <Text>{pct === null ? ' n/a'.padStart(PCT) : ` ${Math.round(pct)}%`.padStart(PCT)}</Text>
          </Box>
        </Box>
        <Box>
          <Text dimColor wrap="truncate">{resets.join(' · ')}{resets.length ? ' · ' : ''}</Text>
          {ctx.legend.map((g, i) => (
            <Text key={i} color={g.color}>■ <Text dimColor>{g.name} </Text></Text>
          ))}
        </Box>
      </Box>
    )
  })
}
