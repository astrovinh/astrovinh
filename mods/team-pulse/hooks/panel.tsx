// The team panel: one row per person. Desktop draws bars and the strip as SVG; the terminal uses characters.

import type { Snapshot } from '../types'
import { avatarSvg } from './avatar'
import { bubbleSvg, ROW_SVG_H, ROW_SVG_W, rowSvg, STRIP_SVG_H, STRIP_SVG_W, stripSvg, textBar, textStrip } from './draw'
import type { Row } from './rows'
import { ago, otherLine, withYouLine } from './rows'
import { cap } from './share'
import { strip } from './strip'

const BUBBLE = '#34332e'
const BUBBLE_TEXT = '#ecebe6'
const DOT = { live: '#8CC9A1', idle: '#D6BA7B', offline: '#7B776C' } as const
const QUIET = '#AAA69A'

export function drawPanel(
  ui: any,
  surface: string,
  v: { rows: Row[]; snapshot: Snapshot | null; problem: string | null; expanded: string[]; fetchedAgoMs: number; joined: boolean; onExpand: (memberId: string) => void }
) {
  const { Box, Text, Svg, Button } = ui

  if (!v.joined) {
    return (
      <Box flexDirection="column" paddingX={2} paddingY={1}>
        <Text>Create a team with /team create &lt;team&gt; &lt;your name&gt;, or join one with /team join &lt;code&gt; &lt;your name&gt;.</Text>
      </Box>
    )
  }
  if (!v.snapshot) {
    return (
      <Box paddingX={2} paddingY={1}>
        <Text dimColor>{v.problem ?? 'Loading the team\u2026'}</Text>
      </Box>
    )
  }

  const snap = v.snapshot
  const now = snap.now + v.fetchedAgoMs

  return (
    <Box flexDirection="column">
      <Box flexDirection="column" paddingX={2} paddingY={1}>
        <Text bold>{snap.team}</Text>
        <Text dimColor color={QUIET} wrap="truncate">{withYouLine(v.rows)}</Text>
      </Box>
      {v.problem ? (
        <Box paddingX={2}>
          <Text dimColor>{`${v.problem} \u00b7 last update ${ago(v.fetchedAgoMs)} ago`}</Text>
        </Box>
      ) : null}
      {v.rows.map(r => {
        const st = strip(snap.segments.filter(s => s.member === r.id), now)
        const open = v.expanded.includes(r.id)
        return (
          <Box key={`row:${r.id}`} flexDirection="column" paddingX={2} paddingY={1}>
            <Box justifyContent="space-between">
              {surface === 'desktop' && Svg ? (
                <Box alignItems="center">
                  <Box marginRight={1}>
                    <Svg {...avatarSvg(r.id, 30, r.status)} width={30} height={30} />
                  </Box>
                  <Text bold>{r.name}</Text>
                </Box>
              ) : (
                <Text>
                  <Text color={DOT[r.status]}>{'\u25cf '}</Text>
                  <Text bold>{r.name}</Text>
                </Text>
              )}
              <Text dimColor color={QUIET}>{r.clock ?? r.statusText}</Text>
            </Box>
            {r.note && surface === 'desktop' && Svg ? (
              <Box marginBottom={1}>
                <Svg {...bubbleSvg(r.note, r.noteAge, 290)} />
              </Box>
            ) : r.note ? (
              <Box marginBottom={1}>
                <Box flexShrink={0}>
                  <Text color={BUBBLE}>{'\u25e4'}</Text>
                </Box>
                <Text wrap="truncate" color={BUBBLE_TEXT} backgroundColor={BUBBLE}>
                  {` ${cap(r.note, 40)} `}
                  {r.noteAge ? <Text dimColor>{` \u00b7 ${r.noteAge} `}</Text> : null}
                </Text>
              </Box>
            ) : null}
            {r.main ? (
              r.main.line ? <Text wrap="truncate">{r.main.line}</Text> : <Text dimColor>Working in Claude Code</Text>
            ) : (
              <Text dimColor>Not running Claude Code</Text>
            )}
            <Box alignItems="center" marginTop={1}>
              {surface === 'desktop' && Svg ? (
                <Svg {...stripSvg(st.pieces)} width={STRIP_SVG_W} height={STRIP_SVG_H} />
              ) : (
                <Text dimColor color={QUIET}>{`12h ${textStrip(st.pieces, 20)} `}</Text>
              )}
              <Button key={`expand:${r.id}`} plain onPress={() => v.onExpand(r.id)} label={open ? 'Less' : 'More'} />
            </Box>
            {open ? (
              <Box flexDirection="column">
                {r.main ? <Text dimColor color={QUIET} wrap="truncate">{`${r.main.where}${r.others.length ? ` \u00b7 ${r.others.length + 1} sessions` : ''}`}</Text> : null}
                {surface === 'desktop' && Svg ? (
                  <Svg {...rowSvg({ fiveHour: r.fiveHour, week: r.week, name: r.name })} width={ROW_SVG_W} height={ROW_SVG_H} />
                ) : (
                  <Text dimColor color={QUIET}>{`5h ${textBar(r.fiveHour, 8)} ${r.fiveHour ?? '\u2013'}%  Week ${textBar(r.week, 8)} ${r.week ?? '\u2013'}%`}</Text>
                )}
                <Text dimColor color={QUIET}>{`Claude activity ${st.hours.toFixed(1)}h in the last 12 hours`}</Text>
                {r.others.map(o => <Text key={`s:${o.id}`} dimColor color={QUIET} wrap="truncate">{otherLine(o)}</Text>)}
              </Box>
            ) : null}
          </Box>
        )
      })}
    </Box>
  )
}
