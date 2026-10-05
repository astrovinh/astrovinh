import { describe, expect, it } from 'vitest'
import { T0, api, newTeam } from './helpers'

const hb = { session: 's1', project: 'p', branch: 'b', line: 'l', state: 'working', fiveHour: 1, week: 2, startedAt: T0 }
const rename = (teamId: string, key: string | undefined, name: unknown, now = T0) => api('PUT', `/teams/${teamId}/name`, { key, body: { name }, now })

describe('renaming yourself', () => {
  it('shows the new name in the snapshot', async () => {
    const { teamId, admin, linh } = await newTeam()
    const r = await rename(teamId, linh.key, '  Linh Tran  ')
    expect(r.status).toBe(200)
    expect(r.body).toEqual({ ok: true, name: 'Linh Tran' })
    const snap = await api('GET', `/teams/${teamId}`, { key: admin.key })
    expect(snap.body.members.map((m: any) => m.name)).toEqual(['Astro', 'Linh Tran'])
  })

  it('needs a member key', async () => {
    const { teamId } = await newTeam()
    expect((await rename(teamId, undefined, 'Zed')).status).toBe(401)
    expect((await rename(teamId, 'nope', 'Zed')).status).toBe(401)
  })

  it('an empty name is a 400 that asks for one', async () => {
    const { teamId, linh } = await newTeam()
    for (const bad of ['', '   ', undefined, 7]) {
      const r = await rename(teamId, linh.key, bad)
      expect(r.status).toBe(400)
      expect(r.body.error).toBe('Give your new name.')
    }
  })

  it("another member's name is a 409, whatever the case", async () => {
    const { teamId, admin, linh } = await newTeam()
    const r = await rename(teamId, admin.key, 'linh')
    expect(r.status).toBe(409)
    expect(r.body.error).toBe('Someone on the team is already called linh. Pick a different name.')
    const snap = await api('GET', `/teams/${teamId}`, { key: linh.key })
    expect(snap.body.members.map((m: any) => m.name)).toEqual(['Astro', 'Linh'])
  })

  it('your own name in a different case is allowed and stores the new casing', async () => {
    const { teamId, admin } = await newTeam()
    const r = await rename(teamId, admin.key, 'ASTRO')
    expect(r.status).toBe(200)
    expect(r.body).toEqual({ ok: true, name: 'ASTRO' })
    const snap = await api('GET', `/teams/${teamId}`, { key: admin.key })
    expect(snap.body.members[0].name).toBe('ASTRO')
  })

  it('the exact same name changes nothing', async () => {
    const { teamId, linh } = await newTeam()
    const r = await rename(teamId, linh.key, 'Linh')
    expect(r.status).toBe(200)
    expect(r.body).toEqual({ ok: true, name: 'Linh' })
  })

  it('the old name is free for someone else afterwards', async () => {
    const { teamId, admin, linh } = await newTeam()
    expect((await rename(teamId, linh.key, 'Mai')).status).toBe(200)
    expect((await rename(teamId, admin.key, 'Linh')).status).toBe(200)
  })

  it('allows 6 renames a minute and refuses the 7th', async () => {
    const { teamId, linh } = await newTeam()
    for (let i = 0; i < 6; i++) expect((await rename(teamId, linh.key, `Name ${i}`)).status).toBe(200)
    const r = await rename(teamId, linh.key, 'Name 7')
    expect(r.status).toBe(429)
    expect(r.body.error).toBe('Too many name changes. Wait a minute.')
    expect((await rename(teamId, linh.key, 'Name 8', T0 + 61_000)).status).toBe(200)
  })

  it('keeps admin and keeps sessions', async () => {
    const { teamId, admin } = await newTeam()
    await api('PUT', `/teams/${teamId}/sessions/s1`, { key: admin.key, body: hb })
    expect((await rename(teamId, admin.key, 'AstroMac21')).status).toBe(200)
    expect((await api('POST', `/teams/${teamId}/code`, { key: admin.key })).status).toBe(200)
    const snap = await api('GET', `/teams/${teamId}`, { key: admin.key, now: T0 + 1 })
    expect(snap.body.sessions.map((s: any) => [s.id, s.member])).toEqual([['s1', admin.memberId]])
    expect(snap.body.members.find((m: any) => m.id === admin.memberId).name).toBe('AstroMac21')
  })
})
