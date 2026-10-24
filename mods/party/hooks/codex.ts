import type { AgentRow, CodexAck, CodexRun, Slot } from '../types'
import { assignAnimals, elapsed } from './roster'

export function pythonResolveArgv(): string[] {
  return ['sh', '-c', `python=$(command -v python3 2>/dev/null) || python=
case "$python" in
  */shims/*)
    real=$(pyenv which python3 2>/dev/null) || real=
    case "$real" in
      /*) if [ -x "$real" ]; then python=$real; fi ;;
    esac
    ;;
esac
case "$python" in
  /*) printf '%s\\n' "$python" ;;
esac
exit 0`]
}

export function pickPython(commandV: string, pyenvWhich: string): string {
  const path = commandV.includes('/shims/') && pyenvWhich ? pyenvWhich : commandV
  return path.startsWith('/') && !/\s/.test(path) ? path : 'python3'
}

// Invalid output is distinct from an empty scan: callers retain their last good view.
export function parseScan(json: string): CodexRun[] | null {
  try {
    const value = JSON.parse(json)
    if (!Array.isArray(value?.runs)) return null
    const runs: CodexRun[] = []
    const ids = new Set<string>()
    const count = (n: unknown) => typeof n === 'number' && Number.isSafeInteger(n) && n >= 0
    const name = (s: unknown) => s === null || (typeof s === 'string' && !/[\x00-\x1f\x7f]/.test(s))
    for (const r of value.runs) {
      if (!r || typeof r.id !== 'string' || !r.id || !name(r.id) || ids.has(r.id) || !name(r.parentId) || !name(r.role) || !name(r.nickname) || !name(r.label) || !['run', 'helper'].includes(r.kind) || !count(r.startedAt) || !count(r.lastAt) || !count(r.cmds) || !count(r.spawned) || typeof r.done !== 'boolean' || (r.tokens !== null && !count(r.tokens))) return null
      ids.add(r.id)
      runs.push({ id: r.id, parentId: r.parentId, kind: r.kind, role: r.role, nickname: r.nickname, label: r.label,
        startedAt: r.startedAt, lastAt: r.lastAt, cmds: r.cmds, spawned: r.spawned, done: r.done, tokens: r.tokens })
    }
    return runs
  } catch { return null }
}

export function observeCodex(runs: CodexRun[], ack: CodexAck): CodexAck {
  const ready = { ...ack.ready }
  for (const run of runs) {
    if (run.kind === 'run' && run.done && run.lastAt > ack.through) ready[run.id] = run.lastAt
  }
  return { through: ack.through, ready }
}

export function acknowledgeCodex(_ack: CodexAck, now: number): CodexAck {
  return { through: now, ready: {} }
}

export function codexRows(runs: CodexRun[], now: number, _ack: CodexAck): AgentRow[] {
  const ordered = [...runs].sort((a, b) => a.startedAt - b.startedAt || a.id.localeCompare(b.id))
  const assigned = assignAnimals(ordered.map(run => ({ ...run, slot: (run.kind === 'run' ? 'builder' : /review|sentinel/i.test(run.role ?? '') ? 'reviewer' : 'helper') as Slot })))
  const visible = assigned.filter(run => !run.done || now - run.lastAt < 300000)
  const roots = visible.filter(run => run.kind === 'run').slice(-8)
  const rows: AgentRow[] = []
  const seen = new Set<string>()
  const visit = (run: typeof assigned[number], depth: number) => {
    if (seen.has(run.id)) return
    seen.add(run.id)
    const state = run.done ? 'completed' : now - run.lastAt <= 45000 ? 'running' : 'idle'
    const line = run.kind === 'helper' ? /review|sentinel/i.test(run.role ?? '') ? 'sentinel reviewer' : run.role || 'Codex helper' : run.done ? 'Ready for review' : state === 'running' ? 'Implementing the brief' : 'Idle'
    const endedAt = run.done ? run.lastAt : state === 'idle' ? run.lastAt : null
    rows.push({ id: run.id, main: false, slot: run.slot, animal: run.animal, animalIndex: run.animalIndex,
      name: run.kind === 'run' ? run.label || 'Codex run' : run.nickname || run.role || 'Codex helper',
      role: run.kind === 'run' ? 'Builder' : run.role || 'Codex helper', state, line, tool: 'run', tools: run.cmds,
      startedAt: run.startedAt, endedAt, todo: null, codex: true, depth,
      meta: `${run.cmds} cmds \u00b7 ${elapsed((endedAt ?? now) - run.startedAt)}` })
    for (const helper of visible) if (helper.kind === 'helper' && helper.parentId === run.id) visit(helper, depth + 1)
  }
  for (const root of roots) visit(root, 0)
  return rows
}
