import { env, runInDurableObject } from 'cloudflare:test'
import { describe, expect, it } from 'vitest'
import { api, newTeam, T0 } from './helpers'

const HOUR = 3_600_000
const DAY = 24 * HOUR
const send = (teamId: string, key: string | undefined, body: unknown, now = T0) =>
  api('POST', `/teams/${teamId}/signals`, { key, body, now })
const read = async (teamId: string, key: string, now = T0) => (await api('GET', `/teams/${teamId}`, { key, now })).body.signals
const act = (teamId: string, key: string | undefined, id: string, action: unknown, now = T0) =>
  api('PUT', `/teams/${teamId}/signals/${id}`, { key, body: { action }, now })
const inside = async (teamId: string, fn: (instance: any, state: any) => any) => {
  const ns = (env as any).TEAM as DurableObjectNamespace
  return (runInDurableObject as any)(ns.get(ns.idFromName(teamId)), fn)
}

describe('small signals', () => {
  it('creates a handoff with a cleaned note capped at 280 whole characters and clears the view', async () => {
    const { teamId, admin, linh } = await newTeam()
    await read(teamId, admin.key)
    const r = await send(teamId, admin.key, { kind: 'handoff', to: linh.memberId, text: `  Ready\n for   review ${'\u{1F331}'.repeat(300)}` }, T0 + 1)
    expect(r.status).toBe(200)
    expect(r.body).toEqual({ ok: true, id: expect.any(String) })
    expect(await read(teamId, admin.key, T0 + 2)).toEqual([
      { id: r.body.id, kind: 'handoff', from: admin.memberId, to: linh.memberId, text: `Ready for review ${'\u{1F331}'.repeat(263)}`, at: T0 + 1 }
    ])
  })

  it('validates the handoff receiver and requires a note', async () => {
    const { teamId, admin, linh } = await newTeam()
    expect(await send(teamId, admin.key, { kind: 'handoff', to: admin.memberId, text: 'hello' })).toEqual({ status: 400, body: { error: 'A handoff goes to a teammate, not to you.' } })
    for (const to of [undefined, '', 'missing', 3]) expect((await send(teamId, admin.key, { kind: 'handoff', to, text: 'hello' })).status).toBe(400)
    for (const text of [undefined, '', ' \n\t ', 3]) expect((await send(teamId, admin.key, { kind: 'handoff', to: linh.memberId, text })).status).toBe(400)
    expect(await read(teamId, admin.key)).toEqual([])
  })

  it('limits handoffs to ten per member per hour without changing minute limits', async () => {
    const { teamId, admin, linh } = await newTeam()
    for (let i = 0; i < 10; i++) expect((await send(teamId, admin.key, { kind: 'handoff', to: linh.memberId, text: 'Review when ready' }, T0 + i)).status).toBe(200)
    expect((await send(teamId, admin.key, { kind: 'handoff', to: linh.memberId, text: 'Later' }, T0 + 61_000)).status).toBe(429)
    expect((await send(teamId, linh.key, { kind: 'handoff', to: admin.memberId, text: 'Their draft is ready' }, T0 + 61_000)).status).toBe(200)
    expect((await send(teamId, admin.key, { kind: 'handoff', to: linh.memberId, text: 'Later' }, T0 + HOUR)).status).toBe(200)
    for (let i = 0; i < 6; i++) expect((await api('PUT', `/teams/${teamId}/status`, { key: admin.key, body: { status: 'writing' }, now: T0 + i })).status).toBe(200)
    expect((await api('PUT', `/teams/${teamId}/status`, { key: admin.key, body: { status: 'writing' }, now: T0 + 61_000 })).status).toBe(200)
  })

  it('creates a wave with no text and validates its receiver', async () => {
    const { teamId, admin, linh } = await newTeam()
    const r = await send(teamId, admin.key, { kind: 'wave', to: linh.memberId, text: 'not shared' })
    expect(r.status).toBe(200)
    expect(await read(teamId, admin.key)).toEqual([{ id: r.body.id, kind: 'wave', from: admin.memberId, to: linh.memberId, text: '', at: T0 }])
    for (const to of [admin.memberId, 'missing', '', undefined, 3]) expect((await send(teamId, admin.key, { kind: 'wave', to })).status).toBe(400)
  })

  it('allows only one wave per sender and receiver in four hours, then allows another', async () => {
    const { teamId, admin, linh } = await newTeam()
    expect((await send(teamId, admin.key, { kind: 'wave', to: linh.memberId })).status).toBe(200)
    expect(await send(teamId, admin.key, { kind: 'wave', to: linh.memberId }, T0 + 4 * HOUR - 1)).toEqual({ status: 429, body: { error: 'You already waved at Linh. Try again later.' } })
    expect(await read(teamId, admin.key, T0 + 4 * HOUR - 1)).toHaveLength(1)
    expect((await send(teamId, linh.key, { kind: 'wave', to: admin.memberId }, T0 + 4 * HOUR - 1)).status).toBe(200)
    expect((await send(teamId, admin.key, { kind: 'wave', to: linh.memberId }, T0 + 4 * HOUR)).status).toBe(200)
    expect(await read(teamId, admin.key, T0 + 4 * HOUR)).toHaveLength(3)
  })

  it('creates a win with no receiver and a cleaned note capped at 120 characters', async () => {
    const { teamId, admin } = await newTeam()
    const r = await send(teamId, admin.key, { kind: 'win', text: `  Their  study\n is ready ${'x'.repeat(150)}` })
    expect(r.status).toBe(200)
    expect(await read(teamId, admin.key)).toEqual([{ id: r.body.id, kind: 'win', from: admin.memberId, to: '', text: `Their study is ready ${'x'.repeat(99)}`, at: T0 }])
  })

  it('requires a win note and rejects a receiver and unknown kinds', async () => {
    const { teamId, admin, linh } = await newTeam()
    for (const text of [undefined, '', ' \n ', 3]) expect((await send(teamId, admin.key, { kind: 'win', text })).status).toBe(400)
    expect((await send(teamId, admin.key, { kind: 'win', to: linh.memberId, text: 'Done' })).status).toBe(400)
    for (const kind of [undefined, 'unknown', 3]) expect((await send(teamId, admin.key, { kind, text: 'Done' })).status).toBe(400)
    expect(await read(teamId, admin.key)).toEqual([])
  })

  it('limits wins to six per member per day', async () => {
    const { teamId, admin, linh } = await newTeam()
    for (let i = 0; i < 6; i++) expect((await send(teamId, admin.key, { kind: 'win', text: 'Ready' }, T0 + i)).status).toBe(200)
    expect((await send(teamId, admin.key, { kind: 'win', text: 'Ready' }, T0 + HOUR)).status).toBe(429)
    expect((await send(teamId, linh.key, { kind: 'win', text: 'Ready' }, T0 + HOUR)).status).toBe(200)
    expect((await send(teamId, admin.key, { kind: 'win', text: 'Ready' }, T0 + DAY)).status).toBe(200)
  })

  it('handoffs are visible only to their sender and receiver, never a third member sharing the cached view', async () => {
    const { teamId, code, admin, linh } = await newTeam()
    const third = (await api('POST', `/teams/${teamId}/join`, { body: { code, name: 'Khanh' } })).body
    const ho = await send(teamId, admin.key, { kind: 'handoff', to: linh.memberId, text: 'The draft is ready for your review' })
    const wave = await send(teamId, linh.key, { kind: 'wave', to: admin.memberId })
    const win = await send(teamId, admin.key, { kind: 'win', text: 'The study is ready' })
    for (const key of [linh.key, admin.key]) expect((await read(teamId, key, T0 + 1)).map((s: any) => s.id)).toContain(ho.body.id)
    const other = await read(teamId, third.key, T0 + 2)
    expect(other.map((s: any) => s.id)).not.toContain(ho.body.id)
    expect(other.map((s: any) => s.id).sort()).toEqual([wave.body.id, win.body.id].sort())
    // A third-member read must not mutate the cached array for the sender's next poll.
    expect((await read(teamId, admin.key, T0 + 3)).map((s: any) => s.id)).toContain(ho.body.id)
  })

  for (const action of ['take', 'dismiss']) {
    it(`only the receiver can ${action} an open handoff, and it disappears on the next poll`, async () => {
      const { teamId, code, admin, linh } = await newTeam()
      const third = (await api('POST', `/teams/${teamId}/join`, { body: { code, name: 'Khanh' } })).body
      const r = await send(teamId, admin.key, { kind: 'handoff', to: linh.memberId, text: 'Review when ready' })
      const noUpdate = { status: 404, body: { error: 'Nothing to update.' } }
      expect(await act(teamId, admin.key, r.body.id, action)).toEqual(noUpdate)
      expect(await act(teamId, third.key, r.body.id, action)).toEqual(noUpdate)
      expect(await act(teamId, linh.key, 'missing', action)).toEqual(noUpdate)
      expect(await act(teamId, linh.key, r.body.id, 'unknown')).toEqual(noUpdate)
      expect(await read(teamId, linh.key)).toHaveLength(1)
      expect(await act(teamId, linh.key, r.body.id, action, T0 + 1)).toEqual({ status: 200, body: { ok: true } })
      expect(await read(teamId, linh.key, T0 + 2)).toEqual([])
      expect(await read(teamId, admin.key, T0 + 2)).toEqual([])
      expect(await act(teamId, linh.key, r.body.id, action, T0 + 3)).toEqual(noUpdate)
    })
  }

  it('cannot take or dismiss waves or wins even as their receiver', async () => {
    const { teamId, admin, linh } = await newTeam()
    for (const body of [{ kind: 'wave', to: linh.memberId }, { kind: 'win', text: 'Ready' }]) {
      const r = await send(teamId, admin.key, body)
      for (const action of ['take', 'dismiss']) expect(await act(teamId, linh.key, r.body.id, action)).toEqual({ status: 404, body: { error: 'Nothing to update.' } })
    }
  })

  it('authenticates every signal write', async () => {
    const { teamId, linh } = await newTeam()
    for (const key of [undefined, 'not-a-key']) {
      for (const kind of ['handoff', 'wave', 'win']) expect((await send(teamId, key, { kind, to: linh.memberId, text: 'Ready' })).status).toBe(401)
      expect((await act(teamId, key, 'missing', 'take')).status).toBe(401)
    }
  })

  for (const [kind, lifetime] of [['wave', 12 * HOUR], ['win', 48 * HOUR], ['handoff', 7 * DAY]] as const) {
    it(`${kind} disappears after its lifetime even inside the cached view window`, async () => {
      const { teamId, admin, linh } = await newTeam()
      expect((await send(teamId, admin.key, { kind, ...(kind === 'win' ? {} : { to: linh.memberId }), text: 'Ready' })).status).toBe(200)
      expect(await read(teamId, linh.key, T0 + lifetime - 1)).toHaveLength(1)
      expect(await read(teamId, linh.key, T0 + lifetime)).toEqual([])
    })
  }

  it('deletes signals from or to a removed member and clears the view', async () => {
    const { teamId, admin, linh } = await newTeam()
    for (const [key, body] of [[admin.key, { kind: 'handoff', to: linh.memberId, text: 'Review' }], [linh.key, { kind: 'wave', to: admin.memberId }], [linh.key, { kind: 'win', text: 'Ready' }]] as const) expect((await send(teamId, key, body)).status).toBe(200)
    expect(await read(teamId, admin.key)).toHaveLength(3)
    await api('DELETE', `/teams/${teamId}/members/${linh.memberId}`, { key: admin.key })
    expect(await read(teamId, admin.key)).toEqual([])
    expect(await inside(teamId, (instance: any) => instance.sql.exec('SELECT count(*) AS n FROM signals').one().n)).toBe(0)
  })

  it('prunes old signals and done handoffs while keeping a recent open handoff', async () => {
    const { teamId, admin, linh } = await newTeam()
    const old = await send(teamId, admin.key, { kind: 'win', text: 'Ready' })
    const later = T0 + 7 * DAY + 1
    const done = await send(teamId, admin.key, { kind: 'handoff', to: linh.memberId, text: 'Review' }, later)
    await act(teamId, linh.key, done.body.id, 'take', later)
    const open = await send(teamId, admin.key, { kind: 'handoff', to: linh.memberId, text: 'Review this next' }, later)
    await api('PUT', `/teams/${teamId}/sessions/prune`, { key: admin.key, body: {}, now: later })
    const ids: string[] = await inside(teamId, (instance: any) => instance.sql.exec('SELECT id FROM signals').toArray().map((r: any) => r.id))
    expect(ids).not.toContain(old.body.id)
    expect(ids).not.toContain(done.body.id)
    expect(ids).toContain(open.body.id)
  })

  it('pruning signals clears the shared view for the next poll', async () => {
    const { teamId, admin } = await newTeam()
    await api('PUT', `/teams/${teamId}/sessions/existing`, { key: admin.key, body: {} })
    await send(teamId, admin.key, { kind: 'win', text: 'Ready' })
    const later = T0 + 7 * DAY + 1
    expect((await api('GET', `/teams/${teamId}`, { key: admin.key, now: later })).body.now).toBe(later)
    // This existing-session heartbeat normally retains the cache; pruning a signal is a view-changing write.
    await api('PUT', `/teams/${teamId}/sessions/existing`, { key: admin.key, body: {}, now: later + 1 })
    expect((await api('GET', `/teams/${teamId}`, { key: admin.key, now: later + 2 })).body.now).toBe(later + 2)
  })
})
