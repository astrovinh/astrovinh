import { test, expect } from 'claude-code/testing'
import { checkTarget, scanCaches, scanDisk, scanWorktrees, scanSimulators } from './scan'
import type { IO, Context, Stat } from './scan'
import { DAY } from './cleanup'
const HOME = '/Users/tester'
const TMP = '/private/tmp/plugin-test'
const ctx: Context = { home: HOME, tmp: TMP, uid: 501, pid: 99, cwd: '/session', now: 60 * DAY }
function fixture() {
  const nodes = new Map<string, Stat>()
  const commands: string[][] = []
  const lists = new Map<string, string[]>()
  let devices: any[] = []
  let status = ''
  let unpushed = ''
  let owner = '501'
  const put = (path: string, mtimeMs = 1, kind = 'dir', realPath = path) => { nodes.set(path, { kind, mtimeMs, size: 100, isLink: realPath !== path, realPath }); return path }
  const io: IO = {
    fs: {
      stat: async path => { const n = nodes.get(path); if (!n) throw new Error('ENOENT'); return n },
      list: async path => (lists.get(path) ?? []).map(name => ({ name, ...nodes.get(`${path}/${name}`)! }))
    },
    run: async argv => {
      commands.push(argv)
      let stdout = ''; let exitCode = 0
      if (argv[0] === 'du') stdout = '1000\tpath'
      if (argv[0] === 'stat') stdout = owner
      if (argv[0] === 'xcrun') stdout = JSON.stringify({ devices: { runtime: devices } })
      if (argv[0] === 'git') {
        if (argv.includes('list')) stdout = 'worktree /main\nbranch refs/heads/main\n\nworktree /old\nbranch refs/heads/feature\n'
        else if (argv.includes('status')) stdout = status
        else if (argv.includes('rev-parse')) stdout = 'origin/feature'
        else if (argv.includes('rev-list')) stdout = unpushed
      }
      return { exitCode, stdout }
    }
  }
  return { io, nodes, lists, put, commands, devices: (d: any[]) => { devices = d }, dirty: (s: string) => { status = s }, unpushed: () => { unpushed = 'abc' }, owner: (s: string) => { owner = s } }
}
test('S1/S2 real scanner reads only allowlisted caches, old logs and owned old temp entries', async () => {
  const f = fixture()
  const cache = f.put(`${HOME}/Library/Caches/pip`)
  f.put(`${HOME}/Library/Caches/Yarn`, 1, 'dir', `${HOME}/Documents`)
  const logs = f.put(`${HOME}/Library/Logs`)
  f.put(`${logs}/old.log`, 1, 'file'); f.put(`${logs}/new.log`, ctx.now, 'file')
  f.lists.set(logs, ['old.log', 'new.log'])
  f.put(TMP); f.put(`${TMP}/old`, 1, 'file'); f.put(`${TMP}/new`, ctx.now, 'file'); f.lists.set(TMP, ['old','new'])
  const items = await scanCaches(f.io, ctx)
  expect(items.flatMap(i => i.targets.map(t => t.path))).toEqual([cache, `${logs}/old.log`, `${TMP}/old`])
  expect(f.commands.every(a => ['du','stat'].includes(a[0]!))).toBe(true)
  f.owner('502')
  expect((await scanCaches(f.io, ctx)).some(i => i.targets.some(t => t.path.startsWith(TMP)))).toBe(false)
})
test('S2 action recheck refuses replaced symlinks, new logs and newly active temp children', async () => {
  const f = fixture(); f.put(TMP)
  const path = f.put(`${TMP}/old`)
  const child = f.put(`${path}/file`, 1, 'file'); f.lists.set(path, ['file'])
  const target = { path, real: path, age: 3 * DAY, owned: true }
  expect(await checkTarget(f.io, ctx, target)).toBe(true)
  f.put(child, ctx.now, 'file')
  expect(await checkTarget(f.io, ctx, target)).toBe(false)
  const cache = `${HOME}/Library/Caches/pip`; f.put(cache, 1, 'dir', `${HOME}/Documents`)
  expect(await checkTarget(f.io, ctx, { path: cache, real: cache })).toBe(false)
  const log = `${HOME}/Library/Logs/file`; f.put(log, ctx.now, 'file')
  expect(await checkTarget(f.io, ctx, { path: log, real: log, age: 14 * DAY })).toBe(false)
})
test('S3 scanner checks real git status, unpushed commits and descendant activity before offering a worktree', async () => {
  const f = fixture(); f.put(HOME); f.put(`${HOME}/repo`); f.put(`${HOME}/repo/.git`)
  f.lists.set(HOME, ['repo']); f.put('/old'); f.put('/old/file', 1, 'file'); f.lists.set('/old', ['file'])
  expect((await scanWorktrees(f.io, ctx))[0]?.eligible).toBe(true)
  f.dirty('?? untracked')
  expect((await scanWorktrees(f.io, ctx))[0]?.eligible).toBe(false)
  f.dirty(''); f.put('/old/file', ctx.now, 'file')
  expect((await scanWorktrees(f.io, ctx))[0]?.eligible).toBe(false)
  f.put('/old/file', 1, 'file'); f.unpushed()
  expect((await scanWorktrees(f.io, ctx))[0]?.eligible).toBe(false)
  expect(f.commands.every(a => a[0] === 'du' || (a[0] === 'git' && !a.includes('remove')))).toBe(true)
})
test('S1 worktree status disables optional Git index writes', async () => {
  const f = fixture(); f.put(HOME); f.put(`${HOME}/repo`); f.put(`${HOME}/repo/.git`)
  f.lists.set(HOME, ['repo']); f.put('/old')
  await scanWorktrees(f.io, ctx)
  const status = f.commands.filter(a => a[0] === 'git' && a.includes('status'))
  expect(status).toHaveLength(1)
  expect(status[0]!.includes('--no-optional-locks')).toBe(true)
})
test('S4 simulator scanner excludes booted, reserved and recent devices; unavailable never sweeps a reserved device', async () => {
  const f = fixture()
  const ds = ['Phone','Booted','QA phone','Recent','Gone','Staging old'].map((name,i) => {
    const udid = `00000000-0000-0000-0000-00000000000${i}`
    f.put(`${HOME}/Library/Developer/CoreSimulator/Devices/${udid}/data`, name === 'Recent' ? ctx.now : 1)
    return { name, udid, state: name === 'Booted' ? 'Booted' : 'Shutdown', isAvailable: !['Gone','Staging old'].includes(name) }
  })
  f.devices(ds)
  const items = await scanSimulators(f.io, ctx)
  expect(items.map(i => i.name)).toEqual(['Gone','Phone'])
  expect(items.some(i => i.argv?.includes('unavailable'))).toBe(false)
  f.devices(ds.filter(d => d.name !== 'Staging old'))
  expect((await scanSimulators(f.io, ctx))[0]?.argv).toEqual(['xcrun','simctl','delete','unavailable'])
})
test('S2/S3 missing-path metadata does not identify a project or block a safe temp entry', async () => {
  const f = fixture(); f.put(HOME); f.put(`${HOME}/ordinary`); f.lists.set(HOME, ['ordinary'])
  f.put(TMP); const path = f.put(`${TMP}/old`)
  const original = f.io.fs.stat
  f.io.fs.stat = async (p,options) => f.nodes.has(p) ? original(p,options) : { kind: 'other', size: 0, mtimeMs: 0, isLink: false }
  expect(await scanWorktrees(f.io, ctx)).toEqual([])
  expect(f.commands.some(a => a[0] === 'git')).toBe(false)
  expect(await checkTarget(f.io, ctx, { path, real: path, age: 3 * DAY, owned: true })).toBe(true)
})
test('S2 withheld git metadata and dangling git links still protect a temp checkout', async () => {
  const f = fixture(); f.put(TMP); const path = f.put(`${TMP}/old`)
  for (const entry of [{ kind: 'file', isLink: false }, { kind: 'dir', isLink: false }, { kind: 'other', isLink: true }]) {
    f.nodes.set(`${path}/.git`, { ...entry, size: 0, mtimeMs: 0 })
    expect(await checkTarget(f.io, ctx, { path, real: path, age: 3 * DAY, owned: true })).toBe(false)
  }
})
test('S1 empty scanners return no actions and truncated data fails closed', async () => {
  const f = fixture()
  expect(await scanDisk(f.io, ctx)).toEqual([])
  f.io.run = async () => ({ exitCode: 0, stdout: '{"devices":{}}', isStdoutTruncated: true })
  let failed = false
  try { await scanSimulators(f.io, ctx) } catch { failed = true }
  expect(failed).toBe(true)
})
