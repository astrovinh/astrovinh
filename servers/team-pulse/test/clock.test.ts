import { describe, expect, it } from 'vitest'
import { api, newTeam, T0 } from './helpers'

const setClock = (teamId: string, key: string | undefined, tz: unknown, now = T0) =>
  api('PUT', `/teams/${teamId}/clock`, { key, body: { tz }, now })
const read = (teamId: string, key: string, now = T0) => api('GET', `/teams/${teamId}`, { key, now })
const mine = (s: any, id: string) => s.body.members.find((m: any) => m.id === id)
const INVALID = 'That is not a time zone. Use a name like Asia/Ho_Chi_Minh or America/Los_Angeles.'

describe('opt-in local clock', () => {
  it('stores a zone and shows it only for the member who opted in', async () => {
    const { teamId, admin, linh } = await newTeam()
    const r = await setClock(teamId, linh.key, 'Asia/Ho_Chi_Minh')
    expect(r.status).toBe(200)
    expect(r.body).toEqual({ ok: true, tz: 'Asia/Ho_Chi_Minh' })
    const s = await read(teamId, admin.key)
    expect(mine(s, linh.memberId).tz).toBe('Asia/Ho_Chi_Minh')
    expect(mine(s, admin.memberId).tz).toBeNull()
  })

  it('defaults to null when a member has never shared a zone', async () => {
    const { teamId, admin } = await newTeam()
    expect(mine(await read(teamId, admin.key), admin.memberId).tz).toBeNull()
  })

  it('an empty string clears a shared zone', async () => {
    const { teamId, admin } = await newTeam()
    await setClock(teamId, admin.key, 'America/Los_Angeles')
    const r = await setClock(teamId, admin.key, '', T0 + 1)
    expect(r.status).toBe(200)
    expect(r.body).toEqual({ ok: true, tz: null })
    expect(mine(await read(teamId, admin.key, T0 + 2), admin.memberId).tz).toBeNull()
  })

  it('rejects invalid zones, bad types, forbidden characters and overlong names', async () => {
    const { teamId, admin } = await newTeam()
    await setClock(teamId, admin.key, 'Asia/Tokyo')
    const invalid = ['Asia/Not_A_Zone', ' Asia/Tokyo', 'Asia/Tokyo ', 'Asia/Tokyo\n', 'Asia/Tokyo!', 'Asia\\Tokyo', 'x'.repeat(65), null, 7, {}, ['Asia/Tokyo'], undefined]
    for (let i = 0; i < invalid.length; i++) {
      const r = await setClock(teamId, admin.key, invalid[i], T0 + (i + 1) * 61_000)
      expect(r.status).toBe(400)
      expect(r.body.error).toBe(INVALID)
    }
    expect(mine(await read(teamId, admin.key, T0 + 800_000), admin.memberId).tz).toBe('Asia/Tokyo')
  })

  it('accepts aliases and valid zone names containing plus, minus or digits', async () => {
    const { teamId, admin } = await newTeam()
    for (const tz of ['Asia/Saigon', 'Etc/GMT+7', 'Etc/GMT-2', 'UTC']) expect((await setClock(teamId, admin.key, tz)).status).toBe(200)
  })

  it('answers 401 without membership even while a view is cached', async () => {
    const { teamId, admin } = await newTeam()
    await read(teamId, admin.key)
    expect((await setClock(teamId, undefined, 'Asia/Tokyo')).status).toBe(401)
    expect((await setClock(teamId, 'not-a-key', '')).status).toBe(401)
  })

  it('setting and clearing a clock show on the next read inside the cache window', async () => {
    const { teamId, admin, linh } = await newTeam()
    expect(mine(await read(teamId, admin.key, T0 + 1_000), linh.memberId).tz).toBeNull()
    await setClock(teamId, linh.key, 'Asia/Ho_Chi_Minh', T0 + 2_000)
    const set = await read(teamId, admin.key, T0 + 3_000)
    expect(mine(set, linh.memberId).tz).toBe('Asia/Ho_Chi_Minh')
    expect(set.body.now).toBe(T0 + 3_000)
    await setClock(teamId, linh.key, '', T0 + 4_000)
    const cleared = await read(teamId, admin.key, T0 + 5_000)
    expect(mine(cleared, linh.memberId).tz).toBeNull()
    expect(cleared.body.now).toBe(T0 + 5_000)
  })

  it('allows six changes per member per minute and resets after a minute', async () => {
    const { teamId, admin, linh } = await newTeam()
    for (let i = 0; i < 6; i++) expect((await setClock(teamId, admin.key, 'Asia/Tokyo', T0 + i)).status).toBe(200)
    expect((await setClock(teamId, admin.key, '', T0 + 6)).status).toBe(429)
    expect((await setClock(teamId, linh.key, 'Asia/Tokyo', T0 + 6)).status).toBe(200)
    expect((await api('PUT', `/teams/${teamId}/status`, { key: admin.key, body: { status: 'lunch' }, now: T0 + 6 })).status).toBe(200)
    expect((await setClock(teamId, admin.key, '', T0 + 61_000)).status).toBe(200)
  })
})
