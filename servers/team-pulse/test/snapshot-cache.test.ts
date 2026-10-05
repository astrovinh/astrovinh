import { describe, expect, it } from 'vitest'
import { T0, api, newTeam } from './helpers'

const hb = (line: string) => ({ project: 'mobile-app', branch: 'main', line, state: 'working', fiveHour: 10, week: 20, startedAt: T0 })
const beat = (teamId: string, key: string, sid: string, line: string, now: number) =>
  api('PUT', `/teams/${teamId}/sessions/${sid}`, { key, body: hb(line), now })
const read = (teamId: string, key: string, now: number) => api('GET', `/teams/${teamId}`, { key, now })
const lineOf = (snap: any, sid: string) => snap.body.sessions.find((s: any) => s.id === sid)?.line

describe('polls share one team view for 30 s', () => {
  it('a heartbeat on an existing session waits for the next rebuild', async () => {
    const { teamId, linh } = await newTeam()
    await beat(teamId, linh.key, 'sessA', 'first', T0)
    expect(lineOf(await read(teamId, linh.key, T0 + 1_000), 'sessA')).toBe('first')
    await beat(teamId, linh.key, 'sessA', 'second', T0 + 2_000)
    const shared = await read(teamId, linh.key, T0 + 29_000)
    expect(lineOf(shared, 'sessA')).toBe('first')
    expect(shared.body.now).toBe(T0 + 1_000)
  })

  it('a poll 30 s after the rebuild sees the new heartbeat', async () => {
    const { teamId, linh } = await newTeam()
    await beat(teamId, linh.key, 'sessA', 'first', T0)
    await read(teamId, linh.key, T0 + 1_000)
    await beat(teamId, linh.key, 'sessA', 'second', T0 + 2_000)
    const fresh = await read(teamId, linh.key, T0 + 31_000)
    expect(lineOf(fresh, 'sessA')).toBe('second')
    expect(fresh.body.now).toBe(T0 + 31_000)
  })

  it('a clock that steps back rebuilds instead of serving a view from the future', async () => {
    const { teamId, linh } = await newTeam()
    await read(teamId, linh.key, T0 + 60_000)
    expect((await read(teamId, linh.key, T0 + 10_000)).body.now).toBe(T0 + 10_000)
  })

  it('each member sharing the view still sees themselves as you', async () => {
    const { teamId, admin, linh } = await newTeam()
    const a = await read(teamId, admin.key, T0 + 1_000)
    const l = await read(teamId, linh.key, T0 + 2_000)
    expect(l.body.now).toBe(a.body.now)
    expect(a.body.you).toBe(admin.memberId)
    expect(l.body.you).toBe(linh.memberId)
  })

  it('a stranger is still refused while a view is cached', async () => {
    const { teamId, linh } = await newTeam()
    await read(teamId, linh.key, T0 + 1_000)
    expect((await read(teamId, 'not-a-key', T0 + 2_000)).status).toBe(401)
  })
})

describe('changes a member makes show on their next poll', () => {
  it('a brand-new session', async () => {
    const { teamId, linh } = await newTeam()
    await read(teamId, linh.key, T0 + 1_000)
    await beat(teamId, linh.key, 'sessNew', 'just opened', T0 + 2_000)
    expect(lineOf(await read(teamId, linh.key, T0 + 3_000), 'sessNew')).toBe('just opened')
  })

  it('joining', async () => {
    const { teamId, code, linh } = await newTeam()
    await read(teamId, linh.key, T0 + 1_000)
    const mona = await api('POST', `/teams/${teamId}/join`, { body: { code, name: 'Mona' }, now: T0 + 2_000 })
    const names = (await read(teamId, mona.body.key, T0 + 3_000)).body.members.map((m: any) => m.name)
    expect(names).toContain('Mona')
  })

  it('setting a status', async () => {
    const { teamId, linh } = await newTeam()
    await read(teamId, linh.key, T0 + 1_000)
    await api('PUT', `/teams/${teamId}/status`, { key: linh.key, body: { status: 'lunch' }, now: T0 + 2_000 })
    const me = (await read(teamId, linh.key, T0 + 3_000)).body.members.find((m: any) => m.id === linh.memberId)
    expect(me.status).toBe('lunch')
  })

  it('renaming', async () => {
    const { teamId, linh } = await newTeam()
    await read(teamId, linh.key, T0 + 1_000)
    await api('PUT', `/teams/${teamId}/name`, { key: linh.key, body: { name: 'Linh N' }, now: T0 + 2_000 })
    const me = (await read(teamId, linh.key, T0 + 3_000)).body.members.find((m: any) => m.id === linh.memberId)
    expect(me.name).toBe('Linh N')
  })

  it('leaving', async () => {
    const { teamId, admin, linh } = await newTeam()
    await read(teamId, admin.key, T0 + 1_000)
    await api('POST', `/teams/${teamId}/leave`, { key: linh.key, now: T0 + 2_000 })
    const ids = (await read(teamId, admin.key, T0 + 3_000)).body.members.map((m: any) => m.id)
    expect(ids).not.toContain(linh.memberId)
  })

  it('being removed by the admin', async () => {
    const { teamId, admin, linh } = await newTeam()
    await read(teamId, admin.key, T0 + 1_000)
    await api('DELETE', `/teams/${teamId}/members/${linh.memberId}`, { key: admin.key, now: T0 + 2_000 })
    const ids = (await read(teamId, admin.key, T0 + 3_000)).body.members.map((m: any) => m.id)
    expect(ids).not.toContain(linh.memberId)
  })
})
