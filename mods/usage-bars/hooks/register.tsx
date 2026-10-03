import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { Limit, Segment } from '../types'
import { bandSvg, BAND_H, BAND_W, contextCells, detailSvg, limitCells } from './bars'
import type { Cell } from './bars'

const segments = atom({ plugin: 'usage-bars', key: 'segments' } as const, [] as Segment[])
const window_ = atom({ plugin: 'usage-bars', key: 'window' } as const, 0)
const contextPercent = atom({ plugin: 'usage-bars', key: 'contextPercent' } as const, null as number | null)
const limits = atom({ plugin: 'usage-bars', key: 'limits' } as const, [] as Limit[])

const BAR = 10 // terminal bar cells

async function refresh($: any) {
  const u = await $.session.usage({ breakdown: 'summary' })
  await update($, segments, () => (u.context.breakdown?.categories ?? []).map((c: any) => ({ name: c.name, tokens: c.tokens, kind: c.kind })))
  await update($, window_, () => u.context.breakdown?.rawMaxTokens ?? u.context.window)
  await update($, contextPercent, () => u.context.breakdown?.percentage ?? u.context.percent ?? null)
  await update($, limits, () => u.rateLimits)
  return u
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

    const now = await $.clock.now()
    const lims = await read($, limits)
    const segs = await read($, segments)
    const pct = await read($, contextPercent)

    const day = lims.find(l => l.kind === 'five_hour')
    const week = lims.find(l => l.kind === 'seven_day')

    if (e.surface === 'desktop') {
      const { Box, Svg } = $.ui.resolve(e)
      const input = { day, week, segments: segs, contextPercent: pct, now }
      const band = bandSvg(input)
      const detail = detailSvg(input)
      return (
        <Box key="usage-bars" flexDirection="column" paddingX={1}>
          <Svg source={band.source} alt={band.alt} width={BAND_W} height={BAND_H} />
          <Box display="none" hover={{ display: 'flex' }}>
            <Svg source={detail.source} alt={detail.alt} width={detail.width} height={BAND_H} />
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
      </Box>
    )
  })
}
