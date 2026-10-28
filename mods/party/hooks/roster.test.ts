import { test, expect } from 'claude-code/testing'
import { assignAnimals, buildRows, cleanTodos, elapsed, phrase, rememberAgents, slotOf, todoLine, todoProgress, toolKind } from './roster'
import type { AgentRecord, AgentStats, MainFacts } from '../types'

const NOW = 1_800_000_000_000
const agent = (id: string, status: AgentRecord['status'] = 'running', firstSeen = NOW): AgentRecord => ({ id, type: 'Explore', status, description: `Task ${id}`, firstSeen, endedAt: null })
const main: MainFacts = { startedAt: NOW, endedAt: null, working: true }
const rows = (agents: AgentRecord[], stats: Record<string, AgentStats> = {}, now = NOW) => buildRows({ agents, stats, main: null, now })

test('agent types keep their approved job slots', () => {
  for (const [type, slot] of [['Explore', 'scout'], ['Plan', 'planner'], ['general-purpose', 'builder'], ['code-reviewer', 'reviewer'], ['REVIEW', 'reviewer'], ['teammate', 'helper'], ['unknown', 'helper']]) expect(slotOf(type!, false)).toBe(slot)
  expect(slotOf('Explore', true)).toBe('lead')
})

test('spares follow first-seen order and keep their animals after earlier agents finish or expire', () => {
  let memory = rememberAgents([agent('a'), agent('b'), agent('c')], [], NOW)
  expect(rows(memory).rows.map(r => r.name)).toEqual(['Hop', 'Mochi', 'Biscuit'])
  memory = rememberAgents([agent('a', 'completed'), agent('b'), agent('c')], memory, NOW + 1000)
  memory = rememberAgents([agent('c'), agent('b')], memory, NOW + 301001)
  expect(rows(memory, {}, NOW + 301001).rows.map(r => [r.id, r.name])).toEqual([['b', 'Mochi'], ['c', 'Biscuit']])
  const assigned = assignAnimals(Array.from({ length: 7 }, (_, i) => ({ id: String(i), slot: 'helper' as const })))
  expect(assigned.map(a => a.animal)).toEqual(['pip', 'mochi', 'biscuit', 'waddle', 'mochi2', 'biscuit2', 'waddle2'])
})

test('repeated spare animals gain lap numbers while the first agent keeps its slot animal', () => {
  for (const [type, animal, name] of [['Explore', 'hop', 'Hop'], ['Plan', 'sage', 'Sage'], ['general-purpose', 'bruno', 'Bruno'], ['code-reviewer', 'pan', 'Pan'], ['teammate', 'pip', 'Pip']]) {
    const agents = Array.from({ length: 14 }, (_, i) => ({ ...agent(String(i), 'running', NOW + i), type: type! }))
    const result = rows(agents).rows
    expect([result[0]!.animal, result[0]!.name]).toEqual([animal, name])
    expect(result.slice(1, 7).map(r => r.name)).toEqual(['Mochi', 'Biscuit', 'Waddle', 'Mochi', 'Biscuit', 'Waddle'])
    expect(result[7]!.animal).toBe(result[1]!.animal)
    expect(result[7]!.name).toBe('Mochi 2')
    expect(result.slice(8, 12).map(r => r.name)).toEqual(['Biscuit 2', 'Waddle 2', 'Mochi 2', 'Biscuit 2'])
    const memory = agents.map((a, i) => i < 12 ? { ...a, status: 'completed' as const, endedAt: NOW } : a)
    const later = rows(memory, {}, NOW + 300000).rows
    expect(later.map(r => [r.id, r.name])).toEqual([['12', 'Waddle 2'], ['13', 'Mochi 3']])
  }
})

test('animal assignment excludes both coats of a lead species and wraps only the remaining spares', () => {
  const rows = Array.from({ length: 10 }, (_, i) => ({ id: String(i), slot: 'scout' as const }))
  const assigned = assignAnimals(rows, new Set(['cat']))
  expect(assigned.map(row => row.animal)).toEqual(['hop', 'biscuit', 'waddle', 'biscuit2', 'waddle2', 'biscuit', 'waddle', 'biscuit2', 'waddle2', 'biscuit'])
  expect(assigned.map(row => row.name)).toEqual(['Hop', 'Biscuit', 'Waddle', 'Biscuit', 'Waddle', 'Biscuit 2', 'Waddle 2', 'Biscuit 2', 'Waddle 2', 'Biscuit 3'])
})

