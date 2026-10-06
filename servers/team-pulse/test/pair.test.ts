import { env, runInDurableObject } from 'cloudflare:test'
import { describe, expect, it } from 'vitest'
import { randomHex, sha256 } from '../src/util'
import { T0, api, newTeam } from './helpers'

const INVALID = 'That pairing code is not valid or has expired. Run /team device code again on your other Mac.'
const codeFor = async (teamId: string, key: string, now = T0) => {
  const r = await api('POST', `/teams/${teamId}/pair`, { key, now })
  expect(r.status).toBe(200)
  expect(r.body.pairCode).toMatch(/^[a-z2-9]{10}\.[a-z2-9]{10}$/)
  expect(r.body.expiresAt).toBe(now + 600_000)
  const [id, code] = r.body.pairCode.split('.')
  expect(id).toBe(teamId)
  return code as string
}
const join = (teamId: string, code: string, now = T0) => api('POST', `/teams/${teamId}/pair/join`, { body: { code }, now })
const inside = async (teamId: string, fn: (instance: any, state: any) => any) => {
  const ns = (env as any).TEAM as DurableObjectNamespace
  return (runInDurableObject as any)(ns.get(ns.idFromName(teamId)), fn)
}

describe('device pairing', () => {
  it('a pairing code works once and its second use is refused', async () => {
    const { teamId, linh } = await newTeam()
    const code = await codeFor(teamId, linh.key)
    const paired = await join(teamId, code)
    expect(paired.status).toBe(200)
    expect(paired.body).toMatchObject({ teamId, team: 'Murror', memberId: linh.memberId, isAdmin: false, name: 'Linh' })
    expect(paired.body.key).toMatch(/^[0-9a-f]{64}$/)
    expect(paired.body.key === linh.key).toBe(false)
    expect(await join(teamId, code)).toEqual({ status: 403, body: { error: INVALID } })
  })

  it('a pairing code expires after ten minutes on the test clock', async () => {
    const { teamId, linh } = await newTeam()
    const code = await codeFor(teamId, linh.key)
    expect(await join(teamId, code, T0 + 600_000)).toEqual({ status: 403, body: { error: INVALID } })
  })

  it('a new pairing code replaces the previous one for the person', async () => {
    const { teamId, linh } = await newTeam()
    const old = await codeFor(teamId, linh.key)
    const fresh = await codeFor(teamId, linh.key, T0 + 1_000)
    expect((await join(teamId, old, T0 + 2_000)).status).toBe(403)
    expect((await join(teamId, fresh, T0 + 2_000)).status).toBe(200)
  })

  it('a paired key shares heartbeat, status, name and clock with one member', async () => {
    const created = await api('POST', '/teams', { body: { team: 'Murror', name: 'Linh' } })
    expect(created.status).toBe(200)
    const { teamId } = created.body
    const linh = created.body
    const paired = await join(teamId, await codeFor(teamId, linh.key))
    expect(paired.status).toBe(200)
    const key = paired.body.key
    for (const [sid, deviceKey] of [['firstMac', linh.key], ['otherMac', key]]) {
      expect((await api('PUT', `/teams/${teamId}/sessions/${sid}`, { key: deviceKey, body: { line: sid, turnAt: T0 } })).status).toBe(200)
    }
    expect((await api('PUT', `/teams/${teamId}/status`, { key, body: { status: 'lunch' } })).status).toBe(200)
    expect((await api('PUT', `/teams/${teamId}/name`, { key, body: { name: 'Linh N' } })).status).toBe(200)
    expect((await api('PUT', `/teams/${teamId}/clock`, { key, body: { tz: 'Asia/Ho_Chi_Minh' } })).status).toBe(200)
    const snap = await api('GET', `/teams/${teamId}`, { key: linh.key })
    expect(snap.status).toBe(200)
    expect(snap.body.you).toBe(linh.memberId)
    expect(snap.body.members).toHaveLength(1)
    expect(snap.body.members.filter((m: any) => m.id === linh.memberId)).toEqual([
      { id: linh.memberId, name: 'Linh N', status: 'lunch', statusAt: T0, tz: 'Asia/Ho_Chi_Minh' }
    ])
    expect(snap.body.sessions).toHaveLength(2)
    expect(snap.body.sessions.every((s: any) => s.member === linh.memberId)).toBe(true)
    const adminPair = await join(teamId, await codeFor(teamId, linh.key))
    expect(adminPair.body.isAdmin).toBe(true)
  })

  it('leaving one device keeps the member and the remaining key working after construction', async () => {
    const { teamId, linh } = await newTeam()
    const paired = await join(teamId, await codeFor(teamId, linh.key))
    expect(paired.status).toBe(200)
    expect(await api('POST', `/teams/${teamId}/leave`, { key: linh.key })).toEqual({ status: 200, body: { ok: true, removed: 'device' } })
    await inside(teamId, (instance, state) => { new (instance.constructor as any)(state, env) })
    expect((await api('GET', `/teams/${teamId}`, { key: linh.key })).status).toBe(401)
    const snap = await api('GET', `/teams/${teamId}`, { key: paired.body.key })
    expect(snap.status).toBe(200)
    expect(snap.body.members.some((m: any) => m.id === linh.memberId)).toBe(true)
  })

  it('leaving the last device deletes the member, sessions, history, keys and pairs', async () => {
    const { teamId, linh, admin } = await newTeam()
    const paired = await join(teamId, await codeFor(teamId, linh.key))
    expect(paired.status).toBe(200)
    const pending = await codeFor(teamId, paired.body.key)
    await api('PUT', `/teams/${teamId}/sessions/otherMac`, { key: paired.body.key, body: { line: 'work' } })
    await api('POST', `/teams/${teamId}/leave`, { key: linh.key })
    expect(await api('POST', `/teams/${teamId}/leave`, { key: paired.body.key })).toEqual({ status: 200, body: { ok: true, removed: 'member' } })
    const snap = await api('GET', `/teams/${teamId}`, { key: admin.key })
    expect(snap.body.members.map((m: any) => m.name)).toEqual(['Astro'])
    expect(snap.body.sessions).toEqual([])
    expect(snap.body.segments).toEqual([])
    expect((await api('GET', `/teams/${teamId}`, { key: paired.body.key })).status).toBe(401)
    expect((await join(teamId, pending)).status).toBe(403)
  })

  it('admin removal revokes every device key and pending pairing code', async () => {
    const { teamId, linh, admin } = await newTeam()
    const paired = await join(teamId, await codeFor(teamId, linh.key))
    expect(paired.status).toBe(200)
    const pending = await codeFor(teamId, paired.body.key)
    expect((await api('DELETE', `/teams/${teamId}/members/${linh.memberId}`, { key: admin.key })).status).toBe(200)
    for (const key of [linh.key, paired.body.key]) expect((await api('GET', `/teams/${teamId}`, { key })).status).toBe(401)
    expect((await join(teamId, pending)).status).toBe(403)
  })

  it('pair creation requires authentication and shares four calls per minute across a person\'s keys', async () => {
    const { teamId, linh, admin } = await newTeam()
    expect((await api('POST', `/teams/${teamId}/pair`)).status).toBe(401)
    const paired = await join(teamId, await codeFor(teamId, linh.key))
    expect(paired.status).toBe(200)
    for (let i = 1; i < 4; i++) await codeFor(teamId, paired.body.key, T0 + i)
    expect((await api('POST', `/teams/${teamId}/pair`, { key: linh.key, now: T0 + 4 })).status).toBe(429)
    await codeFor(teamId, admin.key, T0 + 4)
    await codeFor(teamId, linh.key, T0 + 60_000)
  })

  it('pair joins share ten attempts per minute independently of normal joins', async () => {
    const { teamId, code } = await newTeam()
    const statuses = []
    for (let i = 0; i < 11; i++) statuses.push((await join(teamId, '', T0 + i)).status)
    expect(statuses.slice(0, 10)).toEqual(Array(10).fill(403))
    expect(statuses[10]).toBe(429)
    expect((await api('POST', `/teams/${teamId}/join`, { body: { code, name: 'Bao' } })).status).toBe(200)
    expect((await join(teamId, '', T0 + 60_000)).status).toBe(403)
  })

  it('simultaneous pair joins consume a code only once', async () => {
    const { teamId, linh } = await newTeam()
    const code = await codeFor(teamId, linh.key)
    const results = await Promise.all([join(teamId, code), join(teamId, code)])
    expect(results.map(r => r.status).sort()).toEqual([200, 403])
  })

  it('pairing stores only hashes and pruning deletes expired codes', async () => {
    const { teamId, linh } = await newTeam()
    const code = await codeFor(teamId, linh.key)
    const hash = await sha256(code)
    const stored = await inside(teamId, (_, state) => state.storage.sql.exec('SELECT code_hash, member, expires_at FROM pairs').toArray())
    expect(stored).toEqual([{ code_hash: hash, member: linh.memberId, expires_at: T0 + 600_000 }])
    const later = T0 + 600_000
    await api('PUT', `/teams/${teamId}/sessions/prune`, { key: linh.key, body: {}, now: later })
    expect(await inside(teamId, (_, state) => state.storage.sql.exec('SELECT COUNT(*) AS n FROM pairs').one().n)).toBe(0)
  })

  it('construction migrates a legacy member key once and keeps it authenticated', async () => {
    const { teamId } = await newTeam()
    const legacyKey = randomHex(32)
    const hash = await sha256(legacyKey)
    const result = await inside(teamId, async (instance, state) => {
      const sql = state.storage.sql
      sql.exec('DROP TABLE IF EXISTS keys')
      sql.exec("DELETE FROM meta WHERE k = 'keys_migrated'")
      sql.exec('INSERT INTO members (id, name, name_key, key_hash, is_admin, joined_at) VALUES (?, ?, ?, ?, ?, ?)', 'legacy', 'Legacy', 'legacy', hash, 0, T0)
      const rebuilt = new (instance.constructor as any)(state, env)
      const tables = sql.exec("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'keys'").toArray()
      const authenticated = await rebuilt.snapshot(legacyKey, T0)
      return { tables: tables.length, status: authenticated.status, you: authenticated.body.you }
    })
    expect(result.tables).toBe(1)
    expect(result.status).toBe(200)
    expect(result.you).toBe('legacy')
  })
})
