import { test, expect, mock } from 'claude-code/testing'
import type { On, RenderNode, RenderPropsOf } from 'claude-code'

const props: RenderPropsOf['AbovePrompt'] = {
  hasSurvey: false, isWorking: false, maxRows: 10, bodyColumns: 120,
  scroll: { offset: 0, bodyRows: 10 }, view: {}
}

function readings(on: On) {
  mock.clock(on, { now: 0 })
  const state: Record<string, unknown> = {
    limits: [{ kind: 'five_hour', percentUsed: 100 }, { kind: 'seven_day', percentUsed: 100 }],
    segments: [{ name: 'Used', kind: 'used', tokens: 100 }],
    contextPercent: 100,
    panel: null,
    spend: { week: 1299, today: 0, sessionsToday: 1, session: 0 },
    system: { cpu: 100, cores: 1, memory: 100, memoryGb: 1, disk: { percent: 100, freeGb: 0 }, battery: null }
  }
  let version = 1
  on('state.get', (_, e) => ({ value: { value: state[e.key], version }, version }))
  on('state.set', (_, e) => {
    state[e.key] = e.value
    version += 1
    return { value: { isSet: true as const, version }, version }
  })
  on('ui.render', { component: 'AbovePrompt' }, ($, e, next) => e.surface === 'desktop' ? $.ui.resolve(e).Box({}) : next(e))
  return state
}

// Measure the actual Text children and Box spacing, independently of layoutWidth.
function rowWidth(node: RenderNode): number {
  if (typeof node === 'string') return Array.from(node).length
  if (node.type !== 'Box' && node.type !== 'Text') throw new Error(`Unexpected terminal element: ${node.type}`)
  let content = 0
  for (const child of node.children ?? []) content += rowWidth(child)
  return content + (node.type === 'Box' ? Number(node.props?.marginRight ?? 0) : 0)
}

function checkNoWrap(node: RenderNode, parent?: RenderNode) {
  if (typeof node === 'string') return
  if (node.type === 'Text') {
    expect(node.props?.wrap).toBe('truncate')
    expect(typeof parent !== 'string' && parent?.type === 'Box' && parent.props?.flexShrink === 0).toBe(true)
  }
  if (node.type === 'Box' || node.type === 'Text') {
    for (const child of node.children ?? []) checkNoWrap(child, node)
  }
}

for (const columns of [120, 80, 60, 40, 30, 20, 12]) {
  test(`the terminal band fits a ${columns}-column viewport with full readings`, async ($, on) => {
    readings(on)
    const ui = await $.ui.mount({
      plugin: 'usage-bars', surface: 'terminal', component: 'AbovePrompt', props,
      viewport: { columns, rows: 24 }
    })
    try {
      const tree = await ui.drawn()
      expect(rowWidth(tree), `rendered width at ${columns} columns`).toBeLessThanOrEqual(columns - 1)
      checkNoWrap(tree)
    } finally {
      await ui.unmount()
    }
  })
}

test('every terminal text piece truncates inside a box that cannot shrink', async ($, on) => {
  readings(on)
  const ui = await $.ui.mount({
    plugin: 'usage-bars', surface: 'terminal', component: 'AbovePrompt', props,
    viewport: { columns: 120, rows: 24 }
  })
  try {
    checkNoWrap(await ui.drawn())
  } finally {
    await ui.unmount()
  }
})

function rowText(node: RenderNode): string {
  if (typeof node === 'string') return node
  if (node.type !== 'Box' && node.type !== 'Text') return ''
  return (node.children ?? []).map(rowText).join('') + (node.type === 'Box' ? ' '.repeat(Number(node.props?.marginRight ?? 0)) : '')
}

