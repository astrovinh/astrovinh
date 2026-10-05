import { describe, expect, it } from 'vitest'
import { api, newTeam, T0 } from './helpers'

const setStatus = (teamId: string, key: string | undefined, status: unknown, now = T0) =>
  api('PUT', `/teams/${teamId}/status`, { key, body: { status }, now })
const snap = async (teamId: string, key: string, now = T0) => (await api('GET', `/teams/${teamId}`, { key, now })).body
const mine = (s: any, id: string) => s.members.find((m: any) => m.id === id)

describe('away status', () => {
  it('stores a status and shows it in the snapshot with the time it was set', async () => {
    const { teamId, admin } = await newTeam()
    const r = await setStatus(teamId, admin.key, 'at lunch', T0 + 5)
    expect(r.status).toBe(200)
    expect(r.body).toEqual({ ok: true, status: 'at lunch' })
    const m = mine(await snap(teamId, admin.key, T0 + 6), admin.memberId)
    expect(m.status).toBe('at lunch')
    expect(m.statusAt).toBe(T0 + 5)
  })

  it('shows null and null for a member who never set one', async () => {
    const { teamId, admin, linh } = await newTeam()
    const m = mine(await snap(teamId, admin.key), linh.memberId)
    expect(m.status).toBeNull()
    expect(m.statusAt).toBeNull()
  })

  it('clears with an empty string', async () => {
    const { teamId, admin } = await newTeam()
    await setStatus(teamId, admin.key, 'at lunch')
    const r = await setStatus(teamId, admin.key, '', T0 + 10)
    expect(r.body).toEqual({ ok: true, status: null })
    const m = mine(await snap(teamId, admin.key, T0 + 11), admin.memberId)
    expect(m.status).toBeNull()
    expect(m.statusAt).toBeNull()
  })

  it('clears with whitespace only', async () => {
    const { teamId, admin } = await newTeam()
    await setStatus(teamId, admin.key, 'at lunch')
    const r = await setStatus(teamId, admin.key, '  \n\t ', T0 + 10)
    expect(r.body).toEqual({ ok: true, status: null })
    const m = mine(await snap(teamId, admin.key, T0 + 11), admin.memberId)
    expect(m.status).toBeNull()
    expect(m.statusAt).toBeNull()
  })

  it('trims, collapses whitespace and cuts to 280 characters', async () => {
    const { teamId, admin } = await newTeam()
    const r = await setStatus(teamId, admin.key, `  back   soon ${'x'.repeat(400)}`)
    expect(r.body.status).toBe(`back soon ${'x'.repeat(270)}`)
    expect(r.body.status).toHaveLength(280)
    expect(mine(await snap(teamId, admin.key), admin.memberId).status).toHaveLength(280)
  })

  it('keeps an emoji intact', async () => {
    const { teamId, admin } = await newTeam()
    const s = '\u{1F634} sleeping, back 8am'
    expect((await setStatus(teamId, admin.key, s)).body.status).toBe(s)
    expect(mine(await snap(teamId, admin.key), admin.memberId).status).toBe(s)
  })

  it('answers 401 without a member key or with a wrong one', async () => {
    const { teamId } = await newTeam()
    expect((await setStatus(teamId, undefined, 'hi')).status).toBe(401)
    expect((await setStatus(teamId, 'not-a-key', 'hi')).status).toBe(401)
  })

  it('answers 429 on the 7th set within a minute', async () => {
    const { teamId, admin } = await newTeam()
    for (let i = 0; i < 6; i++) expect((await setStatus(teamId, admin.key, `s${i}`, T0 + i)).status).toBe(200)
    expect((await setStatus(teamId, admin.key, 's6', T0 + 6)).status).toBe(429)
    expect((await setStatus(teamId, admin.key, 'later', T0 + 61_000)).status).toBe(200)
  })

  it('removes the status when the member leaves', async () => {
    const { teamId, admin, linh } = await newTeam()
    expect((await setStatus(teamId, linh.key, 'gone fishing')).status).toBe(200)
    await api('POST', `/teams/${teamId}/leave`, { key: linh.key })
    const s = await snap(teamId, admin.key)
    expect(mine(s, linh.memberId)).toBeUndefined()
    expect(JSON.stringify(s)).not.toContain('gone fishing')
  })

  it('leaves another member unaffected when one sets theirs', async () => {
    const { teamId, admin, linh } = await newTeam()
    await setStatus(teamId, linh.key, 'in a meeting', T0 + 1)
    await setStatus(teamId, admin.key, 'at lunch', T0 + 2)
    const s = await snap(teamId, admin.key, T0 + 3)
    expect(mine(s, linh.memberId)).toMatchObject({ status: 'in a meeting', statusAt: T0 + 1 })
    expect(mine(s, admin.memberId)).toMatchObject({ status: 'at lunch', statusAt: T0 + 2 })
  })
})
