// The team panel: one row per person. Desktop draws bars and the strip as SVG; the terminal uses characters.

import type { Snapshot } from '../types'
import { bubbleSvg, ROW_SVG_H, ROW_SVG_W, rowSvg, textBar } from './draw'
import type { Row } from './rows'
import { ago } from './rows'
import { cap } from './share'
import { strip } from './strip'

const BUBBLE = '#34332e'
const BUBBLE_TEXT = '#ecebe6'
const DOT = { live: '#4cc38a', idle: '#e0a84a', offline: '#5f5e58' } as const

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
  const live = v.rows.filter(r => r.status === 'live').length
  const now = snap.now + v.fetchedAgoMs

  return (
    <Box flexDirection="column">
      <Box paddingX={2} paddingY={1} justifyContent="space-between">
        <Text bold>{snap.team}</Text>
        <Text dimColor>{`${live} live \u00b7 ${v.rows.length}`}</Text>
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
              <Text>
                <Text color={DOT[r.status]}>{'\u25cf '}</Text>
                <Text bold>{r.name}</Text>
              </Text>
              <Text dimColor>{r.statusText}</Text>
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
            {r.main ? <Text dimColor wrap="truncate">{r.main.where}</Text> : null}
            {surface === 'desktop' && Svg ? (
              <Box marginTop={1}>
                <Svg {...rowSvg({ fiveHour: r.fiveHour, week: r.week, pieces: st.pieces, hours: st.hours, name: r.name })} width={ROW_SVG_W} height={ROW_SVG_H} />
              </Box>
            ) : (
              <Text dimColor>{`5h ${textBar(r.fiveHour, 8)} ${r.fiveHour ?? '\u2013'}%  Week ${textBar(r.week, 8)} ${r.week ?? '\u2013'}%  12h ${st.hours.toFixed(1)}h`}</Text>
            )}
            {r.others.length ? (
              <Button key={`expand:${r.id}`} plain onPress={() => v.onExpand(r.id)} label={open ? 'Hide other sessions' : `+${r.others.length} more session${r.others.length === 1 ? '' : 's'}`} />
            ) : null}
            {open ? r.others.map(o => <Text key={`s:${o.id}`} dimColor wrap="truncate">{`${o.line} \u00b7 ${o.where}`}</Text>) : null}
          </Box>
        )
      })}
    </Box>
  )
}
