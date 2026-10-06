import { test, expect, mock } from 'claude-code/testing'
import type { On } from 'claude-code'
import type { Snapshot } from '../types'

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

const prepare = (on: On, snapshot = view, open = false) => {
  mock.store(on, { membership: { memberId: 'm1' } })
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
