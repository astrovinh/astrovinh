import { env, runInDurableObject } from 'cloudflare:test'
import { describe, expect, it } from 'vitest'
import { T0, api, newTeam } from './helpers'

const hb = (o: Record<string, unknown> = {}) => ({
  session: 'sessA', project: 'mobile-app', branch: 'fix/restore', line: 'Fixing restore', state: 'working',
  fiveHour: 64, week: 41, startedAt: T0 - 3_600_000, ...o
})

describe('heartbeats and the snapshot', () => {
  it('shares finite activity time clamped to the server clock and defaults other input to zero', async () => {
    const { teamId, linh } = await newTeam()
    const values = [T0 - 60_000, T0 + 60_000, undefined, null, 'recent']
    for (let i = 0; i < values.length; i++) {
      expect((await api('PUT', `/teams/${teamId}/sessions/activity${i}`, { key: linh.key, body: hb({ turnAt: values[i] }) })).status).toBe(200)
    }
    const snap = await api('GET', `/teams/${teamId}`, { key: linh.key })
    const times = Object.fromEntries(snap.body.sessions.map((s: any) => [s.id, s.turnAt]))
    expect(times).toEqual({ activity0: T0 - 60_000, activity1: T0, activity2: 0, activity3: 0, activity4: 0 })
    const ns = (env as any).TEAM as DurableObjectNamespace
    await (runInDurableObject as any)(ns.get(ns.idFromName(teamId)), async (instance: any) => {
      for (const [i, turnAt] of [Number.NaN, Number.POSITIVE_INFINITY].entries()) {
        expect((await instance.heartbeat(linh.key, `nonfinite${i}`, hb({ turnAt }), T0)).status).toBe(200)
      }
      const view = await instance.snapshot(linh.key, T0 + 30_000)
      expect(view.body.sessions.filter((s: any) => s.id.startsWith('nonfinite')).map((s: any) => s.turnAt)).toEqual([0, 0])
    })
  })

  it('activity updates on an existing session wait for the cached view to rebuild', async () => {
    const { teamId, linh } = await newTeam()
    await api('PUT', `/teams/${teamId}/sessions/activity`, { key: linh.key, body: hb({ turnAt: T0 }) })
    expect((await api('GET', `/teams/${teamId}`, { key: linh.key, now: T0 + 1_000 })).body.sessions[0].turnAt).toBe(T0)
    await api('PUT', `/teams/${teamId}/sessions/activity`, { key: linh.key, body: hb({ turnAt: T0 + 2_000 }), now: T0 + 2_000 })
    expect((await api('GET', `/teams/${teamId}`, { key: linh.key, now: T0 + 3_000 })).body.sessions[0].turnAt).toBe(T0)
    expect((await api('GET', `/teams/${teamId}`, { key: linh.key, now: T0 + 31_000 })).body.sessions[0].turnAt).toBe(T0 + 2_000)
  })

  it('construction adds activity time to sessions stored by older clients', async () => {
    const { teamId, linh } = await newTeam()
    await api('PUT', `/teams/${teamId}/sessions/legacy`, { key: linh.key, body: hb() })
    const ns = (env as any).TEAM as DurableObjectNamespace
    const result = await (runInDurableObject as any)(ns.get(ns.idFromName(teamId)), (instance: any, state: any) => {
      const sql = state.storage.sql
      const cols = sql.exec('PRAGMA table_info(sessions)').toArray().map((r: any) => r.name)
      if (cols.includes('turn_at')) sql.exec('ALTER TABLE sessions DROP COLUMN turn_at')
      new (instance.constructor as any)(state, env)
      const column = sql.exec('PRAGMA table_info(sessions)').toArray().find((r: any) => r.name === 'turn_at')
      return { column: column ?? null, rows: column ? sql.exec('SELECT turn_at FROM sessions').toArray() : [] }
    })
    expect(result.column).toMatchObject({ notnull: 1, dflt_value: '0' })
    expect(result.rows).toEqual([{ turn_at: 0 }])
  })

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

  it('never stores the project folder name, even when a client sends one', async () => {
    const { teamId, linh, admin } = await newTeam()
    await api('PUT', `/teams/${teamId}/sessions/sessA`, { key: linh.key, body: hb({ project: 'secret-repo' }) })
    let snap = await api('GET', `/teams/${teamId}`, { key: admin.key, now: T0 + 5_000 })
    expect(snap.body.sessions[0].project).toBe('')
    expect(JSON.stringify(snap.body).includes('secret-repo')).toBe(false)
    // an update from an older client replaces nothing: the stored value stays empty
    await api('PUT', `/teams/${teamId}/sessions/sessA`, { key: linh.key, body: hb({ project: 'secret-repo-2' }), now: T0 + 60_000 })
    snap = await api('GET', `/teams/${teamId}`, { key: admin.key, now: T0 + 70_000 })
    expect(snap.body.sessions[0].project).toBe('')
  })

  it('drops the folder an old client puts at the start of its line', async () => {
    const { teamId, linh, admin } = await newTeam()
    const send = (sid: string, line: string) => api('PUT', `/teams/${teamId}/sessions/${sid}`, { key: linh.key, body: hb({ session: sid, project: 'secret-repo', line }) })
    await send('s1', 'secret-repo \u00b7 main')
    await send('s2', 'secret-repo')
    await send('s3', 'Fixing the secret-repo restore flow')
    await send('s4', 'secret-repository cleanup')
    await send('s5', 'secret-repo \u00b7 ')
    const snap = await api('GET', `/teams/${teamId}`, { key: admin.key, now: T0 + 5_000 })
    const lines = Object.fromEntries(snap.body.sessions.map((s: any) => [s.id, s.line]))
    expect(lines.s1).toBe('main')
    expect(lines.s2).toBe('')
    // a real AI line that only mentions the folder later in the text is kept untouched
    expect(lines.s3).toBe('Fixing the secret-repo restore flow')
    expect(lines.s4).toBe('secret-repository cleanup')
    expect(snap.body.sessions.every((s: any) => s.project === '')).toBe(true)
  })

  it('an old-style body leaves the folder nowhere in the snapshot', async () => {
    const { teamId, linh, admin } = await newTeam()
    await api('PUT', `/teams/${teamId}/sessions/sessA`, { key: linh.key, body: hb({ project: 'secret-repo', line: 'secret-repo \u00b7 main' }) })
    const snap = await api('GET', `/teams/${teamId}`, { key: admin.key, now: T0 + 5_000 })
    expect(JSON.stringify(snap.body).includes('secret-repo')).toBe(false)
    expect(snap.body.sessions[0].line).toBe('main')
  })

  it('a folder name an old client sent as a plain line becomes an empty line', async () => {
    const { teamId, linh, admin } = await newTeam()
    await api('PUT', `/teams/${teamId}/sessions/sessA`, { key: linh.key, body: hb({ project: 'secret-repo', line: 'secret-repo' }) })
    const snap = await api('GET', `/teams/${teamId}`, { key: admin.key, now: T0 + 5_000 })
    expect(snap.body.sessions[0].line).toBe('')
  })

  it('the one-time cleanup clears rows stored before the change, and runs only once', async () => {
    const { teamId, linh, admin } = await newTeam()
    await api('PUT', `/teams/${teamId}/sessions/sessA`, { key: linh.key, body: hb({ line: 'x' }) })
    const ns = (env as any).TEAM as DurableObjectNamespace
    const stub: any = ns.get(ns.idFromName(teamId))
    const rows: any = await (runInDurableObject as any)(stub, (instance: any, state: any) => {
      const sql = state.storage.sql
      const old = (id: string, project: string, line: string) =>
        sql.exec('INSERT INTO sessions (id, member, project, branch, line, state, state_since, five_hour, week, started_at, seen_at) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?, ?)', id, 'm', project, 'main', line, 'working', 1, 1, T0)
      // stored by the code before this change
      old('old1', 'secret-repo', 'secret-repo \u00b7 main')
      old('old2', 'secret-repo', 'secret-repo')
      old('old3', 'secret-repo', 'Fixing the secret-repo flow')
      sql.exec("DELETE FROM meta WHERE k = 'project_cleared'")
      const again = () => new (instance.constructor as any)(state, env)
      again()
      const first = sql.exec('SELECT id, project, line FROM sessions WHERE id LIKE ? ORDER BY id', 'old%').toArray().map((r: any) => [r.id, r.project, r.line])
      const flag = sql.exec("SELECT v FROM meta WHERE k = 'project_cleared'").toArray()[0]?.v
      // a row written afterwards (by hand, with a folder) must survive a second construction: the cleanup is done
      old('late', 'later-repo', 'later-repo')
      again()
      const second = sql.exec("SELECT project, line FROM sessions WHERE id = 'late'").toArray()[0]
      return { first, flag, second }
    })
    expect(rows.first).toEqual([['old1', '', 'main'], ['old2', '', ''], ['old3', '', 'Fixing the secret-repo flow']])
    expect(rows.flag).toBe('1')
    expect(rows.second).toEqual({ project: 'later-repo', line: 'later-repo' })
    // whatever the table holds, the snapshot never returns a project
    const snap = await api('GET', `/teams/${teamId}`, { key: admin.key, now: T0 + 5_000 })
    expect(snap.body.sessions.every((s: any) => s.project === '')).toBe(true)
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
  it('prunes at most once an hour, so a write 10 minutes after a prune leaves old rows alone', async () => {
    const { teamId, linh, admin } = await newTeam()
    const DAY = 86_400_000
    await api('PUT', `/teams/${teamId}/sessions/old`, { key: admin.key, body: hb({ session: 'old' }), now: T0 })
    // Prunes here (first write after 7 days); the old session is exactly 7 days old, so it stays.
    await api('PUT', `/teams/${teamId}/sessions/mid`, { key: linh.key, body: hb({ session: 'mid' }), now: T0 + 7 * DAY })
    // 5 minutes later the old session is 7 days and 5 minutes old, but the last prune was too recent.
    await api('PUT', `/teams/${teamId}/sessions/x`, { key: linh.key, body: hb({ session: 'x' }), now: T0 + 7 * DAY + 300_000 })
    let snap = await api('GET', `/teams/${teamId}`, { key: linh.key, now: T0 + 7 * DAY + 300_000 })
    expect(snap.body.sessions.map((s: any) => s.id)).toContain('old')
    // An hour after the last prune, the next write prunes it.
    await api('PUT', `/teams/${teamId}/sessions/y`, { key: linh.key, body: hb({ session: 'y' }), now: T0 + 7 * DAY + 3_600_000 })
    snap = await api('GET', `/teams/${teamId}`, { key: linh.key, now: T0 + 7 * DAY + 3_600_000 })
    expect(snap.body.sessions.map((s: any) => s.id)).not.toContain('old')
  })

  it('returns sessions seen in the last 12 hours plus each member\'s most recent session of any age', async () => {
    const { teamId, linh, admin } = await newTeam()
    // Linh has one session, seen 2 days ago: the panel can still say "seen 2d ago".
    await api('PUT', `/teams/${teamId}/sessions/linhOnly`, { key: linh.key, body: hb({ session: 'linhOnly' }), now: T0 })
    // Astro has two old sessions; only the newer one is his latest.
    await api('PUT', `/teams/${teamId}/sessions/astroOld`, { key: admin.key, body: hb({ session: 'astroOld' }), now: T0 })
    await api('PUT', `/teams/${teamId}/sessions/astroNew`, { key: admin.key, body: hb({ session: 'astroNew' }), now: T0 + 60_000 })
    const snap = await api('GET', `/teams/${teamId}`, { key: admin.key, now: T0 + 2 * 86_400_000 })
    expect(snap.body.sessions.map((s: any) => s.id).sort()).toEqual(['astroNew', 'linhOnly'])
  })

  it('returns only the latest session for a member whose sessions are all older than 12 hours', async () => {
    const { teamId, linh } = await newTeam()
    await api('PUT', `/teams/${teamId}/sessions/older`, { key: linh.key, body: hb({ session: 'older' }), now: T0 })
    await api('PUT', `/teams/${teamId}/sessions/newer`, { key: linh.key, body: hb({ session: 'newer' }), now: T0 + 60_000 })
    const snap = await api('GET', `/teams/${teamId}`, { key: linh.key, now: T0 + 2 * 86_400_000 })
    expect(snap.body.sessions.map((s: any) => s.id)).toEqual(['newer'])
  })

  it('returns sessions newest first', async () => {
    const { teamId, linh, admin } = await newTeam()
    const now = T0 + 3_600_000
    await api('PUT', `/teams/${teamId}/sessions/a`, { key: linh.key, body: hb({ session: 'a' }), now: now - 300_000 })
    await api('PUT', `/teams/${teamId}/sessions/b`, { key: admin.key, body: hb({ session: 'b' }), now: now - 100_000 })
    await api('PUT', `/teams/${teamId}/sessions/c`, { key: linh.key, body: hb({ session: 'c' }), now: now - 200_000 })
    const snap = await api('GET', `/teams/${teamId}`, { key: linh.key, now })
    expect(snap.body.sessions.map((s: any) => s.id)).toEqual(['b', 'c', 'a'])
  })

  it('keeps a recent session even when it is not the latest', async () => {
    const { teamId, linh } = await newTeam()
    const now = T0 + 3_600_000
    await api('PUT', `/teams/${teamId}/sessions/s1`, { key: linh.key, body: hb({ session: 's1' }), now: now - 120_000 })
    await api('PUT', `/teams/${teamId}/sessions/s2`, { key: linh.key, body: hb({ session: 's2' }), now: now - 60_000 })
    const snap = await api('GET', `/teams/${teamId}`, { key: linh.key, now })
    expect(snap.body.sessions.map((s: any) => s.id).sort()).toEqual(['s1', 's2'])
  })

  it('does not charge a teammate\'s heartbeat rate limit to the session owner', async () => {
    const { teamId, linh, admin } = await newTeam()
    const url = `/teams/${teamId}/sessions/sessA`
    await api('PUT', url, { key: linh.key, body: hb(), now: T0 })
    for (let i = 1; i <= 3; i++) expect((await api('PUT', url, { key: admin.key, body: hb({ line: 'hijack' }), now: T0 + i * 1_000 })).status).toBe(403)
    expect((await api('PUT', url, { key: linh.key, body: hb(), now: T0 + 10_000 })).status).toBe(200)
  })

  it('answers a malformed percent-escape in the path with 400, not a 500', async () => {
    const { teamId, linh } = await newTeam()
    const r = await api('PUT', `/teams/${teamId}/sessions/%E0%A4%A`, { key: linh.key, body: hb() })
    expect(r.status).toBe(400)
    expect(r.body).toEqual({ error: 'Bad session id' })
  })
})
