import type { AgentRow, RosterView } from '../types'
import { animalSvg } from './animals'
import { elapsed, finished } from './roster'
import { STATE_LABEL } from './roster-labels'
import { needsYou, summary as sessionSummary } from './sessions'
import { DEFAULT_SETTINGS, SIZE_PX } from './settings'

const COLOR = { session: '#242422', line: '#34332f', ink: '#f0efe9', second: '#c3c0b7', quiet: '#aaa69a', waiting: '#d6ba7b' }
const DOT = { running: '#8cc9a1', waiting: '#d6ba7b', completed: '#94b7e8', failed: '#f2a3b2', idle: '#7b776c', pending: '#7b776c', killed: '#7b776c' }
// Keep the SVG source stable on clock/count redraws so its native animation can continue.
const pictures = new Map<string, { key: string; art: { source: string; alt: string } }>()

export function pictureCount() { return pictures.size }

export function meterWidth(columns?: number, animalSize = 36): number {
  return columns === undefined ? 200 : Math.max(120, Math.min(320, columns * 7 - animalSize - 40))
}

function picture(row: AgentRow, session: string, still: boolean, size: number) {
  const id = `${session}:${row.id}`
  const key = `${row.animal}:${row.state}:${row.tool}:${still}:${size}`
  let entry = pictures.get(id)
  if (entry?.key !== key) {
    entry = { key, art: animalSvg(row.animal, row.state, row.tool, size / 12, { still }) }
    pictures.set(id, entry)
  }
  return entry!.art
}

export function bar(row: AgentRow, still = false) {
  let content = ''
  if (row.todo) {
    content = `<rect width="${100 * row.todo.done / row.todo.total}" height="3" rx="1.5" fill="${DOT[row.state]}"/>`
  } else if (row.state === 'running') {
    if (!still) content = `<rect width="34" height="3" rx="1.5" fill="${DOT[row.state]}"><animate attributeName="x" values="0;66;0" dur="2s" repeatCount="indefinite"/></rect>`
  } else if (finished(row.state)) {
    content = `<rect width="100" height="3" rx="1.5" fill="${DOT[row.state]}"/>`
  } else {
    content = Array.from({ length: 8 }, (_, i) => `<path d="M${i * 13} 1.5h8" stroke="${DOT[row.state]}"/>`).join('')
  }
  return { source: `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="3" viewBox="0 0 100 3" preserveAspectRatio="none"><rect width="100" height="3" rx="1.5" fill="#33322e"/>${content}</svg>`, alt: row.todo ? `${row.todo.done} of ${row.todo.total} steps` : 'Progress unavailable' }
}

