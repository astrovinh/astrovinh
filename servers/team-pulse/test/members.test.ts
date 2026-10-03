import { describe, expect, it } from 'vitest'
import { T0, api, newTeam } from './helpers'

const hb = { session: 's1', project: 'p', branch: 'b', line: 'l', state: 'working', fiveHour: 1, week: 2, startedAt: T0 }

describe('leaving, removing and rotating', () => {
  it('leave deletes the member, their sessions and their segments', async () => {
    const { teamId, linh, admin } = await newTeam()
    await api('PUT', `/teams/${teamId}/sessions/s1`, { key: linh.key, body: hb })
    expect((await api('POST', `/teams/${teamId}/leave`, { key: linh.key })).status).toBe(200)
    const snap = await api('GET', `/teams/${teamId}`, { key: admin.key })
    expect(snap.body.members.map((m: any) => m.name)).toEqual(['Astro'])
    expect(snap.body.sessions).toEqual([])
    expect(snap.body.segments).toEqual([])
    expect((await api('GET', `/teams/${teamId}`, { key: linh.key, now: T0 + 1 })).status).toBe(401)
  })

  it('the admin can remove a member; a member cannot', async () => {
    const { teamId, linh, admin } = await newTeam()
    expect((await api('DELETE', `/teams/${teamId}/members/${admin.memberId}`, { key: linh.key })).status).toBe(403)
    expect((await api('DELETE', `/teams/${teamId}/members/${linh.memberId}`, { key: admin.key })).status).toBe(200)
    expect((await api('GET', `/teams/${teamId}`, { key: linh.key, now: T0 + 1 })).status).toBe(401)
  })

  it('rotating the code makes the old one stop working', async () => {
    const { teamId, code, admin, linh } = await newTeam()
    expect((await api('POST', `/teams/${teamId}/code`, { key: linh.key })).status).toBe(403)
    const r = await api('POST', `/teams/${teamId}/code`, { key: admin.key })
    expect(r.status).toBe(200)
    const [, fresh] = r.body.joinCode.split('.')
    expect(fresh).not.toBe(code)
    expect((await api('POST', `/teams/${teamId}/join`, { body: { code, name: 'Bao' } })).status).toBe(403)
    expect((await api('POST', `/teams/${teamId}/join`, { body: { code: fresh, name: 'Bao' } })).status).toBe(200)
  })
})
