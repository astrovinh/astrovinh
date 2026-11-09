import { test, expect } from 'claude-code/testing'
import { cleanupActions, initialView } from './actions'
import type { View, Host } from './actions'
import { DAY } from './cleanup'
const HOME = '/Users/tester'
const NOW = 60 * DAY
function setup() {
  let view = initialView(); let time = NOW
  let pending: (() => void) | undefined
  let changed = false; let actionFailed = false
  const calls: string[][] = []
  const entries = new Set(['/old1','/old2'])
  const present = new Set([HOME, `${HOME}/repo`, `${HOME}/repo/.git`, '/session', '/old1','/old2'])
  const host: Host = {
    home: async () => HOME, tmp: async () => undefined, cwd: async () => '/session', now: async () => time,
    after: (_,fn) => { pending = fn },
    fs: {
      stat: async path => { if (!present.has(path)) throw new Error('ENOENT'); return { kind: 'dir', size: 0, mtimeMs: 1, isLink: false, realPath: path } },
      list: async path => path === HOME ? [{ name: 'repo', kind: 'dir', size: 0, mtimeMs: 1, isLink: false }] : []
    },
    run: async argv => {
      calls.push(argv)
      let stdout = ''; let exitCode = 0
      if (argv[0] === 'uname') stdout = 'Darwin'
      else if (argv[0] === 'id') stdout = '501'
      else if (argv[0] === 'python3') stdout = '99'
      else if (argv[0] === 'du') stdout = '1000\tpath'
      else if (argv[0] === 'xcrun') stdout = '{"devices":{}}'
      else if (argv[0] === 'git') {
        if (argv.includes('list')) stdout = ['worktree /main', ...[...entries].map(p => `\nworktree ${p}`)].join('\n')
        else if (argv.includes('status')) stdout = changed ? '?? new' : ''
        else if (argv.includes('rev-parse')) stdout = 'origin/feature'
        else if (argv.includes('remove')) { if (actionFailed) exitCode = 1; else { entries.delete(argv[argv.length-1]!); present.delete(argv[argv.length-1]!) } }
      }
      return { exitCode, stdout }
    }
  }
  const action = cleanupActions(host, async next => { view = next })
  return { action, calls, host, view: () => view, change: () => { changed = true }, fail: () => { actionFailed = true }, expire: () => { time += 5001; pending?.() } }
}
test('S3 worktrees start unticked; section confirmation applies to one selected item only', async () => {
  const h = setup(); await h.action.open('disk')
  expect(h.view().items.filter(i => i.kind === 'worktree')).toHaveLength(2)
  expect(h.view().selected).toEqual([])
  await h.action.clean('worktree')
  expect(h.calls.some(a => a.includes('remove'))).toBe(false)
  await h.action.toggle('worktree-0'); await h.action.clean('worktree')
  expect(h.view().armed).toBe('remove-worktree')
  await h.action.toggle('worktree-1')
  expect(h.view().selected).toEqual(['worktree-1'])
  expect(h.view().armed).toBe(null)
  await h.action.clean('worktree')
  expect(h.calls.some(a => a.includes('remove'))).toBe(false)
  await h.action.clean('worktree')
  expect(h.calls.filter(a => a.includes('remove'))).toEqual([['git','-C',`${HOME}/repo`,'worktree','remove','--','/old2']])
  expect(h.view().message).toBe('Freed 1 MB')
})
test('S3 selection confirmed earlier is rechecked for new changes before removal', async () => {
  const h = setup(); await h.action.open('disk'); await h.action.toggle('worktree-0')
  await h.action.clean('worktree'); h.change(); await h.action.clean('worktree')
  expect(h.calls.some(a => a.includes('remove'))).toBe(false)
  expect(h.view().phase).toBe('error')
})
test('S3 unresolved session directory fails closed before any cleanup scan', async () => {
  const h = setup(); const original = h.host.fs.stat
  h.host.fs.stat = async (p,options) => p === '/session' ? { kind: 'dir', size: 0, mtimeMs: 1, isLink: false } : original(p,options)
  await h.action.open('disk')
  expect(h.view().phase).toBe('error')
  expect(h.calls.some(a => a[0] === 'git' || a[0] === 'du')).toBe(false)
})
test('S1 close invalidates an unfinished read-only scan', async () => {
  const h = setup(); const real = h.host.run
  let release!: () => void
  const gate = new Promise<void>(resolve => { release = resolve })
  h.host.run = async (argv,init) => { if (argv[0] === 'uname') await gate; return real(argv,init) }
  const opening = h.action.open('disk')
  await h.action.close(); release(); await opening
  expect(h.view().panel).toBe(null)
  expect(h.view().items).toEqual([])
  expect(h.calls.some(a => a.includes('remove'))).toBe(false)
})

function processHost() {
  const h = setup(); const original = h.host.run
  const ps = '42 1 501 1000 10 Sun Nov 8 12:00:00 2026 Browser\n99 1 501 1000 0 Sun Nov 8 12:00:00 2026 plugin'
  h.host.run = async (argv,init) => argv[0] === 'ps' ? { exitCode: 0, stdout: ps } : original(argv,init)
  return h
}
test('S5 concurrent second presses signal once', async () => {
  const h = processHost(); await h.action.open('mem'); await h.action.quit('42')
  await Promise.all([h.action.quit('42'), h.action.quit('42')])
  expect(h.calls.filter(a => a[0] === 'kill')).toHaveLength(1)
})
test('S5 closing while final PID read is pending cancels the signal', async () => {
  const h = processHost(); await h.action.open('mem'); await h.action.quit('42')
  const original = h.host.run; let release!: () => void; let entered!: () => void
  const gate = new Promise<void>(r => { release = r }); const reading = new Promise<void>(r => { entered = r })
  h.host.run = async (argv,init) => { if (argv[0] === 'ps' && argv.includes('-p')) { entered(); await gate }; return original(argv,init) }
  const quitting = h.action.quit('42'); await reading; await h.action.close(); release(); await quitting
  expect(h.calls.filter(a => a[0] === 'kill')).toHaveLength(0)
  expect(h.view().panel).toBe(null)
})