export function drawPanel(ui: any, surface: string, view: RosterView, columns?: number) {
  const sessions = view.sessions ?? [{ id: '', label: view.session, at: view.now, agents: view.rows, counts: { total: view.total, working: view.working, blocked: view.blocked, overflow: view.overflow } }]
  const totals = sessionSummary(sessions)
  const ids = new Set(sessions.flatMap(s => s.agents.map(row => `${s.id}:${row.id}`)))
  for (const id of pictures.keys()) if (!ids.has(id)) pictures.delete(id)
  const { Box, Text, Svg, Button } = ui
  const { motion, size } = view.settings ?? DEFAULT_SETTINGS
  const still = !motion
  const animalSize = SIZE_PX[size]
  const miniSize = animalSize * 2 / 3
  const animation = motion ? { isInteractive: true } : {}
  const dividerWidth = meterWidth(columns, animalSize) + animalSize + 8
  const summary = <Text color={COLOR.second}>{`${totals.total} ${totals.total === 1 ? 'agent' : 'agents'}, ${totals.working} working`}{totals.blocked ? <Text color={COLOR.waiting}>{` \u00b7 ${totals.blocked} ${needsYou(totals.blocked)}`}</Text> : null}</Text>
  // Both local and expanded foreign sessions use this exact streamlined row renderer.
  const drawRows = (rows: AgentRow[], overflow: number, sessionId: string) => (
    <Box key={`session:${sessionId}`} flexDirection="column">
      {rows.map((row, index) => {
        const time = elapsed((row.endedAt ?? view.now) - row.startedAt)
        if (surface !== 'desktop') return (
          <Box key={row.id} flexDirection="column">
            <Text dimColor={finished(row.state)} color={row.state === 'waiting' ? COLOR.waiting : undefined}>{`${row.name} (${row.role})  ${STATE_LABEL[row.state]}  ${row.line}  ${row.tools} tools  ${time}`}</Text>
            {row.note ? <Text dimColor>{row.note}</Text> : null}
          </Box>
        )
        const art = picture(row, sessionId, still, animalSize)
        const metadata = [row.todo ? `${row.todo.done}/${row.todo.total}` : row.tools ? `${row.tools} ${row.tools === 1 ? 'tool' : 'tools'}` : '', time].filter(Boolean).join(' \u00b7 ')
        return (
          <Box key={row.id} flexDirection="column">
            {index > 0 ? <Svg source={`<svg xmlns="http://www.w3.org/2000/svg" width="100" height="1" viewBox="0 0 100 1" preserveAspectRatio="none"><rect width="100" height="1" fill="${COLOR.line}"/></svg>`} alt="" width={dividerWidth} height={1} /> : null}
            <Box paddingX={2} paddingY={0} gap={1} alignItems="center" {...(row.state === 'waiting' ? { backgroundColor: '#2a2822' } : {})}>
              <Box flexShrink={0}><Svg {...animation} {...art} alt={`${art.alt}, ${row.role}`} width={animalSize} height={animalSize} /></Box>
              <Box flexDirection="column" flexGrow={1} minWidth={0}>
                <Box justifyContent="space-between" gap={1}>
                  <Box flexGrow={1} minWidth={0}><Text bold color={COLOR.ink} wrap="truncate">{row.name}</Text></Box>
                  <Box flexShrink={0}><Text color={DOT[row.state]}>{STATE_LABEL[row.state]}{metadata ? <Text color={COLOR.quiet}>{` \u00b7 ${metadata}`}</Text> : null}</Text></Box>
                </Box>
                <Text color={COLOR.second} wrap="truncate">{row.line}</Text>
                {row.note ? <Text dimColor color={COLOR.quiet} wrap="truncate">{row.note}</Text> : null}
                <Svg {...animation} {...bar(row, still)} width={meterWidth(columns, animalSize)} height={3} />
              </Box>
            </Box>
          </Box>
        )
      })}
      {overflow > 0 ? <Box paddingX={2}><Text dimColor>{`+${overflow} more agents`}</Text></Box> : null}
    </Box>
  )
  return (
    <Box flexDirection="column">
      <Box flexDirection="column" paddingX={2} paddingY={1}>
        <Box justifyContent="space-between">{surface === 'desktop' ? summary : <Text bold color={COLOR.ink}>Party</Text>}<Text color={COLOR.quiet}>{`${totals.sessions} ${totals.sessions === 1 ? 'session' : 'sessions'}`}</Text></Box>
        {surface !== 'desktop' ? summary : null}
      </Box>
      {!totals.total ? <Box paddingX={2} paddingY={1}><Text dimColor>No agents yet. They show up here when Claude Code starts one.</Text></Box> : null}
      {sessions.map((s, index) => {
        const counts = sessionSummary([s])
        const open = index === 0 || view.expanded?.includes(s.id)
        const label = `${s.label || 'This session'} \u00b7 ${counts.total} ${counts.total === 1 ? 'agent' : 'agents'}`
        return (
          <Box key={`group:${s.id}`} flexDirection="column">
            {surface !== 'desktop' ? <Box paddingX={2}><Text color={COLOR.second}>{label}</Text></Box> : index > 0 ? (
              <Box key={`header:${s.id}`} paddingX={2} paddingY={1} gap={1} alignItems="center" justifyContent="space-between">
                <Box gap={1} minWidth={0} flexGrow={1}>
                  <Button key={`expand:${s.id}`} plain label={label} onPress={() => {}} />
                  {counts.blocked ? <Text color={COLOR.waiting}>{needsYou(counts.blocked)}</Text> : null}
                </Box>
                <Box gap={0} flexShrink={0}>
                  {open ? <Text color={COLOR.quiet}>hide</Text> : s.agents.map(row => <Svg key={row.id} {...animation} {...picture(row, s.id, still, miniSize)} width={miniSize} height={miniSize} />)}
                </Box>
              </Box>
            ) : null}
            {surface !== 'desktop' || open ? drawRows(s.agents, s.counts?.overflow ?? 0, s.id) : null}
          </Box>
        )
      })}
    </Box>
  )
}
