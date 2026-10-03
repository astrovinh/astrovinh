import { DurableObject } from 'cloudflare:workers'
import { fail, ok, randomHex, randomId, safeEqual, sha256, text } from './util'
import type { Res } from './util'

export const CAPS = { team: 60, name: 40, session: 32, project: 64, branch: 96, line: 120 } as const

export class Team extends DurableObject {
  sql: SqlStorage
  hits = new Map<string, number[]>()

  constructor(ctx: DurableObjectState, env: unknown) {
    super(ctx, env as never)
    this.sql = ctx.storage.sql
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS members (id TEXT PRIMARY KEY, name TEXT NOT NULL, key_hash TEXT NOT NULL UNIQUE, is_admin INTEGER NOT NULL, joined_at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, member TEXT NOT NULL, project TEXT NOT NULL, branch TEXT NOT NULL, line TEXT NOT NULL, state TEXT NOT NULL, state_since INTEGER NOT NULL, five_hour REAL, week REAL, started_at INTEGER NOT NULL, seen_at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS segments (session TEXT NOT NULL, member TEXT NOT NULL, start_at INTEGER NOT NULL, end_at INTEGER NOT NULL);
    `)
  }

  protected meta(k: string): string | null {
    const r = this.sql.exec('SELECT v FROM meta WHERE k = ?', k).toArray()[0]
    return r ? String(r.v) : null
  }

  protected setMeta(k: string, v: string) {
    this.sql.exec('INSERT INTO meta (k, v) VALUES (?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v', k, v)
  }

  protected async addMember(name: string, isAdmin: boolean, now: number) {
    const id = randomId(12)
    const key = randomHex(32)
    this.sql.exec('INSERT INTO members (id, name, key_hash, is_admin, joined_at) VALUES (?, ?, ?, ?, ?)', id, name, await sha256(key), isAdmin ? 1 : 0, now)
    return { id, key }
  }

  protected nameTaken(name: string): boolean {
    return this.sql.exec('SELECT 1 FROM members WHERE lower(name) = lower(?)', name).toArray().length > 0
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
    return ok({ teamId, team, joinCode: `${teamId}.${code}`, memberId: m.id, key: m.key, isAdmin: true })
  }

  async join(body: any, now: number): Promise<Res> {
    const code = this.meta('code')
    if (!code) return fail(404, 'No team has that code')
    if (this.limited('join', 10, now)) return fail(429, 'Too many join attempts. Wait a minute and try again.')
    if (!safeEqual(String(body?.code ?? ''), code)) return fail(403, 'That join code is not valid. Ask the team admin for the current one.')
    const name = text(body?.name, CAPS.name)
    if (!name) return fail(400, 'Give your name')
    if (this.nameTaken(name)) return fail(409, `Someone on the team is already called ${name}. Join with a different name.`)
    const m = await this.addMember(name, false, now)
    return ok({ teamId: this.meta('id'), team: this.meta('team'), memberId: m.id, key: m.key, isAdmin: false })
  }
}
