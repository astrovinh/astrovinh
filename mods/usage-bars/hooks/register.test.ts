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
    spend: { week: 1299, today: 0, sessionsToday: 1, session: 0 },
    system: { cpu: 100, cores: 1, memory: 100, memoryGb: 1, disk: { percent: 100, freeGb: 0 }, battery: null }
  }
  on('state.get', (_, e) => ({ value: { value: state[e.key], version: 1 }, version: 1 }))
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

test('the desktop still draws the full SVG band in a narrow viewport', async ($, on) => {
  readings(on)
  const ui = await $.ui.mount({
    plugin: 'usage-bars', surface: 'desktop', component: 'AbovePrompt', props,
    viewport: { columns: 12, rows: 24 }
  })
  try {
    expect(await ui.findAll({ type: 'Svg' })).toHaveLength(2)
    expect((await ui.findAll({ type: 'Svg' }))[0]!.props.alt).toBe('Day 100%, Week 100%, Context 100%, This week $1.2k, CPU 100%, Memory 100%, Disk 100%')
  } finally {
    await ui.unmount()
  }
})
