import type { Target, Item } from '../types'
export type { Target, Item } from '../types'
import { allowedPath, DAY, simulatorArgv, simulatorEligible, worktreeArgv, worktreeEligible } from './cleanup'
import { groups, parseProcesses, PS } from './procs'
import type { Group } from './procs'

export type Stat = { kind: string; size: number; mtimeMs: number; isLink: boolean; realPath?: string }
export type IO = {
  run: (argv: string[], init?: { timeoutMs: number }) => Promise<{ exitCode: number; stdout: string; isStdoutTruncated?: boolean }>
  fs: { stat: (path: string, options: { resolve: boolean }) => Promise<Stat>; list: (path: string) => Promise<{ name: string; kind: string; isLink: boolean; size: number; mtimeMs: number }[]> }
}
export type Context = { home: string; tmp: string; uid: number; pid: number; cwd: string; now: number }
export const safeLabel = (s: string) => s.replace(/[^\x20-\x7e]/g, '?').slice(0, 48)
export async function command(io: IO, argv: string[]): Promise<string> {
  const r = await io.run(argv, { timeoutMs: 3000 })
  if (r.exitCode !== 0 || r.isStdoutTruncated) throw new Error(`${argv.slice(0, 3).join(' ')}: ${r.isStdoutTruncated ? 'output cut short' : `exit ${r.exitCode}`}`)
  return r.stdout
}
async function optional(io: IO, argv: string[]): Promise<string | null> {
  const r = await io.run(argv, { timeoutMs: 3000 })
  if (r.isStdoutTruncated) throw new Error('Could not read these items.')
  return r.exitCode === 0 ? r.stdout : null
}
export const stat = (io: IO, path: string) => io.fs.stat(path, { resolve: true }).then(s => !s.realPath && s.kind === 'other' && !s.isLink && s.size === 0 && s.mtimeMs === 0 ? null : s).catch((e: unknown) => {
  if (/ENOENT|no such file/i.test(String(e))) return null
  throw e
})
const overlap = (a: string, b: string) => a === b || a.startsWith(`${b}/`) || b.startsWith(`${a}/`)
export async function size(io: IO, path: string): Promise<number> {
  const out = await command(io, ['du', '-sk', path])
  const n = Number(/^\s*(\d+)/.exec(out)?.[1])
  if (!Number.isFinite(n)) throw new Error('Could not read this size.')
  return n * 1024
}
/** Rechecked immediately before every removal; no untrusted path reaches rm. */
export async function checkTarget(io: IO, c: Context, t: Target): Promise<boolean> {
  const s = await stat(io, t.path)
  if (!s?.realPath || s.isLink || s.realPath !== t.real || !allowedPath(t.path, s.realPath, c) || overlap(s.realPath, c.cwd)) return false
  if (t.age && s.mtimeMs >= c.now - t.age) return false
  if (t.owned) {
    if (Number((await command(io, ['stat', '-f', '%u', t.path])).trim()) !== c.uid) return false
    if (s.kind === 'dir') {
      let safe = !(await stat(io, `${t.path}/.git`))
      await walk(io, t.path, async (path, child) => {
        if (child.mtimeMs >= c.now - (t.age ?? 3 * DAY) || /(?:^|\/)(?:node_modules|\.claude|\.codex)(?:\/|$)/.test(path)) safe = false
        if (child.kind === 'dir' && await stat(io, `${path}/.git`)) safe = false
        if (Number((await command(io, ['stat', '-f', '%u', path])).trim()) !== c.uid) safe = false
      })
      if (!safe) return false
    }
  }
  return true
}
const cacheRoots = [
  ['Library/Developer/Xcode/DerivedData', 'Xcode build cache'],
  ...['Homebrew', 'com.apple.dt.Xcode', 'pip', 'Yarn', 'typescript', 'node-gyp', 'CocoaPods'].map(n => [`Library/Caches/${n}`, `${n} cache`]),
  ['.yarn/berry/cache', 'Yarn package cache']
]
async function walk(io: IO, path: string, visit: (path: string, s: Stat) => Promise<void>, budget = { left: 20000 }) {
  const entries = await io.fs.list(path)
  for (const entry of entries) {
    if (--budget.left < 0) throw new Error('Too many items to check at once.')
    if (entry.isLink || entry.name === '.git' || /[\/\x00-\x1f]/.test(entry.name) || entry.name === '..' || entry.name === '.') continue
    const child = `${path}/${entry.name}`
    const s = await stat(io, child)
    if (!s || s.isLink || s.realPath !== child) continue
    await visit(child, s)
    if (s.kind === 'dir') await walk(io, child, visit, budget)
  }
}
export async function scanCaches(io: IO, c: Context): Promise<Item[]> {
  const items: Item[] = []
  const add = async (name: string, targets: Target[]) => {
    const safe: Target[] = []; let n = 0
    for (const t of targets) if (await checkTarget(io, c, t)) { n += await size(io, t.path); safe.push(t) }
    if (n > 0) items.push({ id: `cache-${items.length}`, name, bytes: n, kind: 'cache', targets: safe, eligible: true })
  }
  for (const [tail, name] of cacheRoots) {
    const path = `${c.home}/${tail}`; const s = await stat(io, path)
    if (s?.realPath) await add(name!, [{ path, real: s.realPath }])
  }
  const npm = `${c.home}/.npm/_cacache`
  const ns = await stat(io, npm)
  if (ns?.realPath === npm && !ns.isLink) {
    const targets = (await io.fs.list(npm)).filter(e => !e.isLink && /^[\w.-]+$/.test(e.name) && e.name !== '.' && e.name !== '..').map(e => ({ path: `${npm}/${e.name}`, real: `${npm}/${e.name}` }))
    await add('npm package cache', targets)
  }
  const logs = `${c.home}/Library/Logs`; const ls = await stat(io, logs)
  if (ls?.realPath === logs && !ls.isLink) {
    const targets: Target[] = []
    await walk(io, logs, async (path, s) => { if (s.kind === 'file' && s.mtimeMs < c.now - 14 * DAY) targets.push({ path, real: path, age: 14 * DAY }) })
    await add('Old logs', targets)
  }
  const ts = c.tmp ? await stat(io, c.tmp) : null
  if (ts?.realPath === c.tmp && !ts.isLink) {
    const targets = (await io.fs.list(c.tmp)).filter(e => !e.isLink && !/[\/\x00-\x1f]/.test(e.name) && e.name !== '.' && e.name !== '..').map(e => ({ path: `${c.tmp}/${e.name}`, real: `${c.tmp}/${e.name}`, age: 3 * DAY, owned: true }))
    // The same recursive age/ownership check runs during scan and again on press.
    const safe: Target[] = []
    for (const t of targets) if (await checkTarget(io, c, t)) safe.push(t)
    await add('Old temporary files', safe)
  }
  return items
}
async function lastActivity(io: IO, path: string): Promise<number> {
  const s = await stat(io, path)
  if (!s || s.isLink || s.realPath !== path) return Infinity
  let last = s.mtimeMs
  await walk(io, path, async (_, child) => { last = Math.max(last, child.mtimeMs) })
  return last
}
export async function worktreeCheck(io: IO, c: Context, repo: string, path: string, main: boolean): Promise<boolean> {
  if (main || overlap(path, c.cwd)) return false
  const git = (...a: string[]) => ['git', '--no-optional-locks', '-C', path, ...a]
  const status = await command(io, git('status', '--porcelain', '--untracked-files=all'))
  if (status.trim()) return false
  const upstream = await optional(io, git('rev-parse', '--abbrev-ref', '@{u}'))
  const unpushed = upstream ? await command(io, git('rev-list', '@{u}..HEAD')) : ''
  let merged = false
  if (!upstream) {
    const defaultRef = (await optional(io, ['git', '-C', repo, 'symbolic-ref', '--quiet', 'refs/remotes/origin/HEAD']))?.trim()
    if (defaultRef) merged = (await optional(io, git('merge-base', '--is-ancestor', 'HEAD', defaultRef))) !== null
  }
  return worktreeEligible({ main, status, unpushed, upstream: !!upstream, merged, mtime: await lastActivity(io, path), now: c.now, path, cwd: c.cwd })
}
export async function scanWorktrees(io: IO, c: Context): Promise<Item[]> {
  const repos: string[] = []; const seen = new Set<string>(); const items: Item[] = []
  for (const root of [c.home, `${c.home}/Projects`]) {
    const rs = await stat(io, root)
    if (!rs || rs.isLink || rs.realPath !== root) continue
    for (const e of await io.fs.list(root)) {
      if (repos.length >= 40) break
      if (e.kind !== 'dir' || e.isLink || !/^[^/.][^/]*$/.test(e.name)) continue
      const path = `${root}/${e.name}`
      if (await stat(io, `${path}/.git`)) repos.push(path)
    }
  }
  for (const repo of repos) {
    const out = await command(io, ['git', '-C', repo, 'worktree', 'list', '--porcelain'])
    const paths = out.split('\n').filter(l => l.startsWith('worktree ')).map(l => l.slice(9))
    for (const [i, path] of paths.entries()) {
      if (i === 0 || seen.has(path)) continue
      seen.add(path)
      const eligible = await worktreeCheck(io, c, repo, path, false)
      items.push({ id: `worktree-${items.length}`, name: safeLabel(path.split('/').pop() || 'Worktree'), bytes: eligible ? await size(io, path) : 0, kind: 'worktree', targets: [], argv: worktreeArgv(repo, path), repo, eligible })
    }
  }
  return items
}
export async function scanSimulators(io: IO, c: Context): Promise<Item[]> {
  const out = await optional(io, ['xcrun', 'simctl', 'list', 'devices', '-j'])
  if (out === null) return [] // Xcode tools are optional.
  const devices = Object.values((JSON.parse(out).devices ?? {}) as Record<string, any[]>).flat()
  const items: Item[] = []; const unavailable: Item[] = []; let reservedUnavailable = false
  for (const d of devices) {
    if (!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(d.udid ?? '')) continue
    const reserved = /astro|qa|staging/i.test(d.name ?? '') || d.state !== 'Shutdown'
    if (d.isAvailable === false && reserved) reservedUnavailable = true
    if (reserved) continue
    const path = `${c.home}/Library/Developer/CoreSimulator/Devices/${d.udid}/data`
    const s = await stat(io, path)
    if (s?.realPath !== path || s.isLink) continue
    const item: Item = { id: `sim-${d.udid}`, name: safeLabel(d.name), bytes: await size(io, path), kind: 'sim', targets: [], argv: simulatorArgv(d.udid), eligible: true }
    if (d.isAvailable === false) unavailable.push(item)
    else if (simulatorEligible({ ...d, mtime: s.mtimeMs, now: c.now })) items.push(item)
  }
  if (unavailable.length) {
    // The aggregate command must never sweep a reserved unavailable device.
    if (!reservedUnavailable) items.unshift({ id: 'sim-unavailable', name: 'Unavailable simulators', bytes: unavailable.reduce((n,i) => n + i.bytes, 0), kind: 'sim', targets: [], argv: simulatorArgv('unavailable'), eligible: true })
    else items.unshift(...unavailable)
  }
  return items
}
export async function scanDisk(io: IO, c: Context): Promise<Item[]> {
  return [...await scanCaches(io, c), ...await scanWorktrees(io, c), ...await scanSimulators(io, c)]
}
export async function scanGroups(io: IO, c: Context, kind: 'cpu' | 'mem'): Promise<Group[]> {
  const all = parseProcesses(await command(io, PS))
  if (!all.some(p => p.pid === c.pid)) throw new Error('Could not check protected processes.')
  return groups(all, kind, c.uid, c.pid).map(g => ({ ...g, name: safeLabel(g.name) }))
}
