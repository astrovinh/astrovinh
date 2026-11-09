import { test, expect } from 'claude-code/testing'
import { protectedProcess, ownTree, sameProcess, signalArgv, parseProcesses, groups } from './procs'
import type { Proc } from './procs'
const p: Proc = { pid: 42, ppid: 1, uid: 501, rss: 1e9, cpu: 12, start: 'Sun Nov 8 12:00:00 2026', command: '/Applications/Browser.app/Contents/MacOS/Browser' }
test('S6 protected table covers every reserved name and owner', () => {
  for (const command of ['claude', 'codex', 'Claude.app', 'Codex', 'ssh', 'sshd', 'tailscaled', 'mosh', 'tmux', 'screen', 'kernel_task', 'launchd', 'WindowServer', 'loginwindow', 'Finder', 'Dock', 'SystemUIServer', 'Terminal', 'iTerm2', 'Ghostty', 'Alacritty', 'WezTerm']) expect(protectedProcess({ ...p, command }, 501, new Set()), command).toBe(true)
  expect(protectedProcess({ ...p, uid: 0 }, 501, new Set())).toBe(true)
  expect(protectedProcess({ ...p, uid: 502 }, 501, new Set())).toBe(true)
  expect(protectedProcess(p, 501, new Set([42]))).toBe(true)
  for (const command of ['Xcode', 'Simulator', 'jest', 'node']) expect(protectedProcess({ ...p, command }, 501, new Set()), command).toBe(false)
})
test('S6 own tree includes ancestors and descendants without adopting sibling apps', () => {
  const all = [{ ...p, pid: 10, ppid: 1 }, { ...p, pid: 20, ppid: 10 }, { ...p, pid: 21, ppid: 20 }, { ...p, pid: 22, ppid: 10 }]
  expect([...ownTree(all, 20)].sort((a,b) => a-b)).toEqual([1,10,20,21])
})
test('S5 PID reuse guard rejects changed start time, command or owner', () => {
  expect(sameProcess(p, { ...p })).toBe(true)
  expect(sameProcess(p, { ...p, start: 'later' })).toBe(false)
  expect(sameProcess(p, { ...p, command: 'other' })).toBe(false)
  expect(sameProcess(p, { ...p, uid: 0 })).toBe(false)
  expect(sameProcess(p, undefined)).toBe(false)
  expect(signalArgv([42,43])).toEqual(['kill', '-TERM', '42', '43'])
  expect(() => signalArgv([-42])).toThrow()
})
test('S5 ps parser and top six groups keep app names, measured bytes and all PIDs', () => {
  const all = parseProcesses('42 1 501 1800000 12 Sun Nov 8 12:00:00 2026 /Applications/Google Chrome.app/Contents/MacOS/Chrome\n43 42 501 100000 2 Sun Nov 8 12:00:01 2026 /Applications/Google Chrome.app/Contents/Helper')
  expect(all).toHaveLength(2)
  const grouped = groups(all, 'mem', 501, 999)
  expect(grouped[0]!.name).toBe('Google Chrome')
  expect(grouped[0]!.bytes).toBe(1900000 * 1024)
  expect(grouped[0]!.pids).toEqual([42,43])
  expect(groups([...all, ...Array.from({ length: 10 }, (_,i) => ({ ...p, pid: i + 100, command: `app${i}`, rss: i }))], 'cpu', 501, 999)).toHaveLength(6)
})

test('S6 names are matched before the first --flag, so Chromium flags never protect an app', () => {
  const helper = '/Applications/Spotify.app/Contents/Frameworks/Spotify Helper (Renderer).app/Contents/MacOS/Spotify Helper (Renderer) --type=renderer --screen-info=1'
  expect(protectedProcess({ ...p, command: helper }, 501, new Set())).toBe(false)
  expect(protectedProcess({ ...p, command: '/System/Applications/Screen Sharing --type=x' }, 501, new Set())).toBe(true)
})

test('S6 an app group is protected only when every process in it is protected', () => {
  const app = (pid: number, uid: number) => ({ ...p, pid, uid, command: '/Applications/Remote.app/Contents/MacOS/Remote' })
  expect(groups([app(1, 501), app(2, 0)], 'mem', 501, 999)[0]!.protected).toBe(false)
  expect(groups([app(1, 0), app(2, 0)], 'mem', 501, 999)[0]!.protected).toBe(true)
})