for (const [columns, expected] of [
  [30, 'D 100%  W 100%  C 100%'],
  [12, 'D 100%']
] as const) {
  test(`a ${columns}-column terminal renders only the selected percentages`, async ($, on) => {
    readings(on)
    const ui = await $.ui.mount({
      plugin: 'usage-bars', surface: 'terminal', component: 'AbovePrompt', props,
      viewport: { columns, rows: 24 }
    })
    try {
      expect(rowText(await ui.drawn())).toBe(expected)
    } finally {
      await ui.unmount()
    }
  })
}

for (const columns of [120, 60, 40, 30, 12]) {
  test(`missing readings keep their dash without wrapping at ${columns} columns`, async ($, on) => {
    const state = readings(on)
    state.limits = []
    state.segments = []
    state.contextPercent = null
    state.spend = null
    state.system = null
    const ui = await $.ui.mount({
      plugin: 'usage-bars', surface: 'terminal', component: 'AbovePrompt', props,
      viewport: { columns, rows: 24 }
    })
    try {
      const tree = await ui.drawn()
      expect(rowText(tree)).toContain(' \u2013')
      expect(rowWidth(tree)).toBeLessThanOrEqual(columns - 1)
      checkNoWrap(tree)
    } finally {
      await ui.unmount()
    }
  })
}

for (const [columns, hasSurvey] of [[6, false], [1, false], [120, true]] as const) {
  test(`the band yields to the next hook at ${columns} columns with survey ${hasSurvey}`, async ($, on) => {
    readings(on)
    on('ui.render', { component: 'AbovePrompt' }, ($, e) => {
      const { Text } = $.ui.resolve(e)
      return Text({ children: 'next hook' })
    })
    const ui = await $.ui.mount({
      plugin: 'usage-bars', surface: 'terminal', component: 'AbovePrompt', props: { ...props, hasSurvey },
      viewport: { columns, rows: 24 }
    })
    try {
      expect(rowText(await ui.drawn())).toBe('next hook')
    } finally {
      await ui.unmount()
    }
  })
}

test('an unmeasured terminal keeps the full band', async ($, on) => {
  readings(on)
  const ui = await $.ui.mount({ plugin: 'usage-bars', surface: 'terminal', component: 'AbovePrompt', props })
  try {
    const tree = await ui.drawn()
    expect(rowWidth(tree)).toBe(106)
    expect(rowText(tree)).toContain('CPU 100%   Mem 100%   Disk 100%')
    checkNoWrap(tree)
  } finally {
    await ui.unmount()
  }
})

test('only the pills show when even Day cannot fit at the minimum scale', async ($, on) => {
  readings(on)
  const ui = await $.ui.mount({
    plugin: 'usage-bars', surface: 'desktop', component: 'AbovePrompt', props,
    viewport: { columns: 12, rows: 24 }
  })
  try {
    const svgs = await ui.findAll({ type: 'Svg' })
    expect(svgs).toHaveLength(3)
    expect(svgs.some(s => String(s.props.alt).startsWith('Day'))).toBe(false)
  } finally {
    await ui.unmount()
  }
})

for (const columns of [1, 12, 40, 60, 100, 125, 160, 300]) {
  test(`desktop SVGs fit the available pixels at ${columns} columns`, async ($, on) => {
    readings(on)
    const ui = await $.ui.mount({ plugin: 'usage-bars', surface: 'desktop', component: 'AbovePrompt', props, viewport: { columns, rows: 24 } })
    try {
      const svgs = await ui.findAll({ type: 'Svg' })
      // A validation refusal must not masquerade as a zero-width successful render.
      // Three pill rings always; the band from 46 columns, with the Week hover (two spacers and the card) from 59.
      expect(svgs.length).toBe(columns < 46 ? 3 : columns < 59 ? 4 : 7)
      for (const svg of svgs.filter(s => Number(s.props.width) > 10)) {
        expect(Number(svg.props.width), `SVG ${svg.props.alt}`).toBeLessThanOrEqual(columns * 7 - 16)
      }
    } finally { await ui.unmount() }
  })
}

