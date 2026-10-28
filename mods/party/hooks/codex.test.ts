import { test, expect } from 'claude-code/testing'
import { parseScan, codexRows, observeCodex, acknowledgeCodex, pythonResolveArgv, pickPython } from './codex'
import { statusLine } from './sessions'

const NOW = 1_800_000_000_000
const run = (id: string, extra: Record<string, any> = {}) => ({ id, parentId: null, kind: 'run' as const, role: null, nickname: null, label: null, startedAt: NOW - 60000, lastAt: NOW, cmds: 3, spawned: 0, done: false, tokens: null, ...extra })
const ack = () => ({ through: 0, ready: {} as Record<string, number> })

test('parseScan allowlists facts and rejects invalid scans without erasing the last view', () => {
  const rows = parseScan(JSON.stringify({ runs: [{ ...run('r'), raw: 'SYNTHETIC_SECRET' }] }))!
  expect(rows).toHaveLength(1)
  expect(JSON.stringify(rows).includes('SYNTHETIC_SECRET')).toBe(false)
  expect(parseScan('{broken')).toBe(null)
  expect(parseScan('{}')).toBe(null)
  expect(parseScan('{"runs":[]}')).toEqual([])
  expect(parseScan(JSON.stringify({ runs: [run('r', { cmds: -1 }), null] }))).toBe(null)
})

test('Codex is running through 45 seconds and idle immediately after, never failed', () => {
  for (const age of [0, 44999, 45000, 45001, 540000]) {
    const row = codexRows([run('r', { lastAt: NOW - age })], NOW, ack()).rows[0]!
    expect(row.state).toBe(age <= 45000 ? 'running' : 'idle')
  }
  expect(codexRows([run('r', { done: true })], NOW, ack()).rows[0]!.state).toBe('completed')
})

test('parentId nests each helper and grandchild below its run regardless of input order', () => {
  const runs = [run('b', { startedAt: NOW - 20000 }), run('grand', { kind: 'helper', parentId: 'helper', startedAt: NOW - 10000 }), run('helper', { kind: 'helper', parentId: 'a', startedAt: NOW - 30000 }), run('a'), run('orphan', { kind: 'helper', parentId: 'missing' })]
  const rows = codexRows(runs, NOW, ack()).rows
  expect(rows.map(r => r.id)).toEqual(['a', 'helper', 'grand', 'b'])
  expect(rows.map(r => r.depth)).toEqual([0, 1, 2, 0])
})

test('finished rows expire at five minutes and the most recent eight parent runs stay ordered', () => {
  expect(codexRows([run('r', { done: true, lastAt: NOW - 299999 })], NOW, ack()).rows).toHaveLength(1)
  expect(codexRows([run('r', { done: true, lastAt: NOW - 300000 })], NOW, ack()).rows).toHaveLength(0)
  const runs = Array.from({ length: 10 }, (_, i) => run(String(i), { startedAt: NOW - 10000 + i }))
  expect(codexRows(runs.reverse(), NOW, ack()).rows.map(r => r.id)).toEqual(['2', '3', '4', '5', '6', '7', '8', '9'])
})

test('Codex reuses builder reviewer helper animals and keeps spare reservations after expiry', () => {
  const runs = [run('old', { done: true, lastAt: NOW - 300000, startedAt: NOW - 400000 }), run('new'), run('review', { kind: 'helper', parentId: 'new', role: 'SENTINEL' }), run('helper', { kind: 'helper', parentId: 'new', role: 'worker' }), run('review2', { kind: 'helper', parentId: 'new', role: 'code-review' })]
  const rows = codexRows(runs, NOW, ack()).rows
  expect(['new', 'review', 'helper', 'review2'].map(id => rows.find(r => r.id === id)!.animal)).toEqual(['mochi', 'pan', 'pip', 'mochi'])
  expect(codexRows([run('first')], NOW, ack()).rows[0]!.animal).toBe('bruno')
})