test('rows retain first-seen order when statuses change', () => {
  const first = [agent('a', 'running', NOW - 2), agent('b', 'pending', NOW - 1), agent('c', 'waiting', NOW)]
  const changed = [agent('c', 'completed', NOW), agent('a', 'waiting', NOW - 2), agent('b', 'running', NOW - 1)]
  expect(rows(first).rows.map(r => r.id)).toEqual(['a', 'b', 'c'])
  expect(rows(changed).rows.map(r => r.id)).toEqual(['a', 'b', 'c'])
})

test('tool kinds and phrases describe activity without reading tool content', () => {
  for (const name of ['Read', 'Grep', 'Glob', 'WebFetch', 'WebSearch']) expect(toolKind(name)).toBe('read')
  for (const name of ['Edit', 'Write', 'NotebookEdit']) expect(toolKind(name)).toBe('edit')
  for (const name of ['Bash', 'BashOutput', 'KillShell']) expect(toolKind(name)).toBe('run')
  for (const name of ['Agent', 'Task', 'TodoWrite', 'unknown']) expect(toolKind(name)).toBe('think')
  expect(['read', 'edit', 'run', 'think'].map(k => phrase(k as 'read'))).toEqual(['Reading', 'Editing', 'Running a command', 'Thinking'])
})

test('todo progress counts completed items and uses only the active form', () => {
  const todos = [{ status: 'completed', activeForm: 'Old' }, { status: 'in_progress', activeForm: 'Writing tests' }, { status: 'pending', activeForm: 'Later' }]
  expect(todoProgress(todos)).toEqual({ done: 1, total: 3 })
  expect(todoLine(todos)).toBe('Writing tests')
  for (const bad of [undefined, null, [], {}, [{ status: 'unknown' }]]) expect(todoProgress(bad)).toBe(null)
  expect(todoLine([{ status: 'completed', activeForm: 'Old' }])).toBe(null)
})

test('cleanTodos retains only status and a string activeForm', () => {
  expect(cleanTodos([
    { status: 'in_progress', activeForm: 'Writing tests', content: 'Private task text', extra: { secret: 'Private value' } },
    { status: 'completed', content: 'Private completed text', other: true },
    { status: 'pending', activeForm: '' },
    null,
    { status: 'invalid', activeForm: 'Invalid status' }
  ])).toEqual([
    { status: 'in_progress', activeForm: 'Writing tests' },
    { status: 'completed' },
    { status: 'pending', activeForm: '' }
  ])
})

test('cleanTodos drops non-string activeForm fields without retaining their values', () => {
  for (const activeForm of [undefined, null, 42, false, ['Private text'], { content: 'Private text' }]) {
    expect(cleanTodos([{ status: 'in_progress', activeForm, content: 'Private task text' }])).toEqual([{ status: 'in_progress' }])
  }
})

test('todoLine returns null for a blank or whitespace-only activeForm', () => {
  for (const activeForm of ['', ' ', ' \t\n ']) {
    expect(todoLine([{ status: 'in_progress', activeForm }])).toBe(null)
  }
  expect(todoLine([{ status: 'in_progress', activeForm: '  Writing tests  ' }])).toBe('Writing tests')
})

test('activity lines prefer todo then description then tool phrase then status', () => {
  const a = agent('a')
  const stats: AgentStats = { tools: 4, tool: 'edit', todos: [{ status: 'in_progress', activeForm: 'Finishing tests' }] }
  expect(rows([a], { a: stats }).rows[0]!.line).toBe('Finishing tests')
  expect(rows([a], { a: { ...stats, todos: [] } }).rows[0]!.line).toBe('Task a')
  expect(rows([{ ...a, description: '' }], { a: { ...stats, todos: [] } }).rows[0]!.line).toBe('Editing')
  expect(rows([{ ...a, description: '' }]).rows[0]!.line).toBe('Working')
})

