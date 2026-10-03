import { describe, expect, it } from 'vitest'
import { T0, api, newTeam } from './helpers'

const hb = (o: Record<string, unknown> = {}) => ({
  session: 'sessA', project: 'mobile-app', branch: 'fix/restore', line: 'Fixing restore', state: 'working',
  fiveHour: 64, week: 41, startedAt: T0 - 3_600_000, ...o
})

describe('heartbeats and the snapshot', () => {
  it('stores a heartbeat and returns it in the snapshot with the server clock', async () => {
    const { teamId, linh, admin } = await newTeam()
    expect((await api('PUT', `/teams/${teamId}/sessions/sessA`, { key: linh.key, body: hb() })).status).toBe(200)
    const snap = await api('GET', `/teams/${teamId}`, { key: admin.key, now: T0 + 5_000 })
    expect(snap.status).toBe(200)
    expect(snap.body.now).toBe(T0 + 5_000)
    expect(snap.body.you).toBe(admin.memberId)
    expect(snap.body.members.map((m: any) => m.name)).toEqual(['Astro', 'Linh'])
    expect(snap.body.sessions[0]).toMatchObject({ id: 'sessA', member: linh.memberId, line: 'Fixing restore', fiveHour: 64, seenAt: T0 })
  })

  it('turns away a missing or unknown key', async () => {
    const { teamId } = await newTeam()
    expect((await api('GET', `/teams/${teamId}`)).status).toBe(401)
    expect((await api('PUT', `/teams/${teamId}/sessions/s1`, { key: 'f'.repeat(64), body: hb() })).status).toBe(401)
  })

  it('refuses writing a session that belongs to someone else', async () => {
    const { teamId, linh, admin } = await newTeam()
    await api('PUT', `/teams/${teamId}/sessions/sessA`, { key: linh.key, body: hb() })
    const r = await api('PUT', `/teams/${teamId}/sessions/sessA`, { key: admin.key, body: hb({ line: 'hijack' }), now: T0 + 60_000 })
    expect(r.status).toBe(403)
    const snap = await api('GET', `/teams/${teamId}`, { key: admin.key, now: T0 + 60_000 })
    expect(snap.body.sessions[0].line).toBe('Fixing restore')
  })

  it('extends a segment within 150 s and starts a new one after', async () => {
    const { teamId, linh } = await newTeam()
    const put = (now: number) => api('PUT', `/teams/${teamId}/sessions/sessA`, { key: linh.key, body: hb(), now })
    await put(T0)
    await put(T0 + 149_000)
    await put(T0 + 149_000 + 151_000)
    const snap = await api('GET', `/teams/${teamId}`, { key: linh.key, now: T0 + 400_000 })
    expect(snap.body.segments.map((s: any) => [s.start - T0, s.end - T0])).toEqual([[0, 149_000], [300_000, 300_000]])
  })

  it('keeps state_since while the state holds and resets it on change', async () => {
    const { teamId, linh } = await newTeam()
    const put = (now: number, state: string) => api('PUT', `/teams/${teamId}/sessions/sessA`, { key: linh.key, body: hb({ state }), now })
    await put(T0, 'idle')
    await put(T0 + 60_000, 'idle')
    let snap = await api('GET', `/teams/${teamId}`, { key: linh.key, now: T0 + 61_000 })
    expect(snap.body.sessions[0].stateSince).toBe(T0)
    await put(T0 + 120_000, 'working')
    snap = await api('GET', `/teams/${teamId}`, { key: linh.key, now: T0 + 121_000 })
    expect(snap.body.sessions[0].stateSince).toBe(T0 + 120_000)
  })

  it('caps every field and rejects a bad session id', async () => {
    const { teamId, linh } = await newTeam()
    await api('PUT', `/teams/${teamId}/sessions/sessA`, { key: linh.key, body: hb({ line: 'x'.repeat(500), fiveHour: 400, week: 'lots' }) })
    const snap = await api('GET', `/teams/${teamId}`, { key: linh.key })
    expect(snap.body.sessions[0].line.length).toBe(120)
    expect(snap.body.sessions[0].fiveHour).toBe(null)
    expect(snap.body.sessions[0].week).toBe(null)
    expect((await api('PUT', `/teams/${teamId}/sessions/${encodeURIComponent('a b')}`, { key: linh.key, body: hb() })).status).toBe(400)
  })

  it('drops segments and sessions older than 7 days on the next write', async () => {
    const { teamId, linh } = await newTeam()
    await api('PUT', `/teams/${teamId}/sessions/old`, { key: linh.key, body: hb({ session: 'old' }), now: T0 })
    const later = T0 + 8 * 86_400_000
    await api('PUT', `/teams/${teamId}/sessions/new`, { key: linh.key, body: hb({ session: 'new' }), now: later })
    const snap = await api('GET', `/teams/${teamId}`, { key: linh.key, now: later })
    expect(snap.body.sessions.map((s: any) => s.id)).toEqual(['new'])
  })

  it('limits heartbeats to 2 a minute per session and reads to 10 a minute per key', async () => {
    const { teamId, linh } = await newTeam()
    const put = (now: number) => api('PUT', `/teams/${teamId}/sessions/sessA`, { key: linh.key, body: hb(), now })
    expect((await put(T0)).status).toBe(200)
    expect((await put(T0 + 1_000)).status).toBe(200)
    expect((await put(T0 + 2_000)).status).toBe(429)
    expect((await put(T0 + 61_000)).status).toBe(200)
    const reads = []
    for (let i = 0; i < 11; i++) reads.push((await api('GET', `/teams/${teamId}`, { key: linh.key, now: T0 + i })).status)
    expect(reads.slice(0, 10).every(s => s === 200)).toBe(true)
    expect(reads[10]).toBe(429)
  })
})
