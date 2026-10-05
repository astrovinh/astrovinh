import { DurableObject } from 'cloudflare:workers'
import { fail, nameKey, ok, randomHex, randomId, safeEqual, sha256, text } from './util'
import type { Res } from './util'

export const CAPS = { team: 60, name: 40, session: 32, project: 64, branch: 96, line: 120, status: 280 } as const

/** Removes a leading repo folder name from a line: "<folder> \u00b7 main" becomes "main", "<folder>" becomes "". Anything else is kept. */
export function withoutFolder(line: string, folder: string): string {
  if (!folder) return line
  if (line === folder) return ''
  return line.startsWith(`${folder} \u00b7 `) ? line.slice(folder.length + 3) : line
}

export class Team extends DurableObject {
  sql: SqlStorage
  hits = new Map<string, number[]>()
  /** The team view every poll shares; see snapshot(). Changes a member makes clear it, so they show on the next poll. */
  view: { at: number; body: Record<string, unknown> } | null = null

  constructor(ctx: DurableObjectState, env: unknown) {
    super(ctx, env as never)
    this.sql = ctx.storage.sql
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS members (id TEXT PRIMARY KEY, name TEXT NOT NULL, name_key TEXT NOT NULL, key_hash TEXT NOT NULL UNIQUE, is_admin INTEGER NOT NULL, joined_at INTEGER NOT NULL);
      CREATE UNIQUE INDEX IF NOT EXISTS members_name_key ON members (name_key);
      CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, member TEXT NOT NULL, project TEXT NOT NULL, branch TEXT NOT NULL, line TEXT NOT NULL, state TEXT NOT NULL, state_since INTEGER NOT NULL, five_hour REAL, week REAL, started_at INTEGER NOT NULL, seen_at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS segments (session TEXT NOT NULL, member TEXT NOT NULL, start_at INTEGER NOT NULL, end_at INTEGER NOT NULL);
      CREATE INDEX IF NOT EXISTS segments_session_end ON segments (session, end_at);
      CREATE INDEX IF NOT EXISTS segments_end ON segments (end_at);
      CREATE INDEX IF NOT EXISTS sessions_seen ON sessions (seen_at);
      CREATE INDEX IF NOT EXISTS sessions_member_seen ON sessions (member, seen_at);
    `)
    // Teams created before the away status existed already have a members table without these columns.
    const cols = this.sql.exec('PRAGMA table_info(members)').toArray().map(r => String(r.name))
    if (!cols.includes('status')) this.sql.exec("ALTER TABLE members ADD COLUMN status TEXT NOT NULL DEFAULT ''")
    if (!cols.includes('status_at')) this.sql.exec('ALTER TABLE members ADD COLUMN status_at INTEGER NOT NULL DEFAULT 0')
    // Segments recorded before active vs idle existed were all treated as working, so that is the default.
    const segCols = this.sql.exec('PRAGMA table_info(segments)').toArray().map(r => String(r.name))
    if (!segCols.includes('state')) this.sql.exec("ALTER TABLE segments ADD COLUMN state TEXT NOT NULL DEFAULT 'working'")
    this.clearStoredProjects()
  }

  /**
   * The repo folder name is not shared any more. Rows stored before that still hold it, in `project` and, for older
   * clients, as the start of `line`. Runs once; a second construction finds the meta key and does nothing.
   */
  protected clearStoredProjects() {
    if (this.meta('project_cleared') === '1') return
    for (const r of this.sql.exec("SELECT id, project, line FROM sessions WHERE project != ''").toArray()) {
      const line = withoutFolder(String(r.line), String(r.project))
      if (line !== String(r.line)) this.sql.exec('UPDATE sessions SET line = ? WHERE id = ?', line, String(r.id))
    }
    this.sql.exec("UPDATE sessions SET project = ''")
    this.setMeta('project_cleared', '1')
    this.view = null
  }

  protected meta(k: string): string | null {
    const r = this.sql.exec('SELECT v FROM meta WHERE k = ?', k).toArray()[0]
    return r ? String(r.v) : null
  }

  protected setMeta(k: string, v: string) {
    this.sql.exec('INSERT INTO meta (k, v) VALUES (?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v', k, v)
  }

  /** Adds a member, or returns null when another member already has this name (unique name_key). */
  protected async addMember(name: string, isAdmin: boolean, now: number) {
    const id = randomId(12)
    const key = randomHex(32)
    const keyHash = await sha256(key)
    try {
      this.sql.exec('INSERT INTO members (id, name, name_key, key_hash, is_admin, joined_at) VALUES (?, ?, ?, ?, ?, ?)', id, name, nameKey(name), keyHash, isAdmin ? 1 : 0, now)
    } catch (e) {
      if (/UNIQUE constraint failed: members\.name_key/i.test(String(e))) return null
      throw e
    }
    this.view = null
    return { id, key }
  }

  protected nameTaken(name: string): boolean {
    return this.sql.exec('SELECT 1 FROM members WHERE name_key = ?', nameKey(name)).toArray().length > 0
  }

  /** True when `id` already made `perMinute` calls in the last minute. */
  protected limited(id: string, perMinute: number, now: number): boolean {
    const recent = (this.hits.get(id) ?? []).filter(t => now - t < 60_000)
    const over = recent.length >= perMinute
    if (!over) recent.push(now)
    this.hits.set(id, recent)
    return over
  }

  async create(teamId: string, body: any, now: number): Promise<Res> {
    if (this.meta('team')) return fail(409, 'That team already exists')
    const team = text(body?.team, CAPS.team)
    const name = text(body?.name, CAPS.name)
    if (!team || !name) return fail(400, 'Give a team name and your name')
    const code = randomId(8)
    this.setMeta('team', team)
    this.setMeta('id', teamId)
    this.setMeta('code', code)
    const m = await this.addMember(name, true, now)
    if (!m) return fail(409, `Someone on the team is already called ${name}. Join with a different name.`)
    return ok({ teamId, team, joinCode: `${teamId}.${code}`, memberId: m.id, key: m.key, isAdmin: true })
  }

  async join(body: any, now: number): Promise<Res> {
    const code = this.meta('code')
    if (!code) return fail(404, 'No team has that code. Check the code with the person who sent it.')
    if (this.limited('join', 10, now)) return fail(429, 'Too many join attempts. Wait a minute and try again.')
    if (!safeEqual(String(body?.code ?? ''), code)) return fail(403, 'That join code is not valid. Ask the team admin for the current one.')
    const name = text(body?.name, CAPS.name)
    if (!name) return fail(400, 'Give your name')
    if (this.nameTaken(name)) return fail(409, `Someone on the team is already called ${name}. Join with a different name.`)
    const m = await this.addMember(name, false, now)
    if (!m) return fail(409, `Someone on the team is already called ${name}. Join with a different name.`)
    return ok({ teamId: this.meta('id'), team: this.meta('team'), memberId: m.id, key: m.key, isAdmin: false })
  }
  static readonly OFFLINE_AFTER_MS = 150_000
  static readonly KEEP_MS = 7 * 86_400_000
  static readonly PRUNE_EVERY_MS = 3_600_000
  static readonly WINDOW_MS = 12 * 3_600_000
  static readonly VIEW_MS = 30_000

  protected async me(key: string): Promise<{ id: string; name: string; isAdmin: boolean } | null> {
    if (!key) return null
    const r = this.sql.exec('SELECT id, name, is_admin FROM members WHERE key_hash = ?', await sha256(key)).toArray()[0]
    return r ? { id: String(r.id), name: String(r.name), isAdmin: Number(r.is_admin) === 1 } : null
  }

  /** Deletes rows older than KEEP_MS, at most once an hour. */
  protected prune(now: number) {
    if (now - Number(this.meta('pruned_at') ?? 0) < Team.PRUNE_EVERY_MS) return
    this.sql.exec('DELETE FROM segments WHERE end_at < ?', now - Team.KEEP_MS)
    this.sql.exec('DELETE FROM sessions WHERE seen_at < ?', now - Team.KEEP_MS)
    this.setMeta('pruned_at', String(now))
  }

  async heartbeat(key: string, sessionId: string, body: any, now: number): Promise<Res> {
    const me = await this.me(key)
    if (!me) return fail(401, 'Not a member of this team')
    const sid = text(sessionId, CAPS.session)
    if (!sid || !/^[A-Za-z0-9_-]+$/.test(sid)) return fail(400, 'Bad session id')
    const existing = this.sql.exec('SELECT member, state, state_since FROM sessions WHERE id = ?', sid).toArray()[0]
    if (existing && String(existing.member) !== me.id) return fail(403, 'That session belongs to someone else')
    // Charged only after the ownership check, so a teammate cannot use up this session's allowance.
    if (this.limited(`hb:${sid}`, 2, now)) return fail(429, 'Too many heartbeats')

    const state = body?.state === 'idle' ? 'idle' : 'working'
    const since = existing && String(existing.state) === state ? Number(existing.state_since) : now
    const pct = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 100 ? v : null)
    const startedAt = typeof body?.startedAt === 'number' && Number.isFinite(body.startedAt) ? body.startedAt : now
    this.sql.exec(
      `INSERT INTO sessions (id, member, project, branch, line, state, state_since, five_hour, week, started_at, seen_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET project = excluded.project, branch = excluded.branch, line = excluded.line,
         state = excluded.state, state_since = excluded.state_since, five_hour = excluded.five_hour, week = excluded.week,
         started_at = excluded.started_at, seen_at = excluded.seen_at`,
      // The repo folder name is not shared any more: older clients still send it as `project` and at the start of `line`; both are dropped here.
      sid, me.id, '', text(body?.branch, CAPS.branch), withoutFolder(text(body?.line, CAPS.line), text(body?.project, CAPS.project)),
      state, since, pct(body?.fiveHour), pct(body?.week), startedAt, now
    )
    // A new session shows on the next poll; an existing one waits for the shared view to rebuild, or every heartbeat would rebuild it.
    if (!existing) this.view = null

    // One continuous run per state: a state change inside the window closes the old run at its end and opens the next from there.
    const last = this.sql.exec('SELECT rowid AS rid, end_at, state FROM segments WHERE session = ? ORDER BY end_at DESC LIMIT 1', sid).toArray()[0]
    const insertSegment = (start: number) => this.sql.exec('INSERT INTO segments (session, member, start_at, end_at, state) VALUES (?, ?, ?, ?, ?)', sid, me.id, start, now, state)
    if (last && now - Number(last.end_at) < Team.OFFLINE_AFTER_MS) {
      if (String(last.state) === state) this.sql.exec('UPDATE segments SET end_at = ? WHERE rowid = ?', now, last.rid)
      else insertSegment(Number(last.end_at))
    } else insertSegment(now)

    this.prune(now)
    return ok({ ok: true })
  }

  async snapshot(key: string, now: number): Promise<Res> {
    const me = await this.me(key)
    if (!me) return fail(401, 'Not a member of this team')
    if (this.limited(`rd:${me.id}`, 10, now)) return fail(429, 'Too many reads')
    // Every open session polls, so reading the tables per poll costs sessions x team size in rows a day; one read per VIEW_MS serves them all.
    const v = this.view
    const fresh = v !== null && now >= v.at && now - v.at < Team.VIEW_MS
    if (!fresh) this.view = { at: now, body: this.readView(now) }
    return ok({ ...this.view!.body, you: me.id })
  }

  protected readView(now: number): Record<string, unknown> {
    const members =this.sql.exec('SELECT id, name, status, status_at FROM members ORDER BY joined_at, rowid').toArray()
    // Sessions seen in the last 12 hours, plus each member's most recent one of any age ("seen 2d ago").
    const sessions = this.sql
      .exec(
        `SELECT * FROM sessions WHERE seen_at >= ?
         UNION
         SELECT s.* FROM members m JOIN sessions s
           ON s.id = (SELECT id FROM sessions x WHERE x.member = m.id ORDER BY x.seen_at DESC, x.rowid DESC LIMIT 1)
         ORDER BY seen_at DESC`,
        now - Team.WINDOW_MS
      )
      .toArray()
    const segments = this.sql.exec('SELECT session, member, start_at, end_at, state FROM segments WHERE end_at >= ? ORDER BY start_at', now - Team.WINDOW_MS).toArray()
    return {
      team: this.meta('team'),
      now,
      members: members.map(m => ({
        id: String(m.id), name: String(m.name),
        status: String(m.status) || null, statusAt: String(m.status) ? Number(m.status_at) : null
      })),
      sessions: sessions.map(s => ({
        id: String(s.id), member: String(s.member), project: '', branch: String(s.branch), line: String(s.line),
        state: String(s.state), stateSince: Number(s.state_since), fiveHour: s.five_hour === null ? null : Number(s.five_hour),
        week: s.week === null ? null : Number(s.week), startedAt: Number(s.started_at), seenAt: Number(s.seen_at)
      })),
      segments: segments.map(s => ({ session: String(s.session), member: String(s.member), start: Number(s.start_at), end: Number(s.end_at), state: String(s.state) }))
    }
  }

  /** Sets or clears the caller's own away status. An empty result clears it. */
  async setStatus(key: string, body: any, now: number): Promise<Res> {
    const me = await this.me(key)
    if (!me) return fail(401, 'Not a member of this team')
    if (this.limited(`st:${me.id}`, 6, now)) return fail(429, 'Too many status changes. Wait a minute.')
    const status = text(body?.status, CAPS.status)
    if (status) this.sql.exec('UPDATE members SET status = ?, status_at = ? WHERE id = ?', status, now, me.id)
    else this.sql.exec("UPDATE members SET status = '', status_at = 0 WHERE id = ?", me.id)
    this.view = null
    return ok({ ok: true, status: status || null })
  }

  /** Renames the caller. Name keys stay unique across the team; the unique index backs up the check against a race. */
  async rename(key: string, body: any, now: number): Promise<Res> {
    const me = await this.me(key)
    if (!me) return fail(401, 'Not a member of this team')
    if (this.limited(`nm:${me.id}`, 6, now)) return fail(429, 'Too many name changes. Wait a minute.')
    const name = text(body?.name, CAPS.name)
    if (!name) return fail(400, 'Give your new name.')
    const taken = () => fail(409, `Someone on the team is already called ${name}. Pick a different name.`)
    const owner = this.sql.exec('SELECT id FROM members WHERE name_key = ?', nameKey(name)).toArray()[0]
    if (owner && String(owner.id) !== me.id) return taken()
    if (owner && me.name === name) return ok({ ok: true, name })
    try {
      this.sql.exec('UPDATE members SET name = ?, name_key = ? WHERE id = ?', name, nameKey(name), me.id)
    } catch (e) {
      if (/UNIQUE constraint failed: members\.name_key/i.test(String(e))) return taken()
      throw e
    }
    this.view = null
    return ok({ ok: true, name })
  }

  protected deleteMember(id: string) {
    this.sql.exec('DELETE FROM segments WHERE member = ?', id)
    this.sql.exec('DELETE FROM sessions WHERE member = ?', id)
    this.sql.exec('DELETE FROM members WHERE id = ?', id)
    this.view = null
    const hasAdmin = this.sql.exec('SELECT 1 FROM members WHERE is_admin = 1').toArray().length > 0
    const hasMembers = this.sql.exec('SELECT 1 FROM members').toArray().length > 0
    if (!hasAdmin && hasMembers) {
      const next = this.sql.exec('SELECT id FROM members ORDER BY joined_at, rowid LIMIT 1').toArray()[0]
      if (next) this.sql.exec('UPDATE members SET is_admin = 1 WHERE id = ?', String(next.id))
    }
  }

  async leave(key: string): Promise<Res> {
    const me = await this.me(key)
    if (!me) return fail(401, 'Not a member of this team')
    this.deleteMember(me.id)
    return ok({ ok: true })
  }

  async remove(key: string, memberId: string): Promise<Res> {
    const me = await this.me(key)
    if (!me) return fail(401, 'Not a member of this team')
    if (!me.isAdmin) return fail(403, 'Only the team admin can remove someone')
    this.deleteMember(memberId)
    return ok({ ok: true })
  }

  async rotate(key: string): Promise<Res> {
    const me = await this.me(key)
    if (!me) return fail(401, 'Not a member of this team')
    if (!me.isAdmin) return fail(403, 'Only the team admin can change the join code')
    const code = randomId(8)
    this.setMeta('code', code)
    return ok({ joinCode: `${this.meta('id')}.${code}` })
  }
}