test('a subagent without a description or telemetry keeps its own status word', () => {
  for (const [state, label] of [['idle', 'Idle'], ['running', 'Working'], ['waiting', 'Blocked'], ['pending', 'Pending'], ['completed', 'Done'], ['failed', 'Failed'], ['killed', 'Stopped']] as const) {
    expect(rows([{ ...agent('a', state), description: '' }]).rows[0]!.line).toBe(label)
  }
})

test('agent rows take tool, tools and todo from their own stats', () => {
  const stats: Record<string, AgentStats> = {
    main: { tool: 'run', tools: 99, todos: [] },
    a: { tool: 'edit', tools: 7, todos: [{ status: 'completed' }, { status: 'in_progress', activeForm: 'Writing tests' }] },
    b: { tool: 'read', tools: 2, todos: [{ status: 'pending' }] }
  }
  const result = rows([agent('a'), agent('b'), agent('c')], stats).rows
  expect(result.map(r => [r.id, r.tool, r.tools, r.todo])).toEqual([
    ['a', 'edit', 7, { done: 1, total: 2 }],
    ['b', 'read', 2, { done: 0, total: 1 }],
    ['c', 'think', 0, null]
  ])
})

test('helper rows keep the Little helper role label', () => {
  for (const type of ['teammate', 'unknown']) {
    const row = rows([{ ...agent('a'), type }]).rows[0]!
    expect(row.slot).toBe('helper')
    expect(row.role).toBe('Little helper')
  }
})

test('elapsed uses seconds, minutes and hours without an invented ETA', () => {
  expect([372000, 48000, 3840000, -10].map(elapsed)).toEqual(['6m 12s', '48s', '1h 4m', '0s'])
})

test('finished agents keep the first end time and expire exactly five minutes later', () => {
  for (const state of ['completed', 'failed', 'killed'] as const) {
    let memory = rememberAgents([agent('a', state)], [], NOW)
    memory = rememberAgents([agent('a', state)], memory, NOW + 299999)
    expect(memory[0]!.endedAt).toBe(NOW)
    expect(rows(memory, {}, NOW + 299999).total).toBe(1)
    expect(rows(memory, {}, NOW + 300000).total).toBe(0)
  }
})

test('a missing agent keeps its reported state without inventing completion', () => {
  const memory = rememberAgents([], [agent('a')], NOW + 1000)
  expect(rows(memory).rows[0]!.state).toBe('running')
  expect(rows(memory).rows[0]!.endedAt).toBe(null)
})

test('an agent returning to running clears its previous end time', () => {
  for (const status of ['completed', 'failed', 'killed'] as const) {
    const completed = rememberAgents([agent('a', status)], [], NOW)
    expect(completed[0]!.endedAt).toBe(NOW)
    const running = rememberAgents([agent('a')], completed, NOW + 3600000)
    expect(running[0]!.endedAt).toBe(null)
    expect(running[0]!.firstSeen).toBe(NOW)
    const row = rows(running, { a: { tools: 1, tool: 'read', todos: [], lastAt: NOW + 3600000 } }, NOW + 3600000).rows[0]!
    expect(row.state).toBe('running')
    expect(row.endedAt).toBe(null)
  }
})

test('live descriptions overwrite remembered descriptions while preserving firstSeen', () => {
  const memory = rememberAgents([agent('a')], [], NOW)
  for (const description of ['Updated task', '']) {
    const updated = rememberAgents([{ ...agent('a'), description }], memory, NOW + 1000)
    expect(updated[0]!.description).toBe(description)
    expect(updated[0]!.firstSeen).toBe(NOW)
    expect(rows(updated).rows[0]!.line).toBe(description || 'Working')
  }
})