test('Codex names lines and metadata contain only approved labels roles counts and elapsed', () => {
  const runs = [run('r', { label: 'task-38' }), run('h', { kind: 'helper', parentId: 'r', nickname: 'Review', role: 'sentinel' })]
  const rows = codexRows(runs, NOW, ack()).rows
  expect([rows[0]!.name, rows[0]!.line, rows[0]!.meta]).toEqual(['task-38', 'Implementing the brief', '3 cmds \u00b7 1m 0s'])
  expect([rows[1]!.name, rows[1]!.line]).toEqual(['Review', 'sentinel reviewer'])
  expect(codexRows([run('r')], NOW, ack()).rows[0]!.name).toBe('Codex run')
  expect(codexRows([run('r', { done: true })], NOW, ack()).rows[0]!.line).toBe('Ready for review')
  expect(codexRows([run('r', { lastAt: NOW - 45001 })], NOW, ack()).rows[0]!.line).toBe('Idle')
  const helpers = codexRows([run('r'), run('h', { kind: 'helper', parentId: 'r', role: 'worker' }), run('h2', { kind: 'helper', parentId: 'r' })], NOW, ack()).rows
  expect([helpers[1]!.name, helpers[1]!.line, helpers[2]!.name, helpers[2]!.line]).toEqual(['worker', 'worker', 'Codex helper', 'Codex helper'])
})

test('ready completions survive row expiry until prompt acknowledgement and can finish again', () => {
  let state = observeCodex([run('r', { done: true }), run('h', { kind: 'helper', done: true })], ack())
  expect(Object.keys(state.ready)).toEqual(['r'])
  state = observeCodex([], state)
  expect(Object.keys(state.ready)).toEqual(['r'])
  state = acknowledgeCodex(state, NOW + 1)
  expect(Object.keys(observeCodex([run('r', { done: true })], state).ready)).toEqual([])
  expect(Object.keys(observeCodex([run('r', { done: true, lastAt: NOW + 2 })], state).ready)).toEqual(['r'])
  expect(Object.keys(ack().ready)).toEqual([])
})

test('ready status line includes Codex working counts and preserves needsYou grammar', () => {
  expect(statusLine([], { working: 1, ready: 1 })).toBe('party: 1 working, codex finished: ready for review')
  expect(statusLine([], { working: 0, ready: 1 })).toBe('party: codex finished: ready for review')
  expect(statusLine([], { working: 1, ready: 0 })).toBe('party: 1 working, 0 need you')
  const sessions = [{ id: 's', label: 's', at: NOW, agents: [], counts: { total: 1, working: 0, blocked: 1, overflow: 0 } }]
  expect(statusLine(sessions, { working: 0, ready: 1 })).toBe('party: 0 working, 1 needs you, codex finished: ready for review')
  expect(statusLine(sessions)).toBe('party: 0 working, 1 needs you')
})

test('Python resolver uses one silent shell command with the pyenv shim branch', () => {
  expect(typeof pythonResolveArgv).toBe('function')
  const argv = pythonResolveArgv()
  expect(argv.slice(0, 2)).toEqual(['sh', '-c'])
  expect(argv).toHaveLength(3)
  expect(argv[2]!.includes('/shims/')).toBe(true)
  expect(argv[2]!.includes('pyenv which python3')).toBe(true)
})

for (const [commandV, pyenvWhich, expected] of [
  ['/synthetic/.pyenv/shims/python3', '/synthetic/.pyenv/versions/3/bin/python3', '/synthetic/.pyenv/versions/3/bin/python3'],
  ['/synthetic/.pyenv/shims/python3', '', '/synthetic/.pyenv/shims/python3'],
  ['/usr/bin/python3', '/synthetic/other/python3', '/usr/bin/python3'],
  ['', '', 'python3'],
  ['python3', '', 'python3'],
  ['/synthetic/with space/python3', '', 'python3'],
  ['/usr/bin/python3\n/other/python3', '', 'python3'],
  ['/synthetic/.pyenv/shims/python3', '/synthetic/bad path/python3', 'python3'],
]) {
  test(`pickPython validates interpreter choice ${JSON.stringify([commandV, pyenvWhich])}`, () => {
    expect(typeof pickPython).toBe('function')
    expect(pickPython(commandV!, pyenvWhich!)).toBe(expected!)
  })
}

test('quiet Codex runs fold with every helper while nine-minute runs remain Idle', () => {
  const result = codexRows([run('quiet', { lastAt: NOW - 660000 }),
    run('h', { kind: 'helper', parentId: 'quiet' }), run('g', { kind: 'helper', parentId: 'h' }),
    run('visible', { lastAt: NOW - 540000 })], NOW, ack()) as any
  expect(result.quiet).toBe(1)
  expect(result.rows.map((r: any) => [r.id, r.state])).toEqual([['visible', 'idle']])
})
