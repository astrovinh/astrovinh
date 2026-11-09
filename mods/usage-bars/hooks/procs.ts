import type { Proc, Group } from '../types'
export type { Proc, Group } from '../types'
export function protectedProcess(p: Proc, uid: number, tree: Set<number>): boolean {
  // Names are matched before the first --flag: Chromium helpers carry flags such as --screen-info.
  const head = p.command.split(' --')[0]!
  return p.uid === 0 || p.uid !== uid || tree.has(p.pid) || /claude|codex|ssh|tailscaled|mosh|tmux|screen|kernel_task|launchd|windowserver|loginwindow|finder|dock|systemuiserver|terminal|iterm2|ghostty|alacritty|wezterm/i.test(head)
}
export function ownTree(all: Proc[], pid: number): Set<number> {
  const tree = new Set([pid])
  let parent = all.find(p => p.pid === pid)?.ppid
  while (parent && !tree.has(parent)) { tree.add(parent); parent = all.find(p => p.pid === parent)?.ppid }
  // Descend from this process only: children of an ancestor include unrelated apps.
  const descendants = new Set([pid])
  for (let changed = true; changed;) {
    changed = false
    for (const p of all) if (descendants.has(p.ppid) && !descendants.has(p.pid)) { descendants.add(p.pid); changed = true }
  }
  return new Set([...tree, ...descendants])
}
export function sameProcess(a: Proc, b: Proc | undefined): boolean {
  return !!b && a.pid === b.pid && a.start === b.start && a.command === b.command && a.uid === b.uid
}
export function signalArgv(pids: number[]): string[] {
  if (!pids.length || pids.some(p => !Number.isSafeInteger(p) || p <= 1)) throw new Error('Cannot quit this process.')
  return ['kill', '-TERM', ...pids.map(String)]
}
export const PS = ['ps', '-A', '-ww', '-o', 'pid=,ppid=,uid=,rss=,%cpu=,lstart=,command=']
export function parseProcesses(out: string): Proc[] {
  return out.split('\n').flatMap(line => {
    const m = /^\s*(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+([\d.]+)\s+(\S+\s+\S+\s+\d+\s+[\d:]+\s+\d+)\s+(.+)$/.exec(line)
    return m ? [{ pid: +m[1]!, ppid: +m[2]!, uid: +m[3]!, rss: +m[4]! * 1024, cpu: +m[5]!, start: m[6]!.replace(/\s+/g, ' '), command: m[7]! }] : []
  })
}
export function groups(all: Proc[], kind: 'cpu' | 'mem', uid: number, pid: number): Group[] {
  const tree = ownTree(all, pid)
  const map = new Map<string, Group>()
  for (const p of all) {
    const bundle = /(?:^|\/)([^/]+)\.app(?:\/|$)/.exec(p.command)?.[1]
    const name = bundle ?? p.command.split(/\s/)[0]!.split('/').pop() ?? 'Process'
    const group = map.get(name) ?? { id: String(p.pid), name, bytes: 0, cpu: 0, pids: [], processes: [], protected: true }
    group.bytes += p.rss; group.cpu += p.cpu; group.pids.push(p.pid); group.processes.push(p)
    group.protected &&= protectedProcess(p, uid, tree)
    map.set(name, group)
  }
  return [...map.values()].sort((a,b) => kind === 'mem' ? b.bytes - a.bytes : b.cpu - a.cpu).slice(0,6)
}