test('buildRows drops an expired finished agent missing from the live list at the five-minute boundary', () => {
  const memory = rememberAgents([agent('a', 'completed'), agent('b')], [], NOW)
  const retained = rememberAgents([agent('b')], memory, NOW + 299999)
  expect(rows(retained, {}, NOW + 299999).rows.map(r => r.id)).toEqual(['a', 'b'])
  const expired = rememberAgents([agent('b')], retained, NOW + 300000)
  expect(expired.some(a => a.id === 'a')).toBe(true)
  expect(rows(expired, {}, NOW + 300000).rows.map(r => r.id)).toEqual(['b'])
})

test('the roster caps at twelve rows including main and counts every retained agent', () => {
  const result = buildRows({ agents: Array.from({ length: 15 }, (_, i) => agent(String(i), i === 0 ? 'waiting' : 'running', NOW + i)), stats: {}, main, now: NOW })
  expect(result.rows).toHaveLength(12)
  expect(result.rows[0]!.main).toBe(true)
  expect([result.total, result.working, result.blocked, result.overflow]).toEqual([16, 15, 1, 4])
})

test('fifteen agents keep twelve first-seen rows and count hidden blocked and working agents', () => {
  const agents = Array.from({ length: 15 }, (_, i) => agent(String(i), i === 13 ? 'waiting' : i === 14 ? 'pending' : 'running', NOW + i))
  const result = rows(agents.reverse())
  expect(result.rows.map(r => r.id)).toEqual(Array.from({ length: 12 }, (_, i) => String(i)))
  expect([result.total, result.working, result.blocked, result.overflow]).toEqual([15, 13, 1, 3])
})

test('overflow is zero through twelve agents and counts only rows beyond the cap', () => {
  for (const count of [0, 1, 12, 13]) {
    const result = rows(Array.from({ length: count }, (_, i) => agent(String(i))))
    expect(result.rows.length + result.overflow).toBe(count)
    expect(result.overflow).toBe(Math.max(0, count - 12))
  }
})

test('main row is working or idle from the supplied turn facts', () => {
  for (const working of [true, false]) {
    const r = buildRows({ agents: [], stats: {}, main: { ...main, working }, now: NOW }).rows[0]!
    expect(r.state).toBe(working ? 'running' : 'idle')
    expect(r.animal).toBe('ember')
  }
})

test('main line is Ready when idle and Working when running without a todo or tool phrase', () => {
  for (const working of [false, true]) {
    const row = buildRows({ agents: [], stats: {}, main: { ...main, working }, now: NOW }).rows[0]!
    expect(row.line).toBe(working ? 'Working' : 'Ready')
  }
})

test('main line prefers its active todo, then current work or Ready', () => {
  const stats: AgentStats = { tool: 'run', tools: 5, todos: [{ status: 'in_progress', activeForm: 'Checking tests' }] }
  for (const working of [false, true]) {
    const mainFacts = { ...main, working }
    expect(buildRows({ agents: [], stats: { main: stats }, main: mainFacts, now: NOW }).rows[0]!.line).toBe('Checking tests')
    for (const todos of [[], [{ status: 'in_progress' as const, activeForm: ' \t ' }]]) {
      expect(buildRows({ agents: [], stats: { main: { ...stats, todos } }, main: mainFacts, now: NOW }).rows[0]!.line).toBe(working ? 'Running a command' : 'Ready')
    }
  }
})

test('main row takes tool, tools and todo from stats.main and passes through turn times', () => {
  const stats: Record<string, AgentStats> = {
    main: { tool: 'edit', tools: 8, todos: [{ status: 'completed' }, { status: 'in_progress', activeForm: 'Writing tests' }, { status: 'pending' }] },
    a: { tool: 'read', tools: 99, todos: [] }
  }
  for (const endedAt of [null, NOW + 12000]) {
    const row = buildRows({ agents: [agent('a')], stats, main: { startedAt: NOW - 10000, endedAt, working: endedAt === null }, now: NOW + 20000 }).rows[0]!
    expect(row.id).toBe('main')
    expect([row.tool, row.tools, row.todo]).toEqual(['edit', 8, { done: 1, total: 3 }])
    expect(row.startedAt).toBe(NOW - 10000)
    expect(row.endedAt).toBe(endedAt)
  }
})

