import { test, expect } from 'claude-code/testing'
import { bar, drawPanel, meterWidth, pictureCount } from './draw'
import { buildRows } from './roster'
import { mergeSessions } from './sessions'
import type { AgentRow, SessionView } from '../types'
import { ANIMAL_EMOJI, rowWidth, terminalRowLayout } from './terminal'

const NOW = 1_800_000_000_000
const view = { ...buildRows({ agents: [{ id: 'a', type: 'Explore', status: 'waiting', description: 'A long task', firstSeen: NOW - 48000, endedAt: null }], stats: { a: { tools: 4, tool: 'read', todos: [{ status: 'completed' }, { status: 'in_progress', activeForm: 'Reading code' }] } }, main: null, now: NOW }), now: NOW, session: 'astrovinh' }
const textContent = (props: any) => [props.children].flat(Infinity).filter(c => typeof c === 'string').join('')

const renderBars = (rows: AgentRow[]) => {
  const bars: { source: string; alt: string; isInteractive?: boolean }[] = []
  const component = (props: any) => props.children ?? null
  drawPanel({ Box: component, Text: component, Svg: (props: any) => {
    if (props.height === 3) bars.push(props)
    return null
  } }, 'desktop', { ...view, rows, total: rows.length })
  return bars
}

const attributes = (tag: string) => Object.fromEntries([...tag.slice(0, tag.indexOf('>') + 1).matchAll(/([\w:-]+)="([^"]*)"/g)].map(m => [m[1], m[2]]))
const rectangles = (source: string) => (source.match(/<rect\b[^>]*\/>|<rect\b[^>]*>[\s\S]*?<\/rect>/g) ?? []).map(tag => ({ ...attributes(tag), animated: /<animate(?:Transform)?\b/.test(tag) }))

test('a row without a todo list never draws a partial fill', () => {
  const colors = { running: '#8cc9a1', waiting: '#d6ba7b', pending: '#7b776c', idle: '#7b776c', completed: '#94b7e8', failed: '#f2a3b2', killed: '#7b776c' }
  for (const state of Object.keys(colors) as AgentRow['state'][]) {
    const bars = renderBars([{ ...view.rows[0]!, state, todo: null }])
    if (state === 'idle' || state === 'pending') {
      expect(bars).toHaveLength(0)
      continue
    }
    const props = bars[0]!
    const [track, ...fills] = rectangles(props.source)
    expect(Number(track!.width)).toBe(100)
    for (const fill of fills) {
      expect(fill.fill).toBe(colors[state])
      if (!fill.animated) expect(Number(fill.width)).toBe(100)
    }
    if (state === 'running') {
      expect(props.isInteractive).toBe(true)
      expect(fills).toHaveLength(1)
      expect(fills[0]!.animated).toBe(true)
      expect(Number(fills[0]!.width)).toBe(34)
      const motion = attributes(props.source.match(/<animate\b[^>]*>/)![0])
      expect(motion.attributeName).toBe('x')
      expect(motion.values!.split(';').map(Number)).toEqual([0, 66, 0])
      expect(motion.repeatCount).toBe('indefinite')
    } else if (state === 'waiting') {
      expect(fills).toHaveLength(0)
      expect(props.source.match(/<path\b/g)).toHaveLength(8)
    } else {
      expect(fills).toHaveLength(1)
      expect(Number(fills[0]!.width)).toBe(100)
    }
  }
})

test('a todo list fills exactly done over total', () => {
  for (const total of [1, 3, 7]) {
    for (let done = 0; done <= total; done++) {
      const props = renderBars([{ ...view.rows[0]!, todo: { done, total } }])[0]!
      const [, fill] = rectangles(props.source)
      expect(Number(fill!.width)).toBe(100 * done / total)
      expect(props.alt).toBe(`${done} of ${total} steps`)
      expect(props.source.includes('<animate')).toBe(false)
    }
  }
})

test('still bars carry no animation', () => {
  for (const state of ['running', 'waiting', 'pending', 'idle', 'completed', 'failed', 'killed'] as const) {
    for (const todo of [null, { done: 1, total: 3 }]) {
      const meter = bar({ ...view.rows[0]!, state, todo }, true)
      if (!todo && (state === 'idle' || state === 'pending')) {
        expect(meter).toBe(null)
        continue
      }
      const source = meter!.source
      expect(source.includes('<animate')).toBe(false)
      const [, ...fills] = rectangles(source)
      if (state === 'running' && !todo) expect(fills).toHaveLength(0)
    }
  }
})

test('desktop rows draw interactive 36px animals and an amber blocked tint and status', () => {
  const nodes: { type: string; props: any }[] = []
  const component = (type: string) => (props: any) => { nodes.push({ type, props }); return props.children ?? null }
  drawPanel({ Box: component('Box'), Text: component('Text'), Svg: component('Svg') }, 'desktop', view)
  const svg = nodes.filter(n => n.type === 'Svg' && n.props.alt?.includes('Hop the rabbit'))
  expect(svg).toHaveLength(1)
  expect(svg[0]!.props.isInteractive).toBe(true)
  expect([svg[0]!.props.width, svg[0]!.props.height]).toEqual([36, 36])
  expect(nodes.some(n => n.props.backgroundColor === '#2a2822')).toBe(true)
  expect(nodes.some(n => n.type === 'Text' && n.props.color === '#d6ba7b' && textContent(n.props).startsWith('Blocked'))).toBe(true)
  const text = nodes.filter(n => n.type === 'Text').map(n => n.props.children).join(' ')
  for (const line of ['1 session', '1 agent', '0 working', '1 needs you', 'Blocked', 'Reading code', '48s', '1/2']) expect(text).toContain(line)
  expect(nodes.some(n => n.type === 'Svg' && n.props.source.includes('width="50"'))).toBe(true)
})

test('desktop status runs omit zero tools, use singular and plural, and keep elapsed time whole', () => {
  for (const [tools, suffix] of [[0, ''], [1, ' \u00b7 1 tool'], [3, ' \u00b7 3 tools']] as const) {
    const text: string[] = []
    const component = (props: any) => props.children ?? null
    drawPanel({ Box: component, Text: (props: any) => { text.push(textContent(props)); return props.children ?? null }, Svg: component }, 'desktop', { ...view, rows: [{ ...view.rows[0]!, tools, todo: null, startedAt: NOW - 184000 }] })
    expect(text).toContain(`Blocked${suffix} \u00b7 3m 4s`)
    expect(text.some(line => line.includes('0 tools'))).toBe(false)
  }
})

test('desktop todo status runs replace tools with compact progress and keep elapsed time whole', () => {
  const text: string[] = []
  const component = (props: any) => props.children ?? null
  drawPanel({ Box: component, Text: (props: any) => { text.push(textContent(props)); return props.children ?? null }, Svg: component }, 'desktop', { ...view, rows: [{ ...view.rows[0]!, tools: 41, todo: { done: 3, total: 5 }, startedAt: NOW - 372000 }] })
  expect(text).toContain('Blocked \u00b7 3/5 \u00b7 6m 12s')
  expect(text.some(line => line.includes('41 tools'))).toBe(false)
})

type Node = { type: string; props: any }
const nodeText = (value: any): string => Array.isArray(value) ? value.map(nodeText).join('') : typeof value === 'string' ? value : value?.props ? nodeText(value.props.children) : ''
const children = (node: Node): Node[] => [node.props.children].flat(Infinity).filter(c => c && typeof c === 'object' && 'type' in c)
const renderDesktop = (rows = view.rows, columns?: number) => {
  const nodes: Node[] = []
  const component = (type: string) => (props: any) => { const node = { type, props }; nodes.push(node); return node }
  drawPanel({ Box: component('Box'), Text: component('Text'), Svg: component('Svg') }, 'desktop', { ...view, rows, total: rows.length }, columns)
  return nodes
}

test('idle and pending desktop rows keep their name and text without a bar node or its height', () => {
  for (const state of ['idle', 'pending'] as const) {
    const row = { ...view.rows[0]!, state, todo: null }
    expect(bar(row)).toBe(null)
    const nodes = renderDesktop([row])
    const column = nodes.find(n => n.type === 'Box' && n.props.flexDirection === 'column' && n.props.flexGrow === 1)!
    expect(children(column).map(n => n.type)).toEqual(['Box', 'Text'])
    expect(nodeText(column)).toContain(row.name)
    expect(nodeText(children(column)[1])).toBe(row.line)
    expect(nodes.filter(n => n.type === 'Svg' && n.props.height === 3)).toHaveLength(0)
  }
})

test('idle and pending rows with todos still draw measured desktop bars', () => {
  for (const state of ['idle', 'pending'] as const) {
    const bars = renderBars([{ ...view.rows[0]!, state, todo: { done: 1, total: 4 } }])
    expect(bars).toHaveLength(1)
    expect(Number(rectangles(bars[0]!.source)[1]!.width)).toBe(25)
  }
})

test('folded miniatures and expanded desktop and terminal rows use the same reassigned session animals', () => {
  const roster = buildRows({ agents: Array.from({ length: 2 }, (_, i) => ({ id: `scout-${i}`, type: 'Explore', status: 'idle' as const,
    description: `Task ${i}`, firstSeen: NOW + i, endedAt: null })), stats: {}, main: { startedAt: NOW, endedAt: NOW, working: false }, now: NOW })
  for (const ownStart of [1, 3]) {
    const own = { id: 'own', label: 'Own', startedAt: ownStart, at: NOW, agents: roster.rows }
    const other = { id: 'other', label: 'Other', startedAt: 2, at: NOW, agents: roster.rows }
    const sessions = mergeSessions(own, [other], NOW)
    const ownName = ownStart === 1 ? 'Ember' : 'Mochi'
    const otherName = ownStart === 1 ? 'Mochi' : 'Ember'
    const spareName = ownStart === 1 ? 'Biscuit' : 'Mochi'
    for (const expanded of [false, true]) {
      const nodes: Node[] = []
      const component = (type: string) => (props: any) => { const node = { type, props }; nodes.push(node); return node }
      drawPanel({ Box: component('Box'), Text: component('Text'), Svg: component('Svg'), Button: component('Button') }, 'desktop',
        { ...view, ...roster, sessions, expanded: expanded ? ['other'] : [] })
      const ownGroup = nodes.find(n => n.props.key === 'session:own')!
      expect(nodeText(ownGroup)).toContain(ownName)
      if (expanded) {
        const otherGroup = nodes.find(n => n.props.key === 'session:other')!
        expect(nodeText(otherGroup)).toContain(otherName)
        expect(nodeText(otherGroup)).toContain(spareName)
      } else {
        const miniatures = nodes.filter(n => n.type === 'Svg' && n.props.width === 24)
        expect(miniatures).toHaveLength(3)
        expect(miniatures[0]!.props.alt).toContain(`${otherName} the ${ownStart === 1 ? 'cat' : 'fox'}`)
        expect(miniatures[0]!.props.alt).toContain('Lead')
        expect(miniatures[2]!.props.alt).toContain(spareName)
      }
      expect(nodes.filter(n => n.type === 'Svg' && n.props.width === 36)[0]!.props.alt).toContain(`${ownName} the ${ownStart === 1 ? 'fox' : 'cat'}`)
    }
    const { nodes } = renderTerminal(roster.rows, 64, sessions)
    for (const s of sessions) {
      const group = nodes.find(n => n.props.key === `session:${s.id}`)!
      expect(nodeText(group)).toContain(s.agents[0]!.name)
      expect(nodeText(group)).toContain(ANIMAL_EMOJI[s.agents[0]!.animal])
    }
  }
})

const multiPanel = (open = false, surface = 'desktop', own: SessionView = { id: 'own', label: 'astrovinh', at: NOW, agents: view.rows }, includeOther = true) => {
  const nodes: Node[] = []
  const component = (type: string) => (props: any) => { const node = { type, props }; nodes.push(node); return node }
  const other = { id: 'other', label: 'Debug26', at: NOW, agents: [{ ...view.rows[0]!, id: 'main', name: 'Foreign Hop', line: 'Foreign work' }, { ...view.rows[0]!, id: 'b', state: 'running' as const }] }
  drawPanel({ Box: component('Box'), Text: component('Text'), Svg: component('Svg'), Button: component('Button') }, surface, { ...view, sessions: includeOther ? [own, other] : [own], expanded: open ? ['other'] : [] } as any, 44)
  return nodes
}

test('multi-session summary counts folded rows without an uppercase band or duplicate title', () => {
  const nodes = multiPanel()
  const text = nodes.filter(n => n.type === 'Text').map(nodeText)
  expect(text).toContain('3 agents, 1 working \u00b7 2 need you')
  expect(text).toContain('2 sessions')
  expect(text.some(t => ['Party', 'THIS SESSION', 'astrovinh'].includes(t))).toBe(false)
  const button = nodes.find(n => n.type === 'Button')!
  expect(button.props.key).toBe('expand:other')
  expect(button.props.label).toBe('Debug26 \u00b7 2 agents')
  expect(button.props.plain).toBe(true)
  expect(nodes.filter(n => n.type === 'Svg' && n.props.width === 24)).toHaveLength(2)
  expect(nodes.some(n => n.type === 'Text' && nodeText(n) === 'needs you' && n.props.color === '#d6ba7b')).toBe(true)
  expect(text.includes('Foreign work')).toBe(false)
})

test('desktop labels this session before its rows with a quiet left label and right agent count', () => {
  for (const total of [0, 1, 2, 15]) {
    const rows = Array.from({ length: Math.min(total, 2) }, (_, i) => ({ ...view.rows[0]!, id: `own-${i}` }))
    const nodes = multiPanel(false, 'desktop', { id: 'own', label: 'astrovinh', at: NOW, agents: rows, counts: { total, working: 0, blocked: 0, overflow: Math.max(0, total - rows.length) } })
    const group = nodes.find(n => n.props.key === 'group:own')!
    const [header, rowGroup] = children(group)
    expect(header!.type).toBe('Box')
    expect(children(header!).map(nodeText)).toEqual(['This session', `${total} ${total === 1 ? 'agent' : 'agents'}`])
    expect(header!.props.justifyContent).toBe('space-between')
    expect(header!.props.paddingX).toBe(2)
    expect(rowGroup!.props.key).toBe('session:own')
    const descendants = (node: Node): Node[] => [node, ...children(node).flatMap(descendants)]
    for (const node of descendants(header!)) {
      expect(['Button', 'Svg'].includes(node.type)).toBe(false)
      expect(Object.keys(node.props).some(key => key === 'backgroundColor' || key.startsWith('on'))).toBe(false)
      if (node.type === 'Text') {
        expect(node.props.color).toBe('#aaa69a')
        expect(node.props.bold).toBeUndefined()
        expect(node.props.fontFamily).toBeUndefined()
      }
    }
  }
})

test('one session has no local header on desktop or terminal with explicit or fallback sessions', () => {
  for (const surface of ['desktop', 'terminal']) {
    const own = { id: 'own', label: 'astrovinh', at: NOW, agents: view.rows }
    const explicit = multiPanel(false, surface, own, false)
    const group = explicit.find(n => n.props.key === 'group:own')!
    expect(children(group).map(n => n.props.key)).toEqual(['session:own'])
    const fallback: Node[] = []
    const component = (type: string) => (props: any) => { const node = { type, props }; fallback.push(node); return node }
    drawPanel({ Box: component('Box'), Text: component('Text'), Svg: component('Svg') }, surface, view)
    for (const nodes of [explicit, fallback]) {
      expect(nodes.filter(n => n.type === 'Text').some(n => /This session|astrovinh/.test(nodeText(n)))).toBe(false)
    }
  }
})

test('terminal labels this session with its agent count in one plain line before its rows', () => {
  for (const total of [0, 1, 2]) {
    const rows = Array.from({ length: total }, (_, i) => ({ ...view.rows[0]!, id: `own-${i}` }))
    const nodes = multiPanel(false, 'terminal', { id: 'own', label: 'astrovinh', at: NOW, agents: rows })
    const group = nodes.find(n => n.props.key === 'group:own')!
    const [header, rowGroup] = children(group)
    expect(children(header!).map(n => n.type)).toEqual(['Text'])
    expect(nodeText(header)).toBe(`This session  ${total} ${total === 1 ? 'agent' : 'agents'}`)
    expect(rowGroup!.props.key).toBe('session:own')
    expect(nodes.some(n => n.type === 'Svg' || n.type === 'Button')).toBe(false)
  }
})

test('expanded foreign sessions reuse streamlined rows and replace miniature animals with hide', () => {
  const nodes = multiPanel(true)
  expect(nodes.filter(n => n.type === 'Svg' && n.props.width === 24)).toHaveLength(0)
  expect(nodes.filter(n => n.type === 'Svg' && n.props.width === 36)).toHaveLength(3)
  expect(nodes.filter(n => n.type === 'Svg' && n.props.height === 3).map(n => n.props.width)).toEqual([232, 232, 232])
  expect(nodes.filter(n => n.type === 'Svg' && n.props.height === 1).map(n => n.props.width)).toEqual([276])
  expect(nodes.some(n => n.type === 'Text' && nodeText(n) === 'hide')).toBe(true)
  expect(nodes.some(n => n.type === 'Text' && nodeText(n) === 'Foreign work')).toBe(true)
  expect(nodes.filter(n => n.type === 'Box' && 'backgroundColor' in n.props).every(n => n.props.backgroundColor === '#2a2822')).toBe(true)
  for (const row of nodes.filter(n => n.type === 'Box' && n.props.flexGrow === 1 && n.props.flexDirection === 'column')) {
    expect(children(row).map(n => n.type)).toEqual(['Box', 'Text', 'Svg'])
  }
})

test('terminal groups every session even when desktop folding is closed and draws no SVG', () => {
  const nodes = multiPanel(false, 'terminal')
  expect(nodes.some(n => n.type === 'Svg')).toBe(false)
  const text = nodes.filter(n => n.type === 'Text').map(nodeText).join(' ')
  expect(text).toContain('This session  1 agent')
  expect(text).toContain('Debug26')
  expect(text).toContain('Foreign work')
  expect(text.indexOf('This session') < text.indexOf('Debug26')).toBe(true)
})

test('picture cache keeps separate entries for matching agent ids in different sessions', () => {
  multiPanel(true)
  expect(pictureCount()).toBe(3)
  renderDesktop([])
  expect(pictureCount()).toBe(0)
})

test('desktop header puts the summary beside the session chip without repeating the pane title', () => {
  const nodes = renderDesktop()
  expect(nodes.filter(n => n.type === 'Text').some(n => nodeText(n) === 'Party')).toBe(false)
  const summary = nodes.find(n => n.type === 'Text' && nodeText(n) === '1 agent, 0 working \u00b7 1 needs you')!
  expect(summary).toBeDefined()
  const header = nodes.find(n => n.type === 'Box' && children(n).includes(summary))!
  expect(header.props.justifyContent).toBe('space-between')
  expect(children(header).map(nodeText)).toEqual(['1 agent, 0 working \u00b7 1 needs you', '1 session'])
  expect(children(summary)[0]!.props.color).toBe('#d6ba7b')
})

test('desktop root, headers and normal rows inherit the app background', () => {
  for (const state of ['running', 'pending', 'idle', 'completed', 'failed', 'killed'] as const) {
    const nodes = renderDesktop([{ ...view.rows[0]!, state }])
    expect(nodes.filter(n => Object.prototype.hasOwnProperty.call(n.props, 'backgroundColor'))).toHaveLength(0)
  }
  expect(renderDesktop([]).filter(n => Object.prototype.hasOwnProperty.call(n.props, 'backgroundColor'))).toHaveLength(0)
})

test('only a blocked desktop row passes an amber background tint', () => {
  const nodes = renderDesktop([view.rows[0]!, { ...view.rows[0]!, id: 'b', state: 'running' }])
  const tinted = nodes.filter(n => Object.prototype.hasOwnProperty.call(n.props, 'backgroundColor'))
  expect(tinted).toHaveLength(1)
  expect(tinted[0]!.type).toBe('Box')
  expect(tinted[0]!.props.backgroundColor).toBe('#2a2822')
  expect(nodeText(tinted[0])).toContain('Blocked')
})

test('desktop rows have no gutter Box', () => {
  const nodes = renderDesktop()
  expect(nodes.some(n => n.type === 'Box' && n.props.width === 1)).toBe(false)
  const row = nodes.find(n => n.type === 'Box' && n.props.backgroundColor === '#2a2822')!
  expect(children(row)).toHaveLength(2)
})

test('desktop rows have no role text while the animal alt and row data retain it', () => {
  const row = view.rows[0]!
  const nodes = renderDesktop()
  expect(nodes.filter(n => n.type === 'Text').some(n => nodeText(n).includes(row.role))).toBe(false)
  expect(nodes.find(n => n.type === 'Svg' && n.props.width === 36)!.props.alt).toContain(row.role)
  expect(row.role).toBe('Scout')
})

test('desktop first line keeps status, tools and time in one whole non-shrinking run before truncating the name', () => {
  const row = { ...view.rows[0]!, name: 'A very long animal name', state: 'running' as const, tools: 5, todo: null, startedAt: NOW - 184000 }
  const nodes = renderDesktop([row])
  const run = nodes.find(n => n.type === 'Text' && nodeText(n) === 'Working \u00b7 5 tools \u00b7 3m 4s')
  expect(run).toBeDefined()
  const holder = nodes.find(n => n.type === 'Box' && children(n).includes(run!))!
  expect(holder.props.flexShrink).toBe(0)
  expect(run!.props.color).toBe('#8cc9a1')
  for (const text of [run!, ...children(run!)]) {
    expect(Object.prototype.hasOwnProperty.call(text.props, 'wrap')).toBe(false)
    expect(Object.prototype.hasOwnProperty.call(text.props, 'truncate')).toBe(false)
  }
  expect(children(run!)[0]!.props.color).toBe('#aaa69a')
  const line = nodes.find(n => n.type === 'Box' && children(n).includes(holder))!
  const nameHolder = children(line)[0]!
  const name = children(nameHolder)[0]!
  expect(nodeText(name)).toBe(row.name)
  expect(name.props.bold).toBe(true)
  expect(name.props.wrap).toBe('truncate')
  expect(nameHolder.props.minWidth).toBe(0)
  expect(nameHolder.props.flexGrow).toBe(1)
})

test('desktop text column contains first line, truncating action and hairline without adjacent meter text', () => {
  const nodes = renderDesktop()
  const column = nodes.find(n => n.type === 'Box' && n.props.flexDirection === 'column' && n.props.flexGrow === 1)!
  const parts = children(column)
  expect(parts.map(n => n.type)).toEqual(['Box', 'Text', 'Svg'])
  expect(nodeText(parts[1])).toBe(view.rows[0]!.line)
  expect(parts[1]!.props.wrap).toBe('truncate')
  expect(parts[2]!.props.height).toBe(3)
})

test('desktop teammate notes get their own dim line only when present', () => {
  const note = 'Reported running, activity unavailable'
  const nodes = renderDesktop([{ ...view.rows[0]!, note }])
  const column = nodes.find(n => n.type === 'Box' && n.props.flexDirection === 'column' && n.props.flexGrow === 1)!
  const parts = children(column)
  expect(parts.map(n => n.type)).toEqual(['Box', 'Text', 'Text', 'Svg'])
  expect(nodeText(parts[2])).toBe(note)
  expect(parts[2]!.props.dimColor).toBe(true)
  expect(parts[2]!.props.color).toBe('#aaa69a')
  expect(parts[2]!.props.wrap).toBe('truncate')
})

test('meter widths default to 200 and follow pane columns within the 120 to 320 clamps', () => {
  for (const [columns, width] of [[undefined, 200], [0, 120], [20, 120], [28, 120], [40, 204], [44, 232], [56, 316], [80, 320]] as const) {
    expect(meterWidth(columns)).toBe(width)
  }
})

test('desktop hairlines use computed pane width, a 3px height and a scalable viewBox', () => {
  for (const [columns, width] of [[undefined, 200], [20, 120], [44, 232], [80, 320]] as const) {
    const nodes = renderDesktop(view.rows, columns)
    const meter = nodes.find(n => n.type === 'Svg' && n.props.width !== 36)!
    expect([meter.props.width, meter.props.height]).toEqual([width, 3])
    expect(meter.props.isInteractive).toBe(true)
    const svg = attributes(meter.props.source)
    expect(svg.viewBox).toBe('0 0 100 3')
    expect(svg.preserveAspectRatio).toBe('none')
    expect(Number(svg.height)).toBe(3)
    expect(rectangles(meter.props.source).every(rect => Number(rect.height) === 3)).toBe(true)
  }
})

test('a single desktop session has no session band', () => {
  const nodes = renderDesktop()
  expect(nodes.filter(n => n.type === 'Text').some(n => nodeText(n) === view.session || nodeText(n) === 'This session')).toBe(false)
  expect(nodes.some(n => n.type === 'Box' && n.props.backgroundColor === '#242422')).toBe(false)
})

test('desktop rows use 1px SVG dividers matching the content width only between rows', () => {
  for (const [columns, width] of [[undefined, 244], [20, 164], [44, 276], [80, 364]] as const) {
    for (const count of [0, 1, 3]) {
      const rows = Array.from({ length: count }, (_, i) => ({ ...view.rows[0]!, id: String(i) }))
      const nodes = renderDesktop(rows, columns)
      expect(nodes.some(n => n.type === 'Box' && n.props.height === 1 && n.props.backgroundColor !== undefined)).toBe(false)
      const dividers = nodes.filter(n => n.type === 'Svg' && n.props.height === 1)
      expect(dividers).toHaveLength(Math.max(0, count - 1))
      for (const divider of dividers) {
        expect(divider.props.width).toBe(width)
        expect(divider.props.alt).toBe('')
        const svg = attributes(divider.props.source)
        expect(Number(svg.height)).toBe(1)
        expect(svg.preserveAspectRatio).toBe('none')
        const bounds = svg.viewBox!.split(' ').map(Number)
        expect(bounds.slice(0, 2)).toEqual([0, 0])
        expect(bounds[2]! > 0).toBe(true)
        expect(bounds[3]).toBe(1)
        expect(rectangles(divider.props.source).some(rect => Number(rect.width) === bounds[2] && Number(rect.height) === 1 && rect.fill === '#34332f')).toBe(true)
      }
      for (const [index, row] of rows.entries()) {
        const wrapper = nodes.find(n => n.type === 'Box' && n.props.key === row.id)!
        expect(children(wrapper).filter(n => n.type === 'Svg' && n.props.height === 1)).toHaveLength(index === 0 ? 0 : 1)
        expect(children(wrapper)[0]!.type).toBe(index === 0 ? 'Box' : 'Svg')
      }
    }
  }
})

test('terminal rows are text only and finished rows are dimmed', () => {
  const nodes: { type: string; props: any }[] = []
  const component = (type: string) => (props: any) => { nodes.push({ type, props }); return props.children ?? null }
  const r = { ...view, rows: view.rows.map(r => ({ ...r, state: 'completed' as const, endedAt: NOW })) }
  drawPanel({ Box: component('Box'), Text: component('Text'), Svg: () => { throw new Error('Terminal drew an SVG') } }, 'terminal', r)
  expect(nodes.filter(n => n.type === 'Text' && textContent(n.props) === 'Party')).toHaveLength(0)
  for (const content of ['Done', '   Reading code']) {
    const text = nodes.find(n => textContent(n.props) === content)
    expect(text).toBeDefined()
    expect(text!.props.dimColor).toBe(true)
  }
})

test('empty panels explain when agents appear', () => {
  for (const surface of ['desktop', 'terminal']) {
    let text = ''
    const component = (props: any) => { text += [props.children].flat(Infinity).filter(c => typeof c === 'string').join(''); return null }
    drawPanel({ Box: component, Text: component }, surface, { ...view, rows: [], total: 0, working: 0, blocked: 0 })
    expect(text).toContain('No agents yet. They show up here when Claude Code starts one.')
  }
})

test('desktop and terminal panels disclose hidden agents in a dim final row', () => {
  const roster = buildRows({ agents: Array.from({ length: 15 }, (_, i) => ({ id: String(i), type: 'Explore', status: i === 14 ? 'waiting' as const : 'running' as const, description: `Task ${i}`, firstSeen: NOW + i, endedAt: null })), stats: {}, main: null, now: NOW })
  for (const surface of ['desktop', 'terminal']) {
    const nodes: { type: string; props: any }[] = []
    const component = (type: string) => (props: any) => { nodes.push({ type, props }); return props.children ?? null }
    drawPanel({ Box: component('Box'), Text: component('Text'), Svg: component('Svg') }, surface, { ...view, ...roster })
    const texts = nodes.filter(n => n.type === 'Text')
    expect(texts.some(n => textContent(n.props).includes('15 agents, 14 working'))).toBe(true)
    expect(texts.some(n => textContent(n.props).includes('1 needs you'))).toBe(true)
    expect(textContent(texts[texts.length - 1]!.props)).toBe('+3 more agents')
    expect(texts[texts.length - 1]!.props.dimColor).toBe(true)
    if (surface === 'terminal') expect(nodes.some(n => n.type === 'Svg')).toBe(false)
  }
})

test('panels without hidden agents omit the overflow row', () => {
  for (const surface of ['desktop', 'terminal']) {
    const text: string[] = []
    const component = (props: any) => props.children ?? null
    drawPanel({ Box: component, Text: (props: any) => { text.push(textContent(props)); return props.children ?? null }, Svg: component }, surface, view)
    expect(text.some(line => line.includes('more agents'))).toBe(false)
  }
})

const renderPictures = (rows: AgentRow[], now = NOW) => {
  const sources: string[] = []
  const component = (props: any) => props.children ?? null
  drawPanel({ Box: component, Text: component, Svg: (props: any) => {
    if (props.width === 36) sources.push(props.source)
    return null
  } }, 'desktop', { ...view, rows, total: rows.length, now })
  return sources
}

test('pictures of twelve departed agents are forgotten after an empty view', () => {
  const rows = Array.from({ length: 12 }, (_, i) => ({ ...view.rows[0]!, id: `departing-${i}` }))
  const before = renderPictures(rows)
  expect(pictureCount()).toBe(12)
  renderPictures([])
  expect(pictureCount()).toBe(0)
  const after = renderPictures(rows)
  expect(before).toHaveLength(12)
  expect(after).toHaveLength(12)
  for (let i = 0; i < 12; i++) expect(after[i] === before[i]).toBe(false)
})

test('pictures of agents still present keep their animation source across clock redraws', () => {
  const rows = [{ ...view.rows[0]!, id: 'remaining-agent' }]
  expect(renderPictures(rows, NOW + 5000)).toEqual(renderPictures(rows))
})

const settingsPanel = (motion = true, size = 'small', expanded = false) => {
  const nodes: Node[] = []
  const component = (type: string) => (props: any) => { const node = { type, props }; nodes.push(node); return node }
  const rows = ['running', 'waiting', 'pending', 'idle', 'completed', 'failed', 'killed'].map((state, i) => ({
    ...view.rows[0]!, id: `state-${i}`, state: state as AgentRow['state'], todo: null
  }))
  drawPanel({ Box: component('Box'), Text: component('Text'), Svg: component('Svg'), Button: component('Button') }, 'desktop',
    { ...view, settings: { motion, size }, sessions: [
      { id: 'own', label: 'Local', at: NOW, agents: rows },
      { id: 'other', label: 'Other', at: NOW, agents: rows }
    ], expanded: expanded ? ['other'] : [] } as any, 44)
  return nodes
}

test('motion off stills every row, folded miniature and progress hairline even after an animated render', () => {
  expect(settingsPanel().some(n => n.type === 'Svg' && n.props.source.includes('<animate'))).toBe(true)
  for (const expanded of [false, true]) {
    const still = settingsPanel(false, 'small', expanded).filter(n => n.type === 'Svg')
    expect(still.length > 0).toBe(true)
    expect(still.some(n => n.props.source.includes('<animate'))).toBe(false)
    expect(still.some(n => n.props.isInteractive === true)).toBe(false)
  }
  expect(settingsPanel().some(n => n.type === 'Svg' && n.props.source.includes('<animate'))).toBe(true)
})

test('each size scales row animals, folded miniatures and their layout without changing the default', () => {
  for (const [size, px, mini] of [['tiny', 24, 16], ['small', 36, 24], ['medium', 48, 32]] as const) {
    for (const expanded of [false, true]) {
      const nodes = settingsPanel(true, size, expanded)
      const animals = nodes.filter(n => n.type === 'Svg' && n.props.height > 3)
      expect(animals).toHaveLength(14)
      expect(animals.slice(0, 7).every(n => n.props.width === px && n.props.height === px)).toBe(true)
      expect(animals.slice(7).every(n => n.props.width === (expanded ? px : mini) && n.props.height === (expanded ? px : mini))).toBe(true)
      expect(animals.slice(0, 7).every(n => Number(attributes(n.props.source).width) === px)).toBe(true)
      const width = Math.max(120, Math.min(320, 44 * 7 - px - 40))
      expect(nodes.filter(n => n.type === 'Svg' && n.props.height === 3).every(n => n.props.width === width)).toBe(true)
      expect(nodes.filter(n => n.type === 'Svg' && n.props.height === 1).every(n => n.props.width === width + px + 8)).toBe(true)
    }
  }
})

test('header and folded-session amber text agree for one or multiple blocked agents', () => {
  for (const blocked of [1, 2]) {
    const nodes: Node[] = []
    const component = (type: string) => (props: any) => { const node = { type, props }; nodes.push(node); return node }
    const rows = Array.from({ length: blocked }, (_, i) => ({ ...view.rows[0]!, id: String(i) }))
    drawPanel({ Box: component('Box'), Text: component('Text'), Svg: component('Svg'), Button: component('Button') }, 'desktop',
      { ...view, sessions: [{ id: 'own', label: 'Local', at: NOW, agents: [] }, { id: 'other', label: 'Other', at: NOW, agents: rows }] })
    const amber = nodes.filter(n => n.type === 'Text' && n.props.color === '#d6ba7b').map(nodeText)
    expect(amber).toContain(` \u00b7 ${blocked} ${blocked === 1 ? 'needs' : 'need'} you`)
    expect(amber).toContain(`${blocked === 1 ? 'needs' : 'need'} you`)
  }
})

test('no row without a todo list ever claims a percentage or a step count on either surface', () => {
  const rows = ['running', 'waiting', 'pending', 'idle', 'completed', 'failed', 'killed'].map((state, i) => ({
    ...view.rows[0]!, id: String(i), state: state as AgentRow['state'], todo: null, line: 'Reading', tools: 3
  }))
  for (const surface of ['desktop', 'terminal']) {
    const texts: string[] = []
    const component = (props: any) => props.children ?? null
    drawPanel({ Box: component, Text: (props: any) => { texts.push(nodeText(props.children)); return props.children ?? null },
      Svg: (props: any) => { texts.push(props.alt); return null } }, surface, { ...view, rows, total: rows.length })
    expect(texts.some(t => /%|\bpercent\b|\d+\s+of\s+\d+|\d+\/\d+/.test(t))).toBe(false)
    expect(texts.some(t => t.includes('3 tools'))).toBe(true)
  }
})

const renderTerminal = (rows = view.rows, columns?: number, sessions?: SessionView[]) => {
  const nodes: Node[] = []
  const component = (type: string) => (props: any) => { const node = { type, props }; nodes.push(node); return node }
  const tree = drawPanel({ Box: component('Box'), Text: component('Text'), Svg: component('Svg'), Button: component('Button') }, 'terminal',
    { ...view, rows, total: rows.length, working: rows.filter(r => r.state === 'running').length, blocked: rows.filter(r => r.state === 'waiting').length, sessions }, columns) as unknown as Node
  return { nodes, tree }
}
const terminalCells = (text: string) => [...text].reduce((n, c) => n + (c.codePointAt(0)! > 0xffff ? 2 : 1), 0)

test('idle and pending terminal rows leave the tier bar column blank and keep both text lines', () => {
  for (const state of ['idle', 'pending'] as const) for (const columns of [64, 44, 24]) {
    const row = { ...view.rows[0]!, state, todo: null }
    const { nodes } = renderTerminal([row], columns)
    const parts = children(nodes.find(n => n.props.key === row.id)!)
    expect(parts.map(n => n.type)).toEqual(['Box', 'Text'])
    expect(nodeText(parts[0])).toContain(row.name)
    expect(nodeText(parts[1])).toBe(`   ${row.line}`)
    const meter = children(parts[0]!).find(n => n.props.key === 'bar')!
    expect(meter.props.width).toBe(terminalRowLayout(columns).bar)
    expect(nodeText(meter)).toBe('')
  }
})

test('terminal agents have two truncating lines, emoji and separate nonshrinking columns instead of roles', () => {
  const row = { ...view.rows[0]!, name: 'A name longer than its column' }
  const { nodes } = renderTerminal([row], 64)
  const agent = nodes.find(n => n.props.key === row.id)!
  const parts = children(agent)
  expect(parts.map(n => n.type)).toEqual(['Box', 'Text'])
  const pieces = children(parts[0]!)
  expect(pieces).toHaveLength(9)
  for (const piece of pieces) {
    expect(piece.type).toBe('Box')
    expect(piece.props.flexShrink).toBe(0)
    const text = children(piece)[0]!
    expect(text.type).toBe('Text')
    expect(text.props.wrap).toBe('truncate')
  }
  expect(nodeText(parts[0])).toContain(ANIMAL_EMOJI[row.animal])
  expect(nodeText(agent).includes(`(${row.role})`)).toBe(false)
  expect(nodeText(parts[1])).toBe(`   ${row.line}`)
  expect(parts[1]!.props.color).toBe('#aaa69a')
  expect(parts[1]!.props.dimColor).toBe(true)
  expect(parts[1]!.props.wrap).toBe('truncate')
  expect(nodes.some(n => n.type === 'Svg')).toBe(false)
})

test('terminal rows budget every rendered first-line cell across widths, long names, states and metadata', () => {
  for (let columns = 1; columns <= 200; columns++) for (const state of ['running', 'waiting', 'pending', 'idle', 'completed', 'failed', 'killed'] as const) for (const todo of [null, { done: 3, total: 5 }]) {
    const row = { ...view.rows[0]!, name: 'An exceptionally long animal name', state, todo, tools: 999, startedAt: NOW - (99 * 3600 + 59 * 60) * 1000 }
    const { nodes, tree } = renderTerminal([row], columns)
    expect(tree.props.width).toBe(columns - 1)
    const agent = nodes.find(n => n.props.key === row.id)!
    const first = children(agent)[0]!
    expect(first.props.width <= columns - 1).toBe(true)
    const layout = terminalRowLayout(columns)
    if (layout.tier === 'tiny') {
      expect(children(first)).toHaveLength(1)
      expect(children(children(first)[0]!)[0]!.props.wrap).toBe('truncate')
    } else {
      const pieces = children(first)
      const width = pieces.reduce((sum, part) => sum + part.props.width, 0)
      expect(width).toBe(rowWidth(layout, row))
      expect(width <= columns - 1).toBe(true)
      for (const piece of pieces) {
        const text = children(piece)[0]!
        expect(terminalCells(nodeText(text)) <= piece.props.width || text.props.wrap === 'truncate').toBe(true)
      }
    }
  }
})

test('terminal metadata progressively drops tools, then time with todos, then the bar', () => {
  const row = { ...view.rows[0]!, tools: 999, todo: { done: 3, total: 5 }, startedAt: NOW - (99 * 3600 + 59 * 60) * 1000 }
  for (const [columns, meta, bar] of [[64, '3/5 \u00b7 999 tools \u00b7 99h 59m', true], [44, '3/5 99h', true], [24, '3/5', true], [23, '99h', false]] as const) {
    const { nodes } = renderTerminal([row], columns)
    const first = children(nodes.find(n => n.props.key === row.id)!)[0]!
    expect(nodeText(first)).toContain(meta)
    expect(/[\u2500\u2501\u254c]/.test(nodeText(first))).toBe(bar)
    if (columns < 44) expect(nodeText(first).includes('Blocked')).toBe(false)
  }
  expect(nodeText(children(renderTerminal([{ ...row, todo: null }], 24).nodes.find(n => n.props.key === row.id)!)[0])).toContain('99h')
})

test('terminal finished statuses stay dim, blocked stays amber and notes require room', () => {
  for (const state of ['running', 'waiting', 'pending', 'idle', 'completed', 'failed', 'killed'] as const) for (const columns of [64, 44, 24, 23]) {
    const row = { ...view.rows[0]!, state, todo: null, note: 'Reported state, activity unavailable' }
    const { nodes } = renderTerminal([row], columns)
    const parts = children(nodes.find(n => n.props.key === row.id)!)
    expect(parts).toHaveLength(columns >= 44 ? 3 : 2)
    const status = nodes.find(n => n.type === 'Text' && nodeText(n).trim() === ({ running: 'Working', waiting: 'Blocked', pending: 'Pending', idle: 'Idle', completed: 'Done', failed: 'Failed', killed: 'Stopped' })[state])
    if (columns >= 44) {
      expect(status).toBeDefined()
      expect(!!status!.props.dimColor).toBe(['completed', 'failed', 'killed'].includes(state))
      if (state === 'waiting') expect(status!.props.color).toBe('#d6ba7b')
      expect(nodeText(parts[2])).toContain(row.note)
      expect(parts[2]!.props.wrap).toBe('truncate')
      expect(parts[2]!.props.color).toBe('#aaa69a')
    }
    if (state === 'waiting' && columns === 24) expect(nodes.some(n => n.type === 'Text' && n.props.color === '#d6ba7b' && nodeText(n).includes('\u254c'))).toBe(true)
  }
})

test('terminal header is one truncating summary and only includes sessions when they fit', () => {
  const rows = [view.rows[0]!, { ...view.rows[0]!, id: 'b', state: 'running' as const }]
  for (const columns of [1, 24, 44, 64]) {
    const { nodes, tree } = renderTerminal(rows, columns)
    const header = children(tree)[0]!
    expect(children(header).map(n => n.type)).toEqual(['Text'])
    expect(nodeText(header)).toContain('2 agents, 1 working')
    expect(nodeText(header).includes('Party')).toBe(false)
    expect(nodeText(header).includes('1 session')).toBe(columns >= 64)
    expect(children(header)[0]!.props.wrap).toBe('truncate')
    expect(nodes.some(n => n.type === 'Text' && n.props.color === '#d6ba7b' && nodeText(n).includes('1 needs you'))).toBe(true)
  }
  for (const blocked of [1, 2]) {
    const { tree } = renderTerminal(Array.from({ length: blocked }, (_, i) => ({ ...view.rows[0]!, id: String(i) })), 64)
    expect(nodeText(children(tree)[0])).toContain(`${blocked} ${blocked === 1 ? 'needs' : 'need'} you`)
  }
})

test('terminal session labels, descriptions, notes, overflow and empty text cannot wrap', () => {
  const own = { id: 'own', label: 'Local', at: NOW, agents: [{ ...view.rows[0]!, note: 'Long note'.repeat(20) }], counts: { total: 15, working: 0, blocked: 1, overflow: 14 } }
  const other = { id: 'other', label: 'A long repository label'.repeat(20), at: NOW, agents: view.rows }
  for (const rows of [view.rows, []]) {
    const { nodes } = renderTerminal(rows, 44, rows.length ? [own, other] : undefined)
    for (const text of nodes.filter(n => n.type === 'Text')) expect(text.props.wrap).toBe('truncate')
  }
})

test('tiny terminal metadata stays dim and session padding fits even below four cells', () => {
  const row = { ...view.rows[0]!, startedAt: NOW - (99 * 3600 + 59 * 60) * 1000 }
  const own = { id: 'own', label: 'Local', at: NOW, agents: [row], counts: { total: 15, working: 0, blocked: 1, overflow: 14 } }
  const other = { id: 'other', label: 'Other', at: NOW, agents: [row] }
  for (let columns = 1; columns < 24; columns++) {
    const { nodes } = renderTerminal([row], columns, [own, other])
    const meta = nodes.find(n => n.type === 'Text' && nodeText(n) === '99h')
    expect(meta).toBeDefined()
    expect(meta!.props.color).toBe('#aaa69a')
    expect(meta!.props.dimColor).toBe(true)
    for (const box of nodes.filter(n => n.type === 'Box' && n.props.paddingX)) expect(2 * box.props.paddingX <= columns - 1).toBe(true)
  }
})
