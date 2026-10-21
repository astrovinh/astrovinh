import { test, expect } from 'claude-code/testing'
import { bar, drawPanel, meterWidth, pictureCount } from './draw'
import { buildRows } from './roster'
import type { AgentRow } from '../types'

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
    const props = renderBars([{ ...view.rows[0]!, state, todo: null }])[0]!
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
    } else if (['waiting', 'pending', 'idle'].includes(state)) {
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
      const source = bar({ ...view.rows[0]!, state, todo }, true).source
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

const multiPanel = (open = false, surface = 'desktop') => {
  const nodes: Node[] = []
  const component = (type: string) => (props: any) => { const node = { type, props }; nodes.push(node); return node }
  const own = { id: 'own', label: 'astrovinh', at: NOW, agents: view.rows }
  const other = { id: 'other', label: 'Debug26', at: NOW, agents: [{ ...view.rows[0]!, id: 'main', name: 'Foreign Hop', line: 'Foreign work' }, { ...view.rows[0]!, id: 'b', state: 'running' as const }] }
  drawPanel({ Box: component('Box'), Text: component('Text'), Svg: component('Svg'), Button: component('Button') }, surface, { ...view, sessions: [own, other], expanded: open ? ['other'] : [] } as any, 44)
  return nodes
}

test('multi-session header counts folded rows and has no own session band or duplicate title', () => {
  const nodes = multiPanel()
  const text = nodes.filter(n => n.type === 'Text').map(nodeText)
  expect(text).toContain('3 agents, 1 working \u00b7 2 need you')
  expect(text).toContain('2 sessions')
  expect(text.some(t => ['Party', 'This session', 'THIS SESSION', 'astrovinh'].includes(t))).toBe(false)
  const button = nodes.find(n => n.type === 'Button')!
  expect(button.props.key).toBe('expand:other')
  expect(button.props.label).toBe('Debug26 \u00b7 2 agents')
  expect(button.props.plain).toBe(true)
  expect(nodes.filter(n => n.type === 'Svg' && n.props.width === 24)).toHaveLength(2)
  expect(nodes.some(n => n.type === 'Text' && nodeText(n) === 'needs you' && n.props.color === '#d6ba7b')).toBe(true)
  expect(text.includes('Foreign work')).toBe(false)
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
  expect(text).toContain('astrovinh')
  expect(text).toContain('Debug26')
  expect(text).toContain('Foreign work')
  expect(text.indexOf('astrovinh') < text.indexOf('Debug26')).toBe(true)
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
  expect(nodes.filter(n => n.type === 'Text' && textContent(n.props) === 'Party')).toHaveLength(1)
  const row = nodes.find(n => [n.props.children].flat(Infinity).join('') === 'Hop (Scout)  Done  Reading code  4 tools  48s')
  expect(row).toBeDefined()
  expect(row!.props.dimColor).toBe(true)
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
