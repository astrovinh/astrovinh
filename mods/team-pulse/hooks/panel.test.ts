import { test, expect, mock } from 'claude-code/testing'
import type { On } from 'claude-code'
import type { Snapshot } from '../types'
import { STRIP_SVG_W } from './draw'

const NOW = 1_800_000_000_000
const view: Snapshot = {
  team: 'Murror', now: NOW, you: 'm1',
  members: [{ id: 'm1', name: 'Linh', status: 'at lunch', statusAt: NOW }],
  sessions: [
    { id: 's1', member: 'm1', project: '', branch: 'main', line: 'Planning the next research study', state: 'working', stateSince: NOW, fiveHour: 64, week: 41, startedAt: NOW - 60_000, seenAt: NOW },
    { id: 's2', member: 'm1', project: '', branch: 'notes', line: 'Writing the interview questions', state: 'idle', stateSince: NOW, fiveHour: 64, week: 41, startedAt: NOW - 120_000, seenAt: NOW - 1 }
  ],
  segments: [{ session: 's1', member: 'm1', start: NOW - 3_600_000, end: NOW, state: 'working' }]
}

const prepare = (on: On, snapshot = view, open = false, signalsHidden = false) => {
  mock.store(on, { membership: { memberId: 'm1' }, signalsHidden })
  let expanded = open ? ['m1'] : []
  // The test dispatcher wraps state reads and writes in a value envelope.
  on('state.get', { plugin: 'murror', key: 'snapshot' }, () => ({ value: { value: snapshot, version: 1 }, version: 1 }))
  on('state.get', { plugin: 'murror', key: 'fetchedAt' }, () => ({ value: { value: 0, version: 1 }, version: 1 }))
  on('state.get', { plugin: 'murror', key: 'problem' }, () => ({ value: { value: null, version: 1 }, version: 1 }))
  on('state.get', { plugin: 'murror', key: 'expanded' }, () => ({ value: { value: expanded, version: 1 }, version: 1 }))
  on('state.set', { plugin: 'murror', key: 'expanded' }, (_, e) => {
    expanded = e.value
    return { value: { isSet: true, version: 2 }, version: 2 }
  })
}

test('collapsed rows show note, work, strip and More on desktop and terminal', async ($, on) => {
  prepare(on)
  for (const surface of ['desktop', 'terminal'] as const) {
    const ui = await $.ui.mount({ plugin: 'murror', surface, component: 'Pane', requestId: 'team', props: { title: 'Team', isFocused: true, bodyColumns: 80, placement: 'dock', scroll: { offset: 0, bodyRows: 40 }, view: {} } })
    expect((await ui.find({ key: 'expand:m1' }))?.text).toBe('More')
    const tree = JSON.stringify(await ui.drawn())
    expect(tree.includes('at lunch')).toBe(true)
    expect(tree.includes('Planning the next research study')).toBe(true)
    expect(tree.includes('12h')).toBe(true)
    expect(tree.includes('Week') || tree.includes('64%') || tree.includes('main') || tree.includes('Writing the interview questions')).toBe(false)
    expect(tree.includes('live') || tree.includes('(you)')).toBe(false)
    expect(tree.indexOf('at lunch') < tree.indexOf('Planning the next research study')).toBe(true)
    expect(tree.indexOf('Planning the next research study') < tree.indexOf('12h')).toBe(true)
    await ui.unmount()
  }
})

test('More opens details and Less closes them through the existing press handler', async ($, on) => {
  prepare(on)
  for (const surface of ['desktop', 'terminal'] as const) {
    const target = { plugin: 'murror', surface, component: 'Pane' as const, requestId: 'team', props: { title: 'Team', isFocused: true, bodyColumns: 80, placement: 'dock' as const, scroll: { offset: 0, bodyRows: 40 }, view: {} } }
    let ui = await $.ui.mount(target)
    await ui.press({ key: 'expand:m1' })
    await ui.unmount()
    ui = await $.ui.mount(target)
    expect((await ui.find({ key: 'expand:m1' }))?.text).toBe('Less')
    const tree = JSON.stringify(await ui.drawn())
    expect(tree.includes('main') && tree.includes('2 sessions')).toBe(true)
    expect(tree.includes('Week') && tree.includes('64%')).toBe(true)
    expect(tree.includes('Claude activity 1.0h in the last 12 hours')).toBe(true)
    expect(tree.indexOf('12h') < tree.indexOf('main')).toBe(true)
    expect(tree.indexOf('main') < tree.indexOf('Week')).toBe(true)
    expect(tree.indexOf('Week') < tree.indexOf('Claude activity 1.0h')).toBe(true)
    expect(tree.indexOf('Claude activity 1.0h') < tree.indexOf('Writing the interview questions')).toBe(true)
    await ui.press({ key: 'expand:m1' })
    await ui.unmount()
    ui = await $.ui.mount(target)
    expect((await ui.find({ key: 'expand:m1' }))?.text).toBe('More')
    expect(JSON.stringify(await ui.drawn()).includes('Claude activity 1.0h')).toBe(false)
    await ui.unmount()
  }
})

