import { test, expect, mock } from 'claude-code/testing'
import type { On, RenderNode, RenderPropsOf } from 'claude-code'
import { desktopLayout, weekHover } from './bars'

const svgAlts = async (ui: any): Promise<string[]> => (await ui.findAll({ type: 'Svg' })).map((s: any) => String(s.props.alt))

const props: RenderPropsOf['AbovePrompt'] = {
  hasSurvey: false, isWorking: false, maxRows: 10, bodyColumns: 120,
  scroll: { offset: 0, bodyRows: 10 }, view: {}
}

function readings(on: On, now = 0, host = false) {
  const testClock = mock.clock(on, { now })
  if (!host) on('process.run', () => ({ value: { exitCode: 0, stdout: 'Linux', stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }))
  const state: Record<string, unknown> = {
    limits: [{ kind: 'five_hour', percentUsed: 100 }, { kind: 'seven_day', percentUsed: 100 }],
    segments: [{ name: 'Used', kind: 'used', tokens: 100 }],
    contextPercent: 100,
    panel: null,
    weekOpen: false,
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
  Object.defineProperty(state, '_clock', { value: testClock })
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
  [10, 'W 100%'],
  [7, 'W 100%']
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
    expect(rowWidth(tree)).toBe(62)
    expect(rowText(tree)).not.toMatch(/Day|Ctx/)
    expect(rowText(tree)).toContain('CPU 100%   Mem 100%   Disk 100%')
    checkNoWrap(tree)
  } finally {
    await ui.unmount()
  }
})

test('only the pills show when even Week cannot fit at the minimum scale', async ($, on) => {
  readings(on)
  const ui = await $.ui.mount({
    plugin: 'usage-bars', surface: 'desktop', component: 'AbovePrompt', props,
    viewport: { columns: 12, rows: 24 }
  })
  try {
    const svgs = await ui.findAll({ type: 'Svg' })
    // Windows onto the pills-only picture, one either side of each percent button.
    expect(svgs).toHaveLength(4)
    expect(String(svgs[0]!.props.source)).not.toContain('clipPath id="c0"')
    expect(String(svgs[0]!.props.source)).toContain('>M</text>')
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
      // Windows onto one band picture with a native button in the row between each pair: W when Week fits, and each pill's percent.
      const layout = desktopLayout(columns)
      const buttons = await ui.findAll({ type: 'Button' })
      expect(buttons).toHaveLength(3 + (weekHover(layout) ? 1 : 0))
      expect(svgs.length).toBe(buttons.length + 1)
      // The desktop skips a picture with an empty description.
      for (const svg of svgs) expect(String(svg.props.alt).trim()).not.toBe('')
      // Nothing is laid over the pictures: an overlay never draws on the desktop.
      expect(JSON.stringify(await ui.drawn())).not.toContain('"absolute"')
      // Below the pills' own width nothing fits; the pills still show at their smallest.
      for (const svg of svgs) {
        expect(Number(svg.props.width), `SVG ${svg.props.alt}`).toBeLessThanOrEqual(Math.max(columns * 7 - 16, desktopLayout(1).width))
      }
    } finally { await ui.unmount() }
  })
}

