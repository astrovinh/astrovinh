import { expect, test } from 'claude-code/testing'

import { askOverSsh, isStale, load, parseCard, parseConfig, parseFree, parseProcStat, parseRemote, readCards, roster, STALE_MS } from './machines'

test('config needs a name; this machine always leads the order', () => {
  expect(parseConfig('nope')).toBe(null)
  expect(parseConfig('{"order":["a"]}')).toBe(null)
  const cfg = parseConfig('{"name":"b","order":["a"],"outbox":"/x","ssh":[{"name":"PC","host":"pc"},{"name":"bad"}]}')!
  expect(cfg).toEqual({ name: 'b', order: ['b', 'a'], outbox: '/x', inbox: undefined, ssh: [{ name: 'PC', host: 'pc' }] })
})

test('a card is the higher of CPU and memory, and goes stale after 90 s', () => {
  const c = parseCard('{"name":"a","at":1000,"cpu":30,"memory":72,"disk":{"percent":90,"freeGb":5}}')!
  expect(load(c)).toBe(72)
  expect(load({ ...c, cpu: null, memory: null })).toBe(null)
  expect(isStale(c, 1000 + STALE_MS)).toBe(false)
  expect(isStale(c, 1001 + STALE_MS)).toBe(true)
  expect(isStale(undefined, 0)).toBe(true)
  expect(parseCard('{"name":"a"}')).toBe(null)
  expect(parseCard('{"name":"a","at":1,"cpu":250}')!.cpu).toBe(100)
})

test('roster keeps the expected order, the newest card per machine, and adds unlisted reporters last', () => {
  const cfg = parseConfig('{"name":"26","order":["26","21","PC"]}')!
  const card = (name: string, at: number) => ({ name, at, cpu: 1, memory: 1, disk: null })
  const rows = roster(cfg, [card('21', 1), card('21', 5), card('Z', 2), card('26', 3)])
  expect(rows.map(r => r.name)).toEqual(['26', '21', 'PC', 'Z'])
  expect(rows[1]!.card!.at).toBe(5)
  expect(rows[2]!.card).toBe(undefined)
})

test('Linux readings: CPU from two /proc/stat lines, memory from what is still available', () => {
  // 150 ticks passed, 50 of them idle: two thirds busy.
  expect(Math.round(parseProcStat('cpu  100 0 100 700 100 0 0 0\ncpu  150 0 150 750 100 0 0 0')! * 1000)).toBe(66667)
  expect(parseProcStat('cpu  1 2 3 4')).toBe(null)
  expect(parseFree('              total        used        free      shared  buff/cache   available\nMem:     1000   500   100   0   400   250\nSwap: 0 0 0')).toBe(75)
})

test('one ssh answer reads either a Mac or a Linux machine', () => {
  const linux = '@stat\ncpu  100 0 100 700 100 0 0 0\ncpu  150 0 150 750 100 0 0 0\n@free\nMem: 1000 500 100 0 400 250\n@df\nFilesystem 1024-blocks Used Available Capacity Mounted\n/dev/sdc 1000 300 700 30% /\n'
  expect(parseRemote('PC', linux, 9)).toEqual({ name: 'PC', at: 9, cpu: parseProcStat('cpu  100 0 100 700 100 0 0 0\ncpu  150 0 150 750 100 0 0 0'), memory: 75, disk: { percent: 30, freeGb: 700 * 1024 / 1e9 } })
  const mac = '@cores\n4\n@ps\n 50.0\n 30.0\n@pressure\nSystem-wide memory free percentage: 40%\n@df\nFilesystem 1024-blocks Used Available Capacity\n/dev/disk3 1000 640 360 64%\n'
  expect(parseRemote('M4', mac, 9)).toMatchObject({ cpu: 20, memory: 60, disk: { percent: 64 } })
})

test('ssh runs without a shell or a prompt, and an unreachable machine gives no card', async () => {
  const seen: string[][] = []
  const ok = async (argv: string[]) => { seen.push(argv); return { exitCode: 0, stdout: '@stat\ncpu  1 0 1 8 0\ncpu  2 0 2 16 0\n' } }
  expect((await askOverSsh(ok, 'PC', 'pc-host', async () => 5))!.name).toBe('PC')
  expect(seen[0]!.slice(0, 6)).toEqual(['ssh', '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=4', 'pc-host'])
  expect(await askOverSsh(async () => ({ exitCode: 255, stdout: '' }), 'PC', 'pc-host', async () => 5)).toBe(null)
  expect(await askOverSsh(async () => { throw new Error('timeout') }, 'PC', 'pc-host', async () => 5)).toBe(null)
})

test("cards are read one level down, in each folder's machine-load", async () => {
  const files: Record<string, string> = { '/in/from-a/machine-load/a.json': '{"name":"a","at":1,"cpu":5,"memory":6}', '/in/from-a/machine-load/junk.txt': 'x', '/in/from-b/machine-load/b.json': 'broken' }
  const fs = {
    list: async (p: string) => p === '/in'
      ? [{ name: 'from-a', kind: 'dir' }, { name: 'from-b', kind: 'dir' }, { name: 'note.md', kind: 'file' }]
      : Object.keys(files).filter(f => f.startsWith(`${p}/`)).map(f => ({ name: f.slice(p.length + 1), kind: 'file' })),
    read: async (p: string) => files[p]!
  }
  expect((await readCards(fs, '/in')).map(c => c.name)).toEqual(['a'])
})