test('an offline row still offers More and keeps the not-running work line', async ($, on) => {
  prepare(on, { ...view, sessions: [], segments: [] })
  const ui = await $.ui.mount({ plugin: 'murror', surface: 'terminal', component: 'Pane', requestId: 'team', props: { title: 'Team', isFocused: true, bodyColumns: 80, placement: 'dock', scroll: { offset: 0, bodyRows: 40 }, view: {} } })
  expect((await ui.find({ key: 'expand:m1' }))?.text).toBe('More')
  expect(await ui.find({ type: 'Text', text: 'Not running Claude Code' })).toBeDefined()
  await ui.unmount()
})

test('a shared local clock replaces last-seen text at the right of the name', async ($, on) => {
  const instant = Date.UTC(2026, 9, 6, 15, 40)
  prepare(on, { ...view, now: instant, members: [{ id: 'm1', name: 'Linh', tz: 'Asia/Ho_Chi_Minh' }], sessions: [], segments: [] })
  for (const surface of ['desktop', 'terminal'] as const) {
    const ui = await $.ui.mount({ plugin: 'murror', surface, component: 'Pane', requestId: 'team', props: { title: 'Team', isFocused: true, bodyColumns: 80, placement: 'dock', scroll: { offset: 0, bodyRows: 40 }, view: {} } })
    expect(await ui.find({ type: 'Text', text: 'VN 10:40 PM' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: 'not active yet' })).toBeUndefined()
    await ui.unmount()
  }
})

const signalView: Snapshot = {
  ...view,
  members: [{ id: 'm1', name: 'Linh' }, { id: 'k', name: 'Khanh' }, { id: 'b', name: 'Brian' }],
  signals: [
    { id: 'h3', kind: 'handoff', from: 'k', to: 'm1', text: 'Third note', at: NOW - 180_000 },
    { id: 'h1', kind: 'handoff', from: 'k', to: 'm1', text: 'Newest note', at: NOW - 60_000 },
    { id: 'h2', kind: 'handoff', from: 'b', to: 'm1', text: 'Second note', at: NOW - 120_000 },
    { id: 'sent', kind: 'handoff', from: 'm1', to: 'b', text: 'Outgoing note', at: NOW },
    { id: 'expired', kind: 'handoff', from: 'b', to: 'm1', text: 'Expired note', at: NOW - 7 * 86_400_000 },
    { id: 'win1', kind: 'win', from: 'b', to: '', text: 'Their draft is ready', at: NOW },
    { id: 'win2', kind: 'win', from: 'k', to: '', text: 'Her study is ready', at: NOW - 1 },
    { id: 'wave1', kind: 'wave', from: 'k', to: 'm1', text: '', at: NOW },
    { id: 'wave2', kind: 'wave', from: 'b', to: 'k', text: '', at: NOW }
  ]
}
const target = (surface: 'desktop' | 'terminal') => ({ plugin: 'murror', surface, component: 'Pane' as const, requestId: 'team', props: { title: 'Team', isFocused: true, bodyColumns: 80, placement: 'dock' as const, scroll: { offset: 0, bodyRows: 50 }, view: {} } })

for (const open of [false, true]) {
  test(`the ${open ? 'Less' : 'More'} button stays after the shrinkable strip in the same row`, async ($, on) => {
    prepare(on, view, open)
    for (const surface of ['desktop', 'terminal'] as const) {
      const pane = target(surface)
      const ui = await $.ui.mount({ ...pane, props: { ...pane.props, bodyColumns: 40 } })
      const line = (await ui.findAll({ type: 'Box' })).find(box =>
        box.children.length === 2 &&
        JSON.stringify(box.children[0]).includes(surface === 'desktop' ? 'Claude activity in the last 12 hours' : '12h ') &&
        JSON.stringify(box.children[1]).includes('expand:m1')
      )
      expect(line).toBeDefined()
      expect(line?.children[0]).toMatchObject({ type: 'Box', props: { flexShrink: 1 } })
      expect(line?.children[1]).toMatchObject({
        type: 'Box', props: { flexShrink: 0 },
        children: [{ type: 'Button', props: { key: 'expand:m1', plain: true, label: open ? 'Less' : 'More' } }]
      })
      if (surface === 'desktop') {
        expect(line?.children[0]).toMatchObject({ children: [{ type: 'Svg', props: { width: STRIP_SVG_W } }] })
      }
      await ui.unmount()
    }
  })
}

