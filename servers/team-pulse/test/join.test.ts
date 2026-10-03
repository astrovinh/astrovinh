import { describe, expect, it } from 'vitest'
import { api, newTeam } from './helpers'

describe('create and join', () => {
  it('creates a team and returns an admin key and a join code', async () => {
    const r = await api('POST', '/teams', { body: { team: 'Murror', name: 'Astro' } })
    expect(r.status).toBe(200)
    expect(r.body.isAdmin).toBe(true)
    expect(r.body.joinCode).toMatch(/^[a-z2-9]{10}\.[a-z2-9]{8}$/)
    expect(r.body.key).toMatch(/^[0-9a-f]{64}$/)
  })

  it('joins with the right code and gets a member key', async () => {
    const { linh } = await newTeam()
    expect(linh.isAdmin).toBe(false)
    expect(linh.key).toMatch(/^[0-9a-f]{64}$/)
  })

  it('refuses a wrong join code', async () => {
    const { teamId } = await newTeam()
    const r = await api('POST', `/teams/${teamId}/join`, { body: { code: 'wrongcod', name: 'Bao' } })
    expect(r.status).toBe(403)
  })

  it('refuses a second member with the same name', async () => {
    const { teamId, code } = await newTeam()
    const r = await api('POST', `/teams/${teamId}/join`, { body: { code, name: 'linh' } })
    expect(r.status).toBe(409)
  })

  it('refuses a team that does not exist', async () => {
    const r = await api('POST', '/teams/aaaaaaaaaa/join', { body: { code: 'x', name: 'Bao' } })
    expect(r.status).toBe(404)
  })

  it('refuses a body over 2 KB and a body that is not JSON', async () => {
    expect((await api('POST', '/teams', { raw: JSON.stringify({ team: 'x'.repeat(3000), name: 'A' }) })).status).toBe(413)
    expect((await api('POST', '/teams', { raw: '{nope' })).status).toBe(400)
  })

  it('refuses a duplicate name that differs only by Vietnamese case', async () => {
    const { teamId, code } = await newTeam()
    expect((await api('POST', `/teams/${teamId}/join`, { body: { code, name: 'Đức' } })).status).toBe(200)
    expect((await api('POST', `/teams/${teamId}/join`, { body: { code, name: 'đức' } })).status).toBe(409)
  })

  it('refuses the same name in decomposed form', async () => {
    const { teamId, code } = await newTeam()
    const ánh = 'Ánh'.normalize('NFC')
    expect((await api('POST', `/teams/${teamId}/join`, { body: { code, name: ánh } })).status).toBe(200)
    expect((await api('POST', `/teams/${teamId}/join`, { body: { code, name: ánh.normalize('NFD') } })).status).toBe(409)
  })
})