test('desktop pills open, switch, toggle and close the plain drawer through the real hook', async ($, on) => {
  const state = readings(on)
  state.system = { cpu: 18, cores: 8, memory: 71, memoryGb: 32, disk: { percent: 83, freeGb: 170 }, battery: null }
  const ui = await $.ui.mount({ plugin: 'usage-bars', surface: 'desktop', component: 'AbovePrompt', props, viewport: { columns: 160, rows: 24 } })
  try {
    expect((await ui.findAll({ type: 'Button' })).map(b => b.key)).toEqual(['usage-week', 'usage-cpu', 'usage-mem', 'usage-disk'])
    // Every press area shows text: whitespace-only buttons never answered a press on the desktop.
    expect((await ui.findAll({ type: 'Button' })).map(b => b.text.trim())).toEqual(['W', '18%', '71%', '83%'])
    await ui.press({ key: 'usage-mem' })
    expect(state.panel).toBe('mem')
    await ui.redraw() // The mocked state store does not send the host's subscription notification.
    expect((await svgAlts(ui)).find(a => /^(CPU|Memory|Disk) /.test(a))).toBe('Memory 71% used \u00b7 23 of 32 GB')
    await ui.press({ key: 'usage-mem' })
    expect(state.panel).toBe(null)
    await ui.redraw()
    expect(await ui.find({ key: 'usage-close' })).toBe(undefined)
    await ui.press({ key: 'usage-cpu' })
    expect(state.panel).toBe('cpu')
    await ui.press({ key: 'usage-disk' })
    expect(state.panel).toBe('disk')
    await ui.redraw()
    expect((await svgAlts(ui)).find(a => /^(CPU|Memory|Disk) /.test(a))).toBe('Disk 83% used \u00b7 170 GB free')
    await ui.press({ key: 'usage-close' })
    expect(state.panel).toBe(null)
    await ui.redraw()
    expect(await ui.find({ key: 'usage-close' })).toBe(undefined)
  } finally { await ui.unmount() }
})

test('desktop All opens the machines drawer, and a pill closes it again', async ($, on) => {
  const state = readings(on, 100_000)
  state.system = { cpu: 18, cores: 8, memory: 71, memoryGb: 32, disk: { percent: 83, freeGb: 170 }, battery: null }
  state.machines = [
    { name: '26', cpu: 18, memory: 71, disk: 83, at: 99_000 },
    { name: 'PC', cpu: 91, memory: 40, disk: 30, at: 60_000 },
    { name: '21', cpu: 50, memory: 50, disk: 50, at: 9_000 },
    { name: 'M2', cpu: null, memory: null, disk: null, at: null }
  ]
  state.machinesOpen = false
  const ui = await $.ui.mount({ plugin: 'usage-bars', surface: 'desktop', component: 'AbovePrompt', props, viewport: { columns: 160, rows: 24 } })
  try {
    expect((await ui.findAll({ type: 'Button' })).map(b => b.text.trim())).toEqual(['W', 'All', '18%', '71%', '83%'])
    // 21 last reported 91 s ago, past the 90 s limit, so it draws as off.
    expect((await svgAlts(ui))[0]).toContain('26 71%, PC 91%, 21 off, M2 off')
    await ui.press({ key: 'usage-machines' })
    expect(state.machinesOpen).toBe(true)
    await ui.redraw()
    expect(await svgAlts(ui)).toContain('26 CPU 18%, memory 71%, disk 83%; PC CPU 91%, memory 40%, disk 30%; 21 off; M2 off')
    await ui.press({ key: 'usage-cpu' })
    expect(state.machinesOpen).toBe(false)
    expect(state.panel).toBe('cpu')
    await ui.redraw()
    expect((await svgAlts(ui)).some(a => a.startsWith('26 CPU'))).toBe(false)
  } finally { await ui.unmount() }
})

// FNV-1a over the entire serialized tree pins every terminal node, prop and text byte.
// Re-captured 9 Nov 2026 when Day and Ctx left the terminal band; the rows read
// "Week <10-cell bar> 100%   $1.2k   CPU 100%   Mem 100%   Disk 100%" at 80+ columns down to "W <4-cell bar> 100%" at 12.
function terminalBytes(node: RenderNode): number {
  let hash = 2166136261
  for (const ch of JSON.stringify(node)) hash = Math.imul(hash ^ ch.charCodeAt(0), 16777619)
  return hash >>> 0
}
for (const [columns, snapshot] of [
  [120, 3912503222], [80, 3912503222], [60, 3169434595], [40, 3169434595],
  [30, 3169434595], [20, 2787173288], [12, 1883607158]
] as const) {
  test(`terminal tree bytes match the Week-only band at ${columns} columns`, async ($, on) => {
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
    expect((await ui.findAll({ type: 'Button' })).map(b => b.key)).toEqual(['usage-week', 'usage-mem'])
    expect(await ui.find({ key: 'usage-cpu' })).toBe(undefined)
    expect(String((await ui.findAll({ type: 'Svg' }))[0]!.props.alt)).not.toContain('CPU')
    await ui.press({ key: 'usage-mem' })
    await ui.redraw()
    expect((await svgAlts(ui)).find(a => /^(CPU|Memory|Disk) /.test(a))).toBe('Memory 71% used \u00b7 23 of 32 GB')
    state.system = null
    await ui.redraw()
    expect((await ui.findAll({ type: 'Button' })).map(b => b.key)).toEqual(['usage-week'])
    expect((await svgAlts(ui)).some(a => a.startsWith('Memory '))).toBe(false)
  } finally { await ui.unmount() }
})