test('desktop pills open, switch, toggle and close the read-only drawer through the real hook', async ($, on) => {
  const state = readings(on)
  state.system = { cpu: 18, cores: 8, memory: 71, memoryGb: 32, disk: { percent: 83, freeGb: 170 }, battery: null }
  const ui = await $.ui.mount({ plugin: 'usage-bars', surface: 'desktop', component: 'AbovePrompt', props, viewport: { columns: 160, rows: 24 } })
  try {
    expect((await ui.findAll({ type: 'Button' })).map(b => b.text)).toEqual(['C 18%', 'M 71%', 'D 83%'])
    await ui.press({ key: 'usage-mem' })
    expect(state.panel).toBe('mem')
    await ui.redraw() // The mocked state store does not send the host's subscription notification.
    expect((await ui.findAll({ type: 'Svg' })).some(s => String(s.props.alt).includes('Memory 71% used'))).toBe(true)
    await ui.press({ key: 'usage-mem' })
    expect(state.panel).toBe(null)
    await ui.redraw()
    expect(await ui.find({ key: 'usage-close' })).toBe(undefined)
    await ui.press({ key: 'usage-cpu' })
    expect(state.panel).toBe('cpu')
    await ui.press({ key: 'usage-disk' })
    expect(state.panel).toBe('disk')
    await ui.redraw()
    expect((await ui.findAll({ type: 'Svg' })).some(s => String(s.props.alt).includes('Disk 83% used'))).toBe(true)
    await ui.press({ key: 'usage-close' })
    expect(state.panel).toBe(null)
    await ui.redraw()
    expect(await ui.find({ key: 'usage-close' })).toBe(undefined)
  } finally { await ui.unmount() }
})

// Captured from the original hook in an isolated baseline copy, before desktop edits.
// FNV-1a over the entire serialized tree pins every terminal node, prop and text byte.
function terminalBytes(node: RenderNode): number {
  let hash = 2166136261
  for (const ch of JSON.stringify(node)) hash = Math.imul(hash ^ ch.charCodeAt(0), 16777619)
  return hash >>> 0
}
for (const [columns, snapshot] of [
  [120, 847387973], [80, 2191326550], [60, 3391757860], [40, 4197371263],
  [30, 4082337182], [20, 329619674], [12, 329619674]
] as const) {
  test(`terminal tree bytes match the original at ${columns} columns`, async ($, on) => {
    readings(on)
    const ui = await $.ui.mount({ plugin: 'usage-bars', surface: 'terminal', component: 'AbovePrompt', props, viewport: { columns, rows: 24 } })
    try { expect(terminalBytes(await ui.drawn())).toBe(snapshot) }
    finally { await ui.unmount() }
  })
}

test('missing readings are unpressable and losing system data hides an open drawer', async ($, on) => {
  const state = readings(on)
  state.system = { cpu: null, cores: 8, memory: 71, memoryGb: 32, disk: null, battery: null }
  const ui = await $.ui.mount({ plugin: 'usage-bars', surface: 'desktop', component: 'AbovePrompt', props, viewport: { columns: 160, rows: 24 } })
  try {
    expect((await ui.findAll({ type: 'Button' })).map(b => b.text)).toEqual(['M 71%'])
    expect(await ui.find({ key: 'usage-cpu' })).toBe(undefined)
    expect(await ui.find({ type: 'Text', text: 'C \u2013' })).not.toBe(undefined)
    await ui.press({ key: 'usage-mem' })
    await ui.redraw()
    expect((await ui.findAll({ type: 'Svg' })).some(s => String(s.props.alt).includes('Memory 71% used'))).toBe(true)
    state.system = null
    await ui.redraw()
    expect(await ui.findAll({ type: 'Button' })).toHaveLength(0)
    expect((await ui.findAll({ type: 'Svg' })).some(s => String(s.props.alt).includes('Memory 71% used'))).toBe(false)
  } finally { await ui.unmount() }
})
