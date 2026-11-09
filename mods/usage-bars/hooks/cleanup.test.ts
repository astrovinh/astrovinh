import { test, expect } from 'claude-code/testing'
import { allowedPath, removeArgv, worktreeArgv, simulatorArgv, bytes, worktreeEligible, simulatorEligible, DAY } from './cleanup'
const home = '/Users/tester'
const place = { home, tmp: '/private/tmp/plugin-test' }
test('S2 allowlist accepts only explicit resolved cache roots and old-file locations', () => {
  for (const sub of ['Homebrew', 'com.apple.dt.Xcode', 'pip', 'Yarn', 'typescript', 'node-gyp', 'CocoaPods']) {
    const path = `${home}/Library/Caches/${sub}`
    expect(allowedPath(path, path, place), sub).toBe(true)
  }
  for (const tail of ['Library/Developer/Xcode/DerivedData', '.npm/_cacache/content-v2', '.yarn/berry/cache', 'Library/Logs/old.log']) {
    const path = `${home}/${tail}`
    expect(allowedPath(path, path, place), tail).toBe(true)
  }
  expect(allowedPath(`${place.tmp}/old`, `${place.tmp}/old`, place)).toBe(true)
})
test('S2 rejects home, escapes, shallow paths and symlinks leaving the allowlist', () => {
  for (const path of ['/', home, `${home}/Documents/x`, `${home}/Library/Logs`, `${home}/.cache/pip`, `${home}/Library/Caches/pip/../secret`, `${home}/Library/Caches/puppeteer`, `${home}/.npm/_cacache`]) {
    expect(allowedPath(path, path, place), path).toBe(false)
  }
  expect(allowedPath(`${home}/Library/Caches/pip`, `${home}/Documents/x`, place)).toBe(false)
  expect(allowedPath(`${home}/Library/Caches/pip`, `${home}/Library/Caches/Yarn`, place)).toBe(false)
})
test('S2 a hostile TMPDIR never authorizes home, personal folders or shallow paths', () => {
  for (const tmp of ['/Users', home, `${home}/Documents`]) {
    for (const path of [home, `${home}/Documents/x`, `${home}/Desktop/x`, `${home}/.codex/settings`, `${home}/Library/Logs`]) expect(allowedPath(path, path, { home, tmp }), `${tmp}: ${path}`).toBe(false)
  }
})
test('S1 and S3 exact deletion argv never use a shell or force a worktree', () => {
  expect(removeArgv(`${home}/Library/Caches/pip`)).toEqual(['rm', '-r', '--', `${home}/Library/Caches/pip`])
  expect(worktreeArgv('/repo', '/old tree')).toEqual(['git', '-C', '/repo', 'worktree', 'remove', '--', '/old tree'])
  expect(simulatorArgv('unavailable')).toEqual(['xcrun', 'simctl', 'delete', 'unavailable'])
  expect(simulatorArgv('00000000-0000-0000-0000-000000000001')).toEqual(['xcrun', 'simctl', 'delete', '00000000-0000-0000-0000-000000000001'])
  expect(() => simulatorArgv('--all')).toThrow()
})
test('S3 only clean old merged or tracked worktrees outside this session are eligible', () => {
  const base = { main: false, status: '', unpushed: '', upstream: true, merged: false, now: 40 * DAY, mtime: DAY, path: '/old', cwd: '/current' }
  expect(worktreeEligible(base)).toBe(true)
  expect(worktreeEligible({ ...base, upstream: false, merged: true })).toBe(true)
  for (const change of [{ main: true }, { status: ' M file' }, { status: '?? new' }, { unpushed: 'abc' }, { upstream: false }, { mtime: 39 * DAY }, { path: '/current' }, { path: '/current/child' }, { path: '/', cwd: '/current' }]) {
    expect(worktreeEligible({ ...base, ...change }), JSON.stringify(change)).toBe(false)
  }
})
test('S4 simulators must be shutdown, old, and have no reserved name', () => {
  const d = { name: 'Phone', state: 'Shutdown', mtime: DAY, now: 40 * DAY }
  expect(simulatorEligible(d)).toBe(true)
  for (const change of [{ state: 'Booted' }, { name: 'aStRo phone' }, { name: 'qa phone' }, { name: 'STAGING' }, { mtime: 39 * DAY }]) expect(simulatorEligible({ ...d, ...change })).toBe(false)
})
test('byte formatting uses measured decimal sizes without negative savings', () => {
  expect(bytes(3.1e9)).toBe('3.1 GB')
  expect(bytes(0)).toBe('0 B')
  expect(bytes(1800000)).toBe('1.8 MB')
  expect(bytes(-12)).toBe('0 B')
})