test('pressing Week opens a one-line detail card under the band and pressing again closes it', async ($, on) => {
  const state = readings(on)
  const ui = await $.ui.mount({ plugin: 'usage-bars', surface: 'desktop', component: 'AbovePrompt', props, viewport: { columns: 160, rows: 24 } })
  try {
    const open = async () => (await ui.findAll({ type: 'Svg' })).some(s => String(s.props.alt).startsWith('Today'))
    expect(await open()).toBe(false)
    await ui.press({ key: 'usage-week' })
    expect(state.weekOpen).toBe(true)
    await ui.redraw()
    expect(await open()).toBe(true)
    await ui.press({ key: 'usage-week' })
    await ui.redraw()
    expect(await open()).toBe(false)
  } finally { await ui.unmount() }
})



const TEST_HOME = '/Users/tester'
const OLD = 1
const NOW = 60 * 86400000
function cleanupHost(on: On, platform = 'Darwin', extras = false) {
  const state = readings(on, NOW, true)
  const calls: string[][] = []
  const live = new Set(['pip', 'Yarn'])
  let failAction = false
  let changePid = false
  let simGone = false; let treeGone = false
  const simId = '00000000-0000-0000-0000-000000000001'
  const stat = (path: string) => ({ kind: 'dir' as const, size: 0, mtimeMs: OLD, isLink: false, realPath: path })
  on('env.get', (_, e) => ({ value: e.name === 'HOME' ? TEST_HOME : e.name === 'TMPDIR' ? '/private/tmp/plugin-test' : undefined }))
  on('session.cwd', () => ({ value: '/session' }))
  on('fs.stat', (_, e) => {
    if (extras && [ `${TEST_HOME}/repo`, `${TEST_HOME}/repo/.git`, '/old-tree', `${TEST_HOME}/Library/Developer/CoreSimulator/Devices/${simId}/data`].includes(e.path)) return { value: stat(e.path) }
    if ([TEST_HOME, '/private/tmp/plugin-test', '/session'].includes(e.path) || [...live].some(n => e.path === `${TEST_HOME}/Library/Caches/${n}`)) return { value: stat(e.path) }
    return { value: { kind: 'other', size: 0, mtimeMs: 0, isLink: false } }
  })
  on('fs.list', (_, e) => ({ value: extras && e.path === TEST_HOME ? [{ name: 'repo', ...stat(`${TEST_HOME}/repo`) }] : [] }))
  const ps = () => `42 1 501 1800000 15 Sun Nov 8 12:00:00 2026 /Applications/Browser.app/Contents/MacOS/Browser\n43 1 501 1000000 1 Sun Nov 8 12:00:00 2026 Terminal\n99 1 501 1000 1 Sun Nov 8 12:00:00 2026 plugin-host`.replace(/\\n/g, '\n')
  on('process.run', (_, e) => {
    const a = [...e.argv]; calls.push(a)
    let stdout = ''
    let exitCode = 0
    if (a[0] === 'uname') stdout = platform
    else if (a[0] === 'id') stdout = '501'
    else if (a[0] === 'python3') stdout = '99'
    else if (a[0] === 'du') stdout = `${live.has(a[a.length - 1]!.split('/').pop()!) || (extras && (a.includes('/old-tree') || a.some(p => p.includes('CoreSimulator')))) ? 1000000 : 0}\tcache`
    else if (a[0] === 'ps') stdout = changePid && a.includes('-p') ? ps().replace('12:00:00', '12:00:01') : ps()
    else if (a[0] === 'rm') {
      if (failAction) exitCode = 1
      else live.delete(a[a.length - 1]!.split('/').pop()!)
    } else if (a[0] === 'xcrun') {
      if (a.includes('delete')) simGone = true
      stdout = JSON.stringify({ devices: { runtime: extras && !simGone ? [{ name: 'Old phone', udid: simId, state: 'Shutdown', isAvailable: true }] : [] } })
    } else if (a[0] === 'git') {
      if (a.includes('list')) stdout = `worktree /main${treeGone ? '' : '\n\nworktree /old-tree'}`
      else if (a.includes('rev-parse')) stdout = 'origin/feature'
      else if (a.includes('remove')) treeGone = true
    }
    return { value: { exitCode, stdout, stderr: exitCode ? 'denied' : '', isStdoutTruncated: false, isStderrTruncated: false } }
  })
  return { state, calls, live, fail: () => { failAction = true }, reuse: () => { changePid = true } }
}
const actions = (calls: string[][]) => calls.filter(a => ['rm', 'kill', 'brew', 'npm', 'yarn'].includes(a[0]!) || (a[0] === 'git' && a.includes('remove')) || (a[0] === 'xcrun' && a.includes('delete')))
const mountCleanup = ($: any) => $.ui.mount({ plugin: 'usage-bars', surface: 'desktop', component: 'AbovePrompt', props, viewport: { columns: 160, rows: 40 } })
test('S1 render and clocks do not scan; a pill scans read-only and selection controls exact cleanup', async ($, on) => {
  const h = cleanupHost(on)
  const ui = await mountCleanup($)
  try {
    expect(h.calls).toHaveLength(0)
    await (h.state._clock as ReturnType<typeof mock.clock>).advance(10000)
    expect(h.calls).toHaveLength(0)
    await ui.press({ key: 'usage-disk' }); await ui.redraw()
    expect(h.calls.some(a => a[0] === 'du'), JSON.stringify(h.calls) + JSON.stringify(h.state.cleanupView)).toBe(true)
    expect(actions(h.calls)).toHaveLength(0)
    const rows = await ui.findAll({ type: 'Button', text: /^\u25cf/ })
    expect(rows).toHaveLength(2)
    await ui.press({ key: rows[1]!.key! }); await ui.redraw()
    await ui.press({ key: 'usage-clean' }); await ui.redraw()
    expect(actions(h.calls)).toHaveLength(1)
    expect(actions(h.calls)[0]).toEqual(['rm', '-r', '--', `${TEST_HOME}/Library/Caches/pip`])
    expect(await ui.find({ type: 'Text', text: 'Freed 1 GB' })).not.toBe(undefined)
    expect(h.live.has('Yarn')).toBe(true)
  } finally { await ui.unmount() }
})
test('S3/S4 worktree and simulator sections start unticked and each requires its own confirmation', async ($, on) => {
  const h = cleanupHost(on, 'Darwin', true)
  const ui = await mountCleanup($)
  try {
    await ui.press({ key: 'usage-disk' }); await ui.redraw()
    expect(await ui.find({ type: 'Text', text: 'Old worktrees' })).not.toBe(undefined)
    expect(await ui.find({ type: 'Text', text: 'Old simulators' })).not.toBe(undefined)
    expect(await ui.find({ key: 'usage-remove-worktree' })).toBe(undefined)
    expect(await ui.find({ key: 'usage-remove-sim' })).toBe(undefined)
    expect(await ui.findAll({ type: 'Button', text: /^\u25cb/ })).toHaveLength(2)
    await ui.press({ key: 'usage-clean' }); await ui.redraw()
    expect(actions(h.calls).every(a => a[0] === 'rm')).toBe(true)
    for (const [kind,id] of [['sim','sim-00000000-0000-0000-0000-000000000001'],['worktree','worktree-0']]) {
      await ui.press({ key: `usage-item-${id}` }); await ui.redraw()
      const before = actions(h.calls).length
      await ui.press({ key: `usage-remove-${kind}` }); await ui.redraw()
      expect((await ui.find({ key: `usage-remove-${kind}` }))?.text).toBe('Sure?')
      expect(actions(h.calls)).toHaveLength(before)
      await ui.press({ key: `usage-remove-${kind}` }); await ui.redraw()
      expect(actions(h.calls)).toHaveLength(before + 1)
    }
    expect(actions(h.calls).filter(a => a[0] !== 'rm')).toEqual([
      ['xcrun','simctl','delete','00000000-0000-0000-0000-000000000001'],
      ['git','-C',`${TEST_HOME}/repo`,'worktree','remove','--','/old-tree']
    ])
  } finally { await ui.unmount() }
})
test('S5 Quit needs a second press within five seconds and re-reads PID identity', async ($, on) => {
  const h = cleanupHost(on)
  const ui = await mountCleanup($)
  try {
    await ui.press({ key: 'usage-mem' }); await ui.redraw()
    expect(await ui.find({ key: 'usage-quit-43' })).toBe(undefined)
    expect((await ui.findAll({ type: 'Svg' })).some((p: any) => String(p.props.alt).endsWith(', protected') && String(p.props.source).includes('>protected</text>'))).toBe(true)
    await ui.press({ key: 'usage-quit-42' }); await ui.redraw()
    expect((await ui.find({ key: 'usage-quit-42' }))?.text).toBe('Sure?')
    expect(actions(h.calls)).toHaveLength(0)
    await (h.state._clock as ReturnType<typeof mock.clock>).advance(5001); await ui.redraw()
    expect((await ui.find({ key: 'usage-quit-42' }))?.text).toBe('Quit')
    await ui.press({ key: 'usage-quit-42' })
    expect(actions(h.calls)).toHaveLength(0)
    await ui.press({ key: 'usage-quit-42' }); await ui.redraw()
    expect(actions(h.calls)).toEqual([['kill', '-TERM', '42']])
    expect(h.calls.some(a => a[0] === 'ps' && a.includes('-p') && a.includes('42'))).toBe(true)
  } finally { await ui.unmount() }
})
test('S5 changed PID identity never receives a signal', async ($, on) => {
  const h = cleanupHost(on)
  const ui = await mountCleanup($)
  try {
    await ui.press({ key: 'usage-cpu' }); await ui.redraw()
    await ui.press({ key: 'usage-quit-42' }); h.reuse()
    await ui.press({ key: 'usage-quit-42' }); await ui.redraw()
    expect(actions(h.calls)).toHaveLength(0)
  } finally { await ui.unmount() }
})
test('S7 failure is plain, stops the batch, and never retries on render or clock', async ($, on) => {
  const h = cleanupHost(on); h.fail()
  const ui = await mountCleanup($)
  try {
    await ui.press({ key: 'usage-disk' }); await ui.redraw()
    await ui.press({ key: 'usage-clean' }); await ui.redraw()
    expect(actions(h.calls)).toHaveLength(1)
    expect(await ui.find({ type: 'Text', text: 'Could not clear this item.' })).not.toBe(undefined)
    const count = h.calls.length
    await (h.state._clock as ReturnType<typeof mock.clock>).advance(10000); await ui.redraw()
    expect(h.calls).toHaveLength(count)
    expect(await ui.find({ key: 'usage-clean' })).toBe(undefined)
  } finally { await ui.unmount() }
})
test('non-macOS drawers keep readings and never scan or offer actions', async ($, on) => {
  const h = cleanupHost(on, 'Linux')
  const ui = await mountCleanup($)
  try {
    await ui.press({ key: 'usage-cpu' }); await ui.redraw()
    expect((await svgAlts(ui)).find(a => /^(CPU|Memory|Disk) /.test(a))).toContain('100% busy')
    expect(h.calls).toEqual([['uname', '-s']])
    expect(await ui.find({ key: 'usage-refresh' })).toBe(undefined)
  } finally { await ui.unmount() }
})
