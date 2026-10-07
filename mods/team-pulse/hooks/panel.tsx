// The team panel: one row per person. Desktop draws bars and the strip as SVG; the terminal uses characters.

import type { Snapshot } from '../types'
import { avatarSvg } from './avatar'
import { bubbleSvg, ROW_SVG_H, ROW_SVG_W, rowSvg, STRIP_SVG_H, STRIP_SVG_W, stripSvg, textBar, textStrip } from './draw'
import type { Row } from './rows'
import { ago, otherLine, withYouLine } from './rows'
import { cap } from './share'
import { inbox, latestWin, wavers, wavesTo } from './signals'
import { strip } from './strip'

const BUBBLE = '#34332e'
const BUBBLE_TEXT = '#ecebe6'
const DOT = { live: '#8CC9A1', idle: '#D6BA7B', offline: '#7B776C' } as const
const QUIET = '#AAA69A'

export function drawPanel(
  ui: any,
  surface: string,
  v: { rows: Row[]; snapshot: Snapshot | null; problem: string | null; expanded: string[]; fetchedAgoMs: number; joined: boolean; signalsHidden?: boolean; onExpand: (memberId: string) => void }
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
  const handoffs = inbox(snap, snap.you, now)
  const win = v.signalsHidden ? null : latestWin(snap, now)
  const waved = v.signalsHidden ? new Set<string>() : wavers(snap, now)
  const received = new Set(v.signalsHidden ? [] : wavesTo({ ...snap, now }, snap.you).map(s => s.from))
  const nameOf = (id: string) => snap.members.find(m => m.id === id)?.name ?? 'Teammate'

  return (
    <Box flexDirection="column">
      <Box flexDirection="column" paddingX={2} paddingY={1}>
        <Text bold>{snap.team}</Text>
        <Text dimColor color={QUIET} wrap="truncate">{withYouLine(v.rows)}</Text>
      </Box>
      {handoffs.slice(0, 2).map(handoff => (
        <Box key={`handoff:${handoff.id}`} flexDirection="column" marginX={2} marginBottom={1} paddingX={1} borderStyle="round" borderColor={BUBBLE} backgroundColor="#292824">
          <Text dimColor color={QUIET} wrap="truncate">{`FOR YOU \u00b7 FROM ${nameOf(handoff.from).toUpperCase()} \u00b7 ${ago(Math.max(0, now - handoff.at))} ago`}</Text>
          <Box height={5} overflow="hidden">
            <Text wrap="wrap">{handoff.text}</Text>
          </Box>
          <Box gap={1}>
            <Button key={`take:${handoff.id}`} onPress={() => {}} label="Take" />
            <Button key={`dismiss:${handoff.id}`} plain onPress={() => {}} label="Dismiss" />
          </Box>
        </Box>
      ))}
      {handoffs.length > 2 ? <Box paddingX={2}><Text dimColor color={QUIET}>{`+${handoffs.length - 2} more`}</Text></Box> : null}
      {win ? (
        <Box paddingX={2} marginBottom={1} gap={1}>
          <Box flexShrink={0}><Text dimColor color={QUIET}>WIN</Text></Box>
          <Box flexGrow={1} flexShrink={1} minWidth={0}>
            <Text wrap="truncate">{`${nameOf(win.win.from)}: ${win.win.text}`}</Text>
          </Box>
          {win.others ? <Box flexShrink={0}><Text dimColor color={QUIET}>{`+${win.others}`}</Text></Box> : null}
        </Box>
      ) : null}
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
                    <Svg {...avatarSvg(r.id, 30, r.status, waved.has(r.id))} width={30} height={30} />
                  </Box>
                  <Text bold>{r.name}</Text>
                  {received.has(r.id) ? <Text dimColor color={QUIET}>{' waved at you'}</Text> : null}
                </Box>
              ) : (
                <Text>
                  <Text color={DOT[r.status]}>{'\u25cf '}</Text>
                  <Text bold>{r.name}</Text>
                  {waved.has(r.id) ? <Text dimColor color={QUIET}>{' \u270b'}</Text> : null}
                  {received.has(r.id) ? <Text dimColor color={QUIET}>{' waved at you'}</Text> : null}
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
            <Box alignItems="center" marginTop={1} gap={surface === 'desktop' && Svg ? 1 : 0}>
              <Box flexShrink={1} minWidth={0}>
                {surface === 'desktop' && Svg ? (
                  <Svg {...stripSvg(st.pieces)} width={STRIP_SVG_W} height={STRIP_SVG_H} />
                ) : (
                  <Text dimColor color={QUIET}>{`12h ${textStrip(st.pieces, 20)} `}</Text>
                )}
              </Box>
              <Box flexShrink={0}>
                <Button key={`expand:${r.id}`} plain onPress={() => v.onExpand(r.id)} label={open ? 'Less' : 'More'} />
              </Box>
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
