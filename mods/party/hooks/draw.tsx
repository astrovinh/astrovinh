import type { AgentRow, RosterView } from '../types'
import { animalSvg } from './animals'
import { elapsed, finished } from './roster'
import { STATE_LABEL } from './roster-labels'
import { needsYou, summary as sessionSummary } from './sessions'
import { DEFAULT_SETTINGS, SIZE_PX } from './settings'
import { ANIMAL_EMOJI, barCells, rowWidth, terminalMeta, terminalRowLayout } from './terminal'

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
  const key = `${row.animal}:${row.state}:${row.tool}:${still}:${size}:${!!row.codex}`
  let entry = pictures.get(id)
  if (entry?.key !== key) {
    entry = { key, art: animalSvg(row.animal, row.state, row.tool, size / 12, { still, codex: row.codex }) }
    pictures.set(id, entry)
  }
  return entry!.art
}

export function bar(row: AgentRow, still = false) {
  if (!row.todo && (row.state === 'idle' || row.state === 'pending')) return null
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
  const sessions = view.sessions ?? [{ id: '', label: view.session, at: view.now, agents: view.rows, quietSince: view.quietSince, counts: { total: view.total, working: view.working, blocked: view.blocked, overflow: view.overflow, quiet: view.quiet ?? 0 } }]
  const codex = view.codex ?? []
  const codexQuiet = view.codexQuiet ?? 0
  const ready = view.ready ?? 0
  const totals = sessionSummary(sessions)
  totals.total += codex.length
  totals.working += codex.filter(row => row.state === 'running').length
  totals.quiet += codexQuiet
  const ids = new Set(sessions.flatMap(s => s.agents.map(row => `${s.id}:${row.id}`)))
  for (const row of codex) ids.add(`codex:${row.id}`)
  for (const id of pictures.keys()) if (!ids.has(id)) pictures.delete(id)
  const { Box, Text, Svg, Button } = ui
  const { motion, size } = view.settings ?? DEFAULT_SETTINGS
  const still = !motion
  const animalSize = SIZE_PX[size]
  const miniSize = animalSize * 2 / 3
  const animation = motion ? { isInteractive: true } : {}
  const dividerWidth = meterWidth(columns, animalSize) + animalSize + 8
  const terminal = surface !== 'desktop'
  const terminalWidth = columns === undefined ? undefined : Math.max(0, columns - 1)
  const terminalPadding = Math.min(2, Math.floor((terminalWidth ?? 4) / 2))
  const terminalProps = terminal ? { width: terminalWidth, minWidth: 0 } : {}
  const truncate = terminal ? { wrap: 'truncate' } : {}
  const summaryText = !totals.working && !totals.blocked && totals.quiet ? 'Nothing active' : `${totals.working} working`
  const attention = (totals.blocked ? ` \u00b7 ${totals.blocked} ${needsYou(totals.blocked)}` : '') + (ready ? ` \u00b7 ${ready} ready for review` : '')
  const quietText = totals.quiet ? ` \u00b7 ${totals.quiet} quiet` : ''
  const sessionText = `${totals.sessions} ${totals.sessions === 1 ? 'session' : 'sessions'}`
  const showSessions = columns === undefined || summaryText.length + attention.length + quietText.length + 2 + sessionText.length <= columns - 1
  const summary = terminal ? null : <Text color={COLOR.second}>{summaryText}{attention ? <Text color={COLOR.waiting}>{attention}</Text> : null}{quietText}</Text>
  // Both local and expanded foreign sessions use this exact streamlined row renderer.
  const drawRows = (rows: AgentRow[], overflow: number, sessionId: string) => (
    <Box key={`session:${sessionId}`} flexDirection="column">
      {rows.map((row, index) => {
        const time = elapsed((row.endedAt ?? view.now) - row.startedAt)
        if (terminal) {
          const available = terminalWidth ?? 80
          const badgeWidth = row.codex ? Math.min(3, available) : 0
          const indent = row.codex ? Math.min(row.depth ?? 0, Math.max(0, available - badgeWidth)) : 0
          let layout = terminalRowLayout(columns)
          if (row.codex && columns !== undefined && rowWidth(layout, row) + badgeWidth + indent > available) layout = terminalRowLayout(Math.max(1, columns - badgeWidth - indent))
          const contentWidth = Math.max(0, available - badgeWidth - indent)
          const width = rowWidth(layout, row)
          const meta = terminalMeta(layout, row, view.now)
          const metaWidth = width - (2 + 1 + layout.name + (layout.status ? 1 + 7 : 0) + (layout.bar ? 1 + layout.bar : 0) + 1)
          const piece = (key: string, value: any, cells: number, props: any = {}) => (
            <Box key={key} flexShrink={0} width={cells}><Text wrap="truncate" {...props}>{value}</Text></Box>
          )
          const gap = (key: string) => piece(key, ' ', 1)
          return (
            <Box key={row.id} flexDirection="column" {...terminalProps}>
              <Box width={Math.min(width, contentWidth) + badgeWidth + indent} minWidth={0}>
                {indent ? piece('indent', ' '.repeat(indent), indent) : null}
                {layout.tier === 'tiny' ? piece('tiny', [
                  `${ANIMAL_EMOJI[row.animal]} ${row.name.slice(0, layout.name).padEnd(layout.name)} `,
                  <Text key="meta" color={COLOR.quiet} dimColor wrap="truncate">{meta}</Text>
                ], Math.min(width, contentWidth), { color: COLOR.ink }) : [
                  piece('emoji', ANIMAL_EMOJI[row.animal], 2),
                  gap('after-emoji'),
                  piece('name', row.name, layout.name, { color: COLOR.ink }),
                  ...(layout.status ? [gap('before-status'), piece('status', STATE_LABEL[row.state], 7, { color: DOT[row.state], dimColor: finished(row.state) })] : []),
                  gap('before-bar'),
                  piece('bar', barCells(row, layout.bar, view.now).filter(cell => cell.width > 0).map((cell, i) => <Text key={i} wrap="truncate" color={cell.color} dimColor={cell.dim}>{cell.glyph.repeat(cell.width)}</Text>), layout.bar),
                  gap('before-meta'),
                  piece('meta', meta, metaWidth, { color: COLOR.quiet, dimColor: true })
                ]}
                {badgeWidth ? piece('codex-badge', ' >_', badgeWidth, { color: '#8a8ad8' }) : null}
              </Box>
              <Text color={COLOR.quiet} dimColor wrap="truncate">{`${' '.repeat(3 + indent)}${row.line}`}</Text>
              {row.note && (layout.tier === 'wide' || layout.tier === 'medium') ? <Text color={COLOR.quiet} dimColor wrap="truncate">{`   ${row.note}`}</Text> : null}
            </Box>
          )
        }
        const art = picture(row, sessionId, still, animalSize)
        const meter = bar(row, still)
        const metadata = row.codex ? row.meta : [row.todo ? `${row.todo.done}/${row.todo.total}` : row.tools ? `${row.tools} ${row.tools === 1 ? 'tool' : 'tools'}` : '', time].filter(Boolean).join(' \u00b7 ')
        return (
          <Box key={row.id} flexDirection="column">
            {index > 0 ? <Svg source={`<svg xmlns="http://www.w3.org/2000/svg" width="100" height="1" viewBox="0 0 100 1" preserveAspectRatio="none"><rect width="100" height="1" fill="${COLOR.line}"/></svg>`} alt="" width={dividerWidth} height={1} /> : null}
            <Box {...(row.codex && row.depth ? { paddingLeft: 2 + 2 * row.depth, paddingRight: 2 } : { paddingX: 2 })} paddingY={0} gap={1} alignItems="center" {...(row.state === 'waiting' ? { backgroundColor: '#2a2822' } : {})}>
              <Box flexShrink={0}><Svg {...animation} {...art} alt={`${art.alt}, ${row.role}`} width={animalSize} height={animalSize} /></Box>
              <Box flexDirection="column" flexGrow={1} minWidth={0}>
                <Box justifyContent="space-between" gap={1}>
                  <Box flexGrow={1} minWidth={0}><Text bold color={COLOR.ink} wrap="truncate">{row.name}</Text></Box>
                  <Box flexShrink={0}><Text color={DOT[row.state]}>{STATE_LABEL[row.state]}{metadata ? <Text color={COLOR.quiet}>{` \u00b7 ${metadata}`}</Text> : null}</Text></Box>
                </Box>
                <Text color={COLOR.second} wrap="truncate">{row.line}</Text>
                {row.note ? <Text dimColor color={COLOR.quiet} wrap="truncate">{row.note}</Text> : null}
                {meter ? <Svg {...animation} {...meter} width={meterWidth(columns, animalSize)} height={3} /> : null}
              </Box>
            </Box>
          </Box>
        )
      })}
      {overflow > 0 ? <Box paddingX={terminal ? terminalPadding : 2} {...terminalProps}><Text dimColor {...truncate}>{`+${overflow} more agents`}</Text></Box> : null}
    </Box>
  )
  return (
    <Box flexDirection="column" {...terminalProps}>
      {terminal ? <Box {...terminalProps}><Text color={COLOR.second} wrap="truncate">{summaryText}{attention ? <Text color={COLOR.waiting} wrap="truncate">{attention}</Text> : null}{quietText}{showSessions ? <Text color={COLOR.quiet} wrap="truncate">{`  ${sessionText}`}</Text> : null}</Text></Box> : (
        <Box flexDirection="column" paddingX={2} paddingY={1}>
          <Box justifyContent="space-between">{summary}<Text color={COLOR.quiet}>{`${totals.sessions} ${totals.sessions === 1 ? 'session' : 'sessions'}`}</Text></Box>
        </Box>
      )}
      {!totals.total && !totals.quiet ? <Box paddingX={terminal ? terminalPadding : 2} paddingY={1} {...terminalProps}><Text dimColor {...truncate}>No agents yet. They show up here when Claude Code starts one.</Text></Box> : null}
      {sessions.map((s, index) => {
        const counts = sessionSummary([s])
        const open = index === 0 || view.expanded?.includes(s.id)
        const activity = counts.working ? `${counts.working} working` : 'quiet'
        const label = `${s.label || 'This session'} \u00b7 ${activity}`
        return (
          <Box key={`group:${s.id}`} flexDirection="column">
            {index === 0 ? sessions.length > 1 ? (
              surface !== 'desktop' ? <Box paddingX={terminalPadding} {...terminalProps}><Text color={COLOR.quiet} wrap="truncate">{`This session \u00b7 ${activity}`}</Text></Box> : (
                <Box paddingX={2} paddingY={1} gap={1} alignItems="center" justifyContent="space-between">
                  <Text color={COLOR.quiet}>{`This session \u00b7 ${activity}`}</Text>
                </Box>
              )
            ) : null : surface !== 'desktop' ? <Box paddingX={terminalPadding} {...terminalProps}><Text color={COLOR.second} wrap="truncate">{label}</Text></Box> : (
              <Box key={`header:${s.id}`} paddingX={2} paddingY={1} gap={1} alignItems="center" justifyContent="space-between">
                <Box gap={1} minWidth={0} flexGrow={1}>
                  <Button key={`expand:${s.id}`} plain label={label} onPress={() => {}} />
                  {counts.blocked ? <Text color={COLOR.waiting}>{needsYou(counts.blocked)}</Text> : null}
                </Box>
                <Box gap={0} flexShrink={0}>
                  {open ? <Text color={COLOR.quiet}>hide</Text> : s.agents.map(row => {
                    const art = picture(row, s.id, still, miniSize)
                    return <Svg key={row.id} {...animation} {...art} alt={`${art.alt}, ${row.role}`} width={miniSize} height={miniSize} />
                  })}
                </Box>
              </Box>
            )}
            {surface !== 'desktop' || open ? drawRows(s.agents, s.counts?.overflow ?? 0, s.id) : null}
            {counts.quiet > 0 ? <Box paddingX={terminal ? terminalPadding : 2} {...terminalProps}><Text color={COLOR.quiet} dimColor {...truncate}>{`${counts.quiet} quiet${s.quietSince == null ? '' : ` \u00b7 last active ${elapsed(view.now - s.quietSince)} ago`}`}</Text></Box> : null}
          </Box>
        )
      })}
      {codex.length || codexQuiet ? <Box flexDirection="column" {...terminalProps}>
        <Box paddingX={terminal ? terminalPadding : 2} paddingY={terminal ? 0 : 1} {...terminalProps}>
          <Text color={COLOR.quiet} {...truncate}>{`Codex \u00b7 ${codex.filter(r => !r.depth).length} ${codex.filter(r => !r.depth).length === 1 ? 'run' : 'runs'}`}</Text>
        </Box>
        {drawRows(codex, 0, 'codex')}
        {codexQuiet ? <Box paddingX={terminal ? terminalPadding : 2} {...terminalProps}><Text color={COLOR.quiet} dimColor {...truncate}>{`+${codexQuiet} quiet`}</Text></Box> : null}
      </Box> : null}
    </Box>
  )
}
