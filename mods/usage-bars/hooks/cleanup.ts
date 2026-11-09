export const DAY = 86400000
export type Place = { home: string; tmp: string }
const CACHE = ['Homebrew', 'com.apple.dt.Xcode', 'pip', 'Yarn', 'typescript', 'node-gyp', 'CocoaPods']
const inside = (path: string, root: string) => root === '/' || path === root || path.startsWith(`${root}/`)
const clean = (p: string) => p.startsWith('/') && !p.includes('\\') && !/[\x00-\x1f]/.test(p) && p.split('/').slice(1).every(c => c !== '.' && c !== '..' && c !== '')
export function allowedPath(path: string, real: string, place: Place): boolean {
  if (!clean(path) || !clean(real) || !clean(place.home) || place.home === '/') return false
  if (path === place.home || real === place.home || /(?:^|\/)(?:\.git|\.claude|\.codex|node_modules)(?:\/|$)/.test(`${path}/${real}`)) return false
  const roots = [...CACHE.map(c => `${place.home}/Library/Caches/${c}`), `${place.home}/Library/Developer/Xcode/DerivedData`, `${place.home}/.npm/_cacache`, `${place.home}/.yarn/berry/cache`]
  const root = roots.find(r => inside(path, r))
  if (root) return path.slice(place.home.length + 1).split('/').length >= 3 && inside(real, root)
  const logs = `${place.home}/Library/Logs/`
  if (path.startsWith(logs)) return real.startsWith(logs)
  return clean(place.tmp) && !inside(place.tmp, place.home) && !inside(place.home, place.tmp) && path.startsWith(`${place.tmp}/`) && real.startsWith(`${place.tmp}/`)
}
export function removeArgv(path: string): string[] {
  if (!clean(path)) throw new Error('Cannot clear this item.')
  return ['rm', '-r', '--', path]
}
export function worktreeArgv(repo: string, path: string): string[] {
  if (!clean(repo) || !clean(path)) throw new Error('Cannot remove this worktree.')
  return ['git', '-C', repo, 'worktree', 'remove', '--', path]
}
export function simulatorArgv(id: string): string[] {
  if (id !== 'unavailable' && !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(id)) throw new Error('Cannot remove this simulator.')
  return ['xcrun', 'simctl', 'delete', id]
}
export function bytes(n: number): string {
  n = Math.max(0, Number.isFinite(n) ? n : 0)
  if (n < 1000) return `${Math.round(n)} B`
  const unit = n >= 1e9 ? 'GB' : n >= 1e6 ? 'MB' : 'KB'
  return `${(n / (unit === 'GB' ? 1e9 : unit === 'MB' ? 1e6 : 1000)).toFixed(1).replace(/\.0$/, '')} ${unit}`
}
export type WorktreeCheck = { main: boolean; status: string; unpushed: string; merged: boolean; upstream: boolean; mtime: number; now: number; path: string; cwd: string }
export function worktreeEligible(w: WorktreeCheck): boolean {
  return !w.main && !w.status.trim() && !w.unpushed.trim() && (w.upstream || w.merged) && w.mtime < w.now - 14 * DAY && !inside(w.path, w.cwd) && !inside(w.cwd, w.path)
}
export function simulatorEligible(d: { name: string; state: string; mtime: number; now: number }): boolean {
  return d.state === 'Shutdown' && !/astro|qa|staging/i.test(d.name) && d.mtime < d.now - 30 * DAY
}