test('teammates without telemetry disclose unavailable activity', () => {
  const a = { ...agent('a'), type: 'teammate' }
  expect(rows([a]).rows[0]!.note).toBe('Reported running, activity unavailable')
  expect(rows([a], { a: { tools: 1, tool: 'read', todos: [] } }).rows[0]!.note).toBe(undefined)
})

test('typed teammates also disclose unavailable activity using their teammate id', () => {
  const a = { ...agent('a'), type: 'general-purpose', teammateId: 'builder@team' }
  const row = rows([a]).rows[0]!
  expect(row.slot).toBe('builder')
  expect(row.note).toBe('Reported running, activity unavailable')
})

test('running agents fold at the exact ten-minute boundary and return on activity', () => {
  for (const age of [9 * 60000, 10 * 60000, 11 * 60000]) {
    const result = rows([agent('a')], { a: { tools: 1, tool: 'read', todos: [], lastAt: NOW - age } as AgentStats }) as any
    expect(result.quiet).toBe(age >= 600000 ? 1 : 0)
    expect(result.working).toBe(age >= 600000 ? 0 : 1)
    expect(result.rows.map((r: any) => r.state)).toEqual(age >= 600000 ? [] : ['running'])
    expect(result.quietSince).toBe(age >= 600000 ? NOW - age : null)
  }
})

test('waiting never folds and missing activity uses firstSeen without changing finished expiry', () => {
  const old = NOW - 5 * 3600000
  const result = rows([agent('wait', 'waiting', old), agent('quiet', 'running', old),
    { ...agent('done', 'completed', old), endedAt: NOW - 299999 }], {
      wait: { tools: 1, tool: 'read', todos: [], lastAt: old } as AgentStats
    }) as any
  expect(result.rows.map((r: any) => r.id)).toEqual(['wait', 'done'])
  expect([result.quiet, result.blocked, result.working, result.quietSince]).toEqual([1, 1, 0, old])
  expect(rows([agent('new', 'running', NOW - 599999)]).rows).toHaveLength(1)
})

test('quietSince is the newest quiet activity and folding happens before the twelve-row cap', () => {
  const agents = Array.from({ length: 25 }, (_, i) => agent(String(i), 'running', NOW - 700000 + i))
  const stats = Object.fromEntries(agents.slice(12).map(a => [a.id, { tools: 1, tool: 'read' as const, todos: [], lastAt: NOW }]))
  const result = rows(agents, stats) as any
  expect(result.rows.map((r: any) => r.id)).toEqual(Array.from({ length: 12 }, (_, i) => String(i + 12)))
  expect([result.quiet, result.quietSince, result.working, result.total, result.overflow]).toEqual([12, NOW - 700000 + 11, 13, 13, 1])
})

test('own idle main stays Ready while a foreign quiet main folds and recent mains stay visible', () => {
  const input = { agents: [], stats: { main: { tools: 1, tool: 'run' as const, todos: [], lastAt: NOW - 660000 } },
    main: { startedAt: NOW - 3600000, endedAt: NOW - 660000, working: false }, now: NOW }
  const own = buildRows(input)
  expect(own.rows.map(r => [r.id, r.line])).toEqual([['main', 'Ready']])
  const foreign = buildRows({ ...input, ownSession: false } as any) as any
  expect(foreign.rows).toHaveLength(0)
  expect(foreign.quiet).toBe(1)
  for (const main of [{ ...input.main, working: true }, { ...input.main, endedAt: NOW - 299999 }]) {
    expect(buildRows({ ...input, main, ownSession: false } as any).rows).toHaveLength(1)
  }
  expect(buildRows({ ...input, stats: { main: { ...input.stats.main, lastAt: NOW - 540000 } }, ownSession: false } as any).rows).toHaveLength(1)
})

test('idle agents with no active todo never describe their previous tool as current work', () => {
  expect(rows([agent('a', 'idle')], { a: { tools: 1, tool: 'run', todos: [] } }).rows[0]!.line).toBe('Task a')
  expect(rows([{ ...agent('a', 'idle'), description: '' }], { a: { tools: 1, tool: 'run', todos: [] } }).rows[0]!.line).toBe('Idle')
})