test('the terminal twenty-cell strip plus More fits in forty columns', async ($, on) => {
  prepare(on)
  const pane = target('terminal')
  const ui = await $.ui.mount({ ...pane, props: { ...pane.props, bodyColumns: 40 } })
  const strip = await ui.find({ type: 'Text', text: '12h ' })
  const button = await ui.find({ key: 'expand:m1' })
  expect(strip?.text).toMatch(/^12h [\u2500\u2501\u2504]{20} $/)
  expect(button?.text).toBe('More')
  // Include the row's two columns of padding on each side.
  expect(4 + strip!.text.length + button!.text.length).toBeLessThanOrEqual(40)
  await ui.unmount()
})

test('the panel shows the two newest addressed handoffs under the header, then more and the win shelf', async ($, on) => {
  prepare(on, signalView)
  for (const surface of ['desktop', 'terminal'] as const) {
    const ui = await $.ui.mount(target(surface))
    expect((await ui.find({ key: 'take:h1' }))?.text).toBe('Take')
    expect((await ui.find({ key: 'dismiss:h1' }))?.text).toBe('Dismiss')
    expect((await ui.find({ key: 'take:h2' }))?.text).toBe('Take')
    expect(await ui.find({ key: 'take:h3' })).toBeUndefined()
    expect(await ui.find({ type: 'Text', text: 'FOR YOU \u00b7 FROM KHANH \u00b7 1m ago' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: '+1 more' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: 'WIN' })).toBeDefined()
    const tree = JSON.stringify(await ui.drawn())
    expect(tree.includes('Brian: Their draft is ready') && tree.includes('+1')).toBe(true)
    expect(tree.includes('Outgoing note') || tree.includes('Third note') || tree.includes('Expired note') || tree.includes('Her study is ready')).toBe(false)
    expect(tree.indexOf('Murror') < tree.indexOf('FOR YOU')).toBe(true)
    expect(tree.indexOf('Newest note') < tree.indexOf('Second note')).toBe(true)
    expect(tree.indexOf('Second note') < tree.indexOf('WIN')).toBe(true)
    await ui.unmount()
  }
})

test('live waves mark sender avatars for the whole team and name the wave only for its receiver', async ($, on) => {
  prepare(on, signalView)
  for (const surface of ['desktop', 'terminal'] as const) {
    const ui = await $.ui.mount(target(surface))
    expect((await ui.findAll({ type: 'Text', text: 'waved at you' })).filter(e => e.text?.trim() === 'waved at you')).toHaveLength(1)
    const tree = JSON.stringify(await ui.drawn())
    if (surface === 'desktop') expect(tree.split('avatar, waved').length - 1).toBe(2)
    expect(tree.includes('waved at you')).toBe(true)
    await ui.unmount()
  }
})

test('signals hidden on this Mac removes waves and wins but keeps handoffs and their buttons', async ($, on) => {
  prepare(on, signalView, false, true)
  for (const surface of ['desktop', 'terminal'] as const) {
    const ui = await $.ui.mount(target(surface))
    expect((await ui.find({ key: 'take:h1' }))?.text).toBe('Take')
    expect((await ui.find({ key: 'dismiss:h2' }))?.text).toBe('Dismiss')
    const tree = JSON.stringify(await ui.drawn())
    expect(tree.includes('WIN') || tree.includes('waved at you') || tree.includes('avatar, waved') || tree.includes('Their draft is ready')).toBe(false)
    await ui.unmount()
  }
})

test('the panel stops drawing expired waves and wins using elapsed server time', async ($, on) => {
  prepare(on, { ...signalView, signals: signalView.signals!.map(s => ({ ...s, at: NOW - 48 * 3_600_000 })) })
  const ui = await $.ui.mount(target('desktop'))
  const tree = JSON.stringify(await ui.drawn())
  expect(tree.includes('WIN') || tree.includes('waved at you') || tree.includes('avatar, waved')).toBe(false)
  expect((await ui.find({ key: 'take:h1' }))?.text).toBe('Take')
  await ui.unmount()
})

test('a narrow win shelf keeps the other-wins suffix separate from its truncated note', async ($, on) => {
  prepare(on, { ...signalView, signals: signalView.signals!.map(s => s.id === 'win1' ? { ...s, text: 'x'.repeat(120) } : s) })
  for (const surface of ['desktop', 'terminal'] as const) {
    const pane = target(surface)
    const ui = await $.ui.mount({ ...pane, props: { ...pane.props, bodyColumns: 24 } })
    expect((await ui.findAll({ type: 'Text', text: '+1' })).filter(e => e.text?.trim() === '+1')).toHaveLength(1)
    await ui.unmount()
  }
})
