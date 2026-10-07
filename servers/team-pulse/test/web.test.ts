import { SELF, env, runInDurableObject } from 'cloudflare:test'
import { describe, expect, it } from 'vitest'
import { sha256 } from '../src/util'
import { T0, api, newTeam } from './helpers'

const ORIGIN = 'https://pulse.test'
const DAYS_30 = 30 * 86_400_000
const INVALID = 'That code is not valid or has expired. Refresh the page for a new one.'
const CSP = "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'"
const web = async (method: string, path: string, opts: { cookie?: string; origin?: string | null; now?: number; raw?: string; key?: string; authorization?: string } = {}) => {
  const headers: Record<string, string> = { 'x-now': String(opts.now ?? T0) }
  if (opts.cookie) headers.cookie = opts.cookie
  if (opts.key) headers.authorization = `Bearer ${opts.key}`
  if (opts.authorization) headers.authorization = opts.authorization
  if (opts.origin !== null) headers.origin = opts.origin ?? ORIGIN
  const res = await SELF.fetch(`${ORIGIN}${path}`, { method, headers, body: opts.raw })
  const text = await res.text()
  return { status: res.status, body: res.headers.get('content-type')?.includes('application/json') ? JSON.parse(text) : null, text, headers: res.headers, cookies: res.headers.getSetCookie() }
}
type WebReply = Awaited<ReturnType<typeof web>>
const cookieOf = (r: WebReply, name: string) => r.cookies.find(c => c.startsWith(`${name}=`))?.split(';')[0] ?? ''
const challenge = async (teamId: string, now = T0) => {
  const r = await web('POST', `/web/${teamId}/challenge`, { now })
  expect(r.status).toBe(200)
  expect(r.body.code).toMatch(/^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{6}$/)
  expect(r.body.expiresAt).toBe(now + 600_000)
  return { ...r, cookie: cookieOf(r, `__Host-tpc_${teamId}`) }
}
const approve = (teamId: string, key: string, code: unknown, now = T0) => api('POST', `/teams/${teamId}/web/approve`, { key, body: { code }, now })
const exchange = (teamId: string, cookie: string, now = T0) => web('POST', `/web/${teamId}/exchange`, { cookie, now })
const connect = async (teamId: string, key: string, now = T0) => {
  const c = await challenge(teamId, now)
  expect((await approve(teamId, key, c.body.code, now)).status).toBe(200)
  const r = await exchange(teamId, c.cookie, now)
  expect(r.status).toBe(200)
  return { ...r, pending: c, cookie: cookieOf(r, `__Host-tpw_${teamId}`) }
}
const snapshot = (teamId: string, cookie: string, now = T0) => web('GET', `/web/${teamId}/snapshot`, { cookie, now })
const inside = async (teamId: string, fn: (instance: any) => any) => {
  const ns = (env as any).TEAM as DurableObjectNamespace
  return (runInDurableObject as any)(ns.get(ns.idFromName(teamId)), fn)
}
const otherKey = async (teamId: string, key: string) => {
  const p = await api('POST', `/teams/${teamId}/pair`, { key })
  const r = await api('POST', `/teams/${teamId}/pair/join`, { body: { code: p.body.pairCode.split('.')[1] } })
  expect(r.status).toBe(200)
  return r.body.key as string
}

describe('read-only browser sign-in', () => {
  it('full cookie flow returns exactly the Bearer snapshot plus sessionExpiresAt', async () => {
    const { teamId, linh } = await newTeam()
    const browser = await connect(teamId, linh.key)
    const bearer = await api('GET', `/teams/${teamId}`, { key: linh.key })
    const r = await snapshot(teamId, browser.cookie)
    expect(r.status).toBe(200)
    expect(r.body).toEqual({ ...bearer.body, sessionExpiresAt: T0 + DAYS_30 })
  })

  it("a third member's handoff never appears in web reads", async () => {
    const { teamId, code, admin, linh } = await newTeam()
    const mona = (await api('POST', `/teams/${teamId}/join`, { body: { code, name: 'Mona' } })).body
    const privateSignal = await api('POST', `/teams/${teamId}/signals`, { key: admin.key, body: { kind: 'handoff', to: mona.memberId, text: 'Private note for Mona' } })
    const mine = await api('POST', `/teams/${teamId}/signals`, { key: mona.key, body: { kind: 'handoff', to: linh.memberId, text: 'For Linh' } })
    const sent = await api('POST', `/teams/${teamId}/signals`, { key: linh.key, body: { kind: 'handoff', to: admin.memberId, text: 'From Linh' } })
    expect(privateSignal.status).toBe(200)
    const browser = await connect(teamId, linh.key)
    await api('GET', `/teams/${teamId}`, { key: admin.key })
    const r = await snapshot(teamId, browser.cookie)
    expect(r.body.signals.map((s: any) => s.id)).toEqual([sent.body.id, mine.body.id])
    expect(r.text.includes('Private note for Mona')).toBe(false)
    expect(r.body).toEqual({ ...(await api('GET', `/teams/${teamId}`, { key: linh.key })).body, sessionExpiresAt: T0 + DAYS_30 })
  })

  it('unapproved exchange waits; only the browser holding the secret can exchange', async () => {
    const { teamId, linh } = await newTeam()
    const c = await challenge(teamId)
    expect((await exchange(teamId, c.cookie)).body).toEqual({ waiting: true })
    expect((await exchange(teamId, c.cookie)).status).toBe(202)
    const approved = await approve(teamId, linh.key, c.body.code)
    expect(approved.status).toBe(200)
    expect(JSON.stringify(approved.body).includes(linh.key)).toBe(false)
    for (const cookie of ['', `__Host-tpc_${teamId}=${c.body.code}`]) expect((await exchange(teamId, cookie)).status).toBe(403)
    expect((await exchange(teamId, c.cookie)).status).toBe(200)
    expect((await exchange(teamId, c.cookie)).status).toBe(403)
  })

  it('concurrent exchanges consume the approved challenge exactly once', async () => {
    const { teamId, linh } = await newTeam()
    const c = await challenge(teamId)
    await approve(teamId, linh.key, c.body.code)
    const replies = await Promise.all([exchange(teamId, c.cookie), exchange(teamId, c.cookie)])
    expect(replies.map(r => r.status).sort()).toEqual([200, 403])
  })

  it('approval normalizes the code and rejects wrong, expired or already approved codes', async () => {
    const { teamId, linh } = await newTeam()
    const c = await challenge(teamId)
    expect(await approve(teamId, linh.key, 'bad')).toEqual({ status: 403, body: { error: INVALID } })
    expect((await approve(teamId, linh.key, `  ${c.body.code.toLowerCase()}  `)).status).toBe(200)
    expect(await approve(teamId, linh.key, c.body.code)).toEqual({ status: 403, body: { error: INVALID } })
    const expired = await challenge(teamId)
    expect(await approve(teamId, linh.key, expired.body.code, T0 + 600_000)).toEqual({ status: 403, body: { error: INVALID } })
  })

  it('expired challenges are refused at ten minutes even before pruning', async () => {
    const { teamId, linh } = await newTeam()
    const c = await challenge(teamId)
    await approve(teamId, linh.key, c.body.code)
    expect((await exchange(teamId, c.cookie, T0 + 600_000)).status).toBe(403)
    expect(await inside(teamId, t => t.sql.exec('SELECT COUNT(*) AS n FROM web_challenges').one().n)).toBe(1)
  })

  it('a web session expires after 30 days and is refused by timestamp before pruning', async () => {
    const { teamId, linh } = await newTeam()
    const browser = await connect(teamId, linh.key)
    expect((await snapshot(teamId, browser.cookie, T0 + DAYS_30 - 1)).status).toBe(200)
    expect((await snapshot(teamId, browser.cookie, T0 + DAYS_30)).status).toBe(403)
    expect((await web('POST', `/web/${teamId}/signout`, { cookie: browser.cookie, now: T0 + DAYS_30 })).status).toBe(403)
    expect(await inside(teamId, t => t.sql.exec('SELECT COUNT(*) AS n FROM web_sessions').one().n)).toBe(1)
  })

  it('the web cookie is refused on every existing authenticated teams route', async () => {
    const { teamId, admin, linh } = await newTeam()
    const browser = await connect(teamId, admin.key)
    const token = browser.cookie.split('=')[1]
    const routes = [
      ['GET', ''], ['PUT', '/sessions/mac'], ['PUT', '/status'], ['PUT', '/clock'], ['PUT', '/name'],
      ['POST', '/signals'], ['PUT', '/signals/example'], ['DELETE', `/members/${linh.memberId}`],
      ['POST', '/leave'], ['POST', '/code'], ['POST', '/pair'], ['POST', '/web/approve'], ['POST', '/web/revoke']
    ]
    for (const [method, path] of routes) {
      for (const key of [undefined, token]) {
        const r = await web(method!, `/teams/${teamId}${path}`, { cookie: browser.cookie, key, raw: method === 'GET' || method === 'DELETE' ? undefined : '{}' })
        expect(r.status, `${method} ${path}, cookie${key ? ' plus token as Bearer' : ''}`).toBe(401)
      }
    }
    expect((await api('PUT', `/teams/${teamId}/status`, { key: admin.key, body: { status: 'still allowed' } })).status).toBe(200)
  })

  it('existing team routes accept member keys only with the Bearer scheme', async () => {
    const { teamId, linh } = await newTeam()
    for (const authorization of [linh.key, `Basic ${linh.key}`]) {
      expect((await web('PUT', `/teams/${teamId}/status`, { authorization, raw: '{}' })).status).toBe(401)
      expect((await web('POST', `/teams/${teamId}/web/revoke`, { authorization })).status).toBe(401)
    }
  })

  it('the served script preserves the slash escape so browsers can execute it', async () => {
    const r = await web('GET', '/web/assets/app.js')
    expect(r.text).toContain(String.raw`location.pathname.replace(/\/$/, '')`)
  })

  it('ambiguous duplicate cookies and member keys used as browser cookies are refused', async () => {
    const { teamId, linh } = await newTeam()
    const browser = await connect(teamId, linh.key)
    expect((await snapshot(teamId, `${browser.cookie}; ${browser.cookie}`)).status).toBe(403)
    expect((await snapshot(teamId, `__Host-tpw_${teamId}=${linh.key}`)).status).toBe(403)
    expect((await exchange(teamId, `${browser.pending.cookie}; ${browser.pending.cookie}`)).status).toBe(403)
  })

  it('every browser POST requires exactly the Worker origin before parsing its body', async () => {
    const { teamId, linh } = await newTeam()
    const browser = await connect(teamId, linh.key)
    for (const path of ['challenge', 'exchange', 'signout', 'unknown']) {
      for (const origin of [null, 'https://elsewhere.test', 'null', `${ORIGIN}/`]) {
        const r = await web('POST', `/web/${teamId}/${path}`, { cookie: browser.cookie, origin, raw: 'not JSON' })
        expect(r.status).toBe(403)
        expect(r.headers.get('cache-control')).toBe('no-store')
      }
    }
    expect((await snapshot(teamId, browser.cookie)).status).toBe(200)
  })

  it('cookies have exact host-only attributes, separate team names and the required lifetimes', async () => {
    const { teamId, linh } = await newTeam()
    const browser = await connect(teamId, linh.key)
    expect(browser.pending.cookies).toEqual([`${browser.pending.cookie}; Secure; HttpOnly; SameSite=Strict; Path=/; Max-Age=600`])
    expect(browser.cookies).toEqual([
      `${browser.cookie}; Secure; HttpOnly; SameSite=Strict; Path=/; Max-Age=2592000`,
      `__Host-tpc_${teamId}=; Secure; HttpOnly; SameSite=Strict; Path=/; Max-Age=0`
    ])
    const second = await newTeam()
    const b2 = await connect(second.teamId, second.linh.key)
    const both = `${browser.cookie}; ${b2.cookie}`
    expect((await snapshot(teamId, both)).body.you).toBe(linh.memberId)
    expect((await snapshot(second.teamId, both)).body.you).toBe(second.linh.memberId)
    expect((await snapshot(second.teamId, browser.cookie)).status).toBe(403)
  })

  it('signout deletes only that session and clears its cookie', async () => {
    const { teamId, linh } = await newTeam()
    const browser = await connect(teamId, linh.key)
    const other = await connect(teamId, linh.key)
    const r = await web('POST', `/web/${teamId}/signout`, { cookie: browser.cookie })
    expect(r.status).toBe(200)
    expect(r.cookies).toEqual([`__Host-tpw_${teamId}=; Secure; HttpOnly; SameSite=Strict; Path=/; Max-Age=0`])
    expect((await snapshot(teamId, browser.cookie)).status).toBe(403)
    expect((await snapshot(teamId, other.cookie)).status).toBe(200)
    expect(await inside(teamId, t => t.sql.exec('SELECT COUNT(*) AS n FROM web_sessions').one().n)).toBe(1)
  })

  it('member-key revoke deletes every browser and approved challenge for that member across devices', async () => {
    const { teamId, linh, admin } = await newTeam()
    const key2 = await otherKey(teamId, linh.key)
    const a = await connect(teamId, linh.key)
    const b = await connect(teamId, key2)
    const keep = await connect(teamId, admin.key)
    const pending = await challenge(teamId)
    await approve(teamId, key2, pending.body.code)
    expect((await api('POST', `/teams/${teamId}/web/revoke`, { key: linh.key })).status).toBe(200)
    for (const browser of [a, b]) expect((await snapshot(teamId, browser.cookie)).status).toBe(403)
    expect((await exchange(teamId, pending.cookie)).status).toBe(403)
    expect((await snapshot(teamId, keep.cookie)).status).toBe(200)
    expect(await inside(teamId, t => [t.sql.exec('SELECT COUNT(*) AS n FROM web_sessions WHERE member = ?', linh.memberId).one().n, t.sql.exec('SELECT COUNT(*) AS n FROM web_challenges WHERE member = ?', linh.memberId).one().n])).toEqual([0, 0])
  })

  it('device leave revokes sessions and challenges approved by that key only', async () => {
    const { teamId, linh } = await newTeam()
    const key2 = await otherKey(teamId, linh.key)
    const a = await connect(teamId, linh.key)
    const b = await connect(teamId, key2)
    const pendingA = await challenge(teamId)
    const pendingB = await challenge(teamId)
    await approve(teamId, linh.key, pendingA.body.code)
    await approve(teamId, key2, pendingB.body.code)
    expect((await api('POST', `/teams/${teamId}/leave`, { key: linh.key })).body.removed).toBe('device')
    expect((await snapshot(teamId, a.cookie)).status).toBe(403)
    expect((await exchange(teamId, pendingA.cookie)).status).toBe(403)
    expect((await snapshot(teamId, b.cookie)).status).toBe(200)
    expect((await exchange(teamId, pendingB.cookie)).status).toBe(200)
    const hash = await sha256(linh.key)
    expect(await inside(teamId, t => [t.sql.exec('SELECT COUNT(*) AS n FROM web_sessions WHERE source_key = ?', hash).one().n, t.sql.exec('SELECT COUNT(*) AS n FROM web_challenges WHERE source_key = ?', hash).one().n])).toEqual([0, 0])
  })

  it('member removal revokes all sessions and challenges across devices', async () => {
    const { teamId, linh, admin } = await newTeam()
    const key2 = await otherKey(teamId, linh.key)
    const a = await connect(teamId, linh.key)
    const b = await connect(teamId, key2)
    const pending = await challenge(teamId)
    await approve(teamId, key2, pending.body.code)
    await api('DELETE', `/teams/${teamId}/members/${linh.memberId}`, { key: admin.key })
    for (const browser of [a, b]) expect((await snapshot(teamId, browser.cookie)).status).toBe(403)
    expect((await exchange(teamId, pending.cookie)).status).toBe(403)
    expect(await inside(teamId, t => [t.sql.exec('SELECT COUNT(*) AS n FROM web_sessions').one().n, t.sql.exec('SELECT COUNT(*) AS n FROM web_challenges').one().n])).toEqual([0, 0])
  })

  it('a web session does not stop last-device leave from deleting the member', async () => {
    const { teamId, linh, admin } = await newTeam()
    const browser = await connect(teamId, linh.key)
    expect((await api('POST', `/teams/${teamId}/leave`, { key: linh.key })).body.removed).toBe('member')
    expect((await snapshot(teamId, browser.cookie)).status).toBe(403)
    expect((await api('GET', `/teams/${teamId}`, { key: admin.key })).body.members.map((m: any) => m.name)).toEqual(['Astro'])
  })

  it('web reads reuse the shared cached view without writing activity sessions or segments', async () => {
    const { teamId, linh } = await newTeam()
    const browser = await connect(teamId, linh.key)
    await api('PUT', `/teams/${teamId}/sessions/mac`, { key: linh.key, body: { line: 'first' } })
    const bearer = await api('GET', `/teams/${teamId}`, { key: linh.key, now: T0 + 1_000 })
    await api('PUT', `/teams/${teamId}/sessions/mac`, { key: linh.key, body: { line: 'second' }, now: T0 + 2_000 })
    const before = await inside(teamId, t => [t.sql.exec('SELECT * FROM sessions').toArray(), t.sql.exec('SELECT * FROM segments').toArray()])
    const cached = await snapshot(teamId, browser.cookie, T0 + 29_000)
    expect(cached.body).toEqual({ ...bearer.body, sessionExpiresAt: T0 + DAYS_30 })
    const fresh = await snapshot(teamId, browser.cookie, T0 + 31_000)
    expect(fresh.body.now).toBe(T0 + 31_000)
    expect(fresh.body.sessions[0].line).toBe('second')
    expect(await inside(teamId, t => [t.sql.exec('SELECT * FROM sessions').toArray(), t.sql.exec('SELECT * FROM segments').toArray()])).toEqual(before)
  })

  it('web reads share 4/min per member and never starve the panels 10/min', async () => {
    const { teamId, linh } = await newTeam()
    const a = await connect(teamId, linh.key)
    const b = await connect(teamId, linh.key)
    for (const cookie of [a.cookie, b.cookie, a.cookie, b.cookie]) expect((await snapshot(teamId, cookie)).status).toBe(200)
    expect((await snapshot(teamId, b.cookie)).status).toBe(429)
    for (let n = 0; n < 10; n++) expect((await api('GET', `/teams/${teamId}`, { key: linh.key })).status).toBe(200)
    expect((await api('GET', `/teams/${teamId}`, { key: linh.key })).status).toBe(429)
    expect((await snapshot(teamId, a.cookie, T0 + 60_000)).status).toBe(200)
  })

  it('challenge creation is limited to 20/min per team', async () => {
    const a = await newTeam()
    const b = await newTeam()
    for (let n = 0; n < 20; n++) await challenge(a.teamId)
    expect((await web('POST', `/web/${a.teamId}/challenge`)).status).toBe(429)
    await challenge(b.teamId)
    await challenge(a.teamId, T0 + 60_000)
  })

  it('approval attempts share 6/min across member keys and require a member key', async () => {
    const { teamId, linh, admin } = await newTeam()
    const key2 = await otherKey(teamId, linh.key)
    expect((await approve(teamId, '', 'wrong')).status).toBe(401)
    for (let n = 0; n < 6; n++) expect((await approve(teamId, n % 2 ? linh.key : key2, 'wrong')).status).toBe(403)
    expect((await approve(teamId, key2, 'wrong')).status).toBe(429)
    expect((await approve(teamId, admin.key, 'wrong')).status).toBe(403)
    expect((await approve(teamId, linh.key, 'wrong', T0 + 60_000)).status).toBe(403)
  })

  it('storage holds only hashes of credentials and pruning deletes expired web rows', async () => {
    const { teamId, linh } = await newTeam()
    const browser = await connect(teamId, linh.key)
    const secretHash = await sha256(browser.pending.cookie.split('=')[1]!)
    const codeHash = await sha256(browser.pending.body.code)
    const tokenHash = await sha256(browser.cookie.split('=')[1]!)
    const sourceHash = await sha256(linh.key)
    const rows = await inside(teamId, t => ({ challenges: t.sql.exec('SELECT * FROM web_challenges').toArray(), sessions: t.sql.exec('SELECT * FROM web_sessions').toArray() }))
    expect(rows.challenges).toEqual([{ secret_hash: secretHash, code_hash: codeHash, member: linh.memberId, source_key: sourceHash, created_at: T0, expires_at: T0 + 600_000, approved_at: T0, consumed_at: T0 }])
    expect(rows.sessions).toEqual([{ token_hash: tokenHash, member: linh.memberId, source_key: sourceHash, created_at: T0, expires_at: T0 + DAYS_30 }])
    for (const credential of [linh.key, browser.pending.body.code, browser.pending.cookie.split('=')[1]!, browser.cookie.split('=')[1]!]) expect(JSON.stringify(rows).includes(credential)).toBe(false)
    await api('PUT', `/teams/${teamId}/sessions/mac`, { key: linh.key, now: T0 + DAYS_30 })
    expect(await inside(teamId, t => [t.sql.exec('SELECT COUNT(*) AS n FROM web_challenges').one().n, t.sql.exec('SELECT COUNT(*) AS n FROM web_sessions').one().n])).toEqual([0, 0])
  })

  it('only snapshot returns team data; page and asset obey CSP and all web replies are no-store', async () => {
    const { teamId, linh } = await newTeam()
    const browser = await connect(teamId, linh.key)
    const page = await web('GET', `/web/${teamId}`, { cookie: browser.cookie })
    expect(page.status).toBe(200)
    expect(page.headers.get('content-type')).toContain('text/html')
    expect(page.headers.get('content-security-policy')).toBe(CSP)
    expect(page.headers.get('x-content-type-options')).toBe('nosniff')
    expect(page.headers.get('referrer-policy')).toBe('no-referrer')
    expect(page.text).toContain('<script src="/web/assets/app.js" defer></script>')
    expect(page.text).not.toMatch(/<script(?![^>]*\bsrc=)/)
    const asset = await web('GET', '/web/assets/app.js')
    expect(asset.status).toBe(200)
    expect(asset.headers.get('content-type')).toContain('javascript')
    for (const fragment of ['/challenge', '/exchange', '/snapshot', '/signout', 'textContent', '3000', 'expiresAt']) expect(asset.text).toContain(fragment)
    const error = await web('GET', `/web/${teamId}/unknown`)
    const malformed = await web('POST', `/web/${teamId}/challenge`, { raw: '{' })
    const tooLarge = await web('POST', `/web/${teamId}/challenge`, { raw: 'a'.repeat(2049) })
    const view = await snapshot(teamId, browser.cookie)
    const signout = await web('POST', `/web/${teamId}/signout`, { cookie: browser.cookie })
    expect(view.status).toBe(200)
    expect(signout.status).toBe(200)
    const revoked = await api('POST', `/teams/${teamId}/web/revoke`, { key: linh.key })
    expect(revoked.status).toBe(200)
    expect(JSON.stringify(revoked.body).includes(linh.key)).toBe(false)
    expect(malformed.status).toBe(400)
    expect(tooLarge.status).toBe(413)
    for (const r of [browser.pending, browser, page, asset, error, malformed, tooLarge]) {
      expect(r.headers.get('cache-control')).toBe('no-store')
      for (const credential of [linh.key]) {
        expect(r.text.includes(credential)).toBe(false)
        expect(r.cookies.join(';').includes(credential)).toBe(false)
      }
      expect(r.text.includes(linh.memberId)).toBe(false)
      expect(r.text.includes('Linh')).toBe(false)
    }
    for (const r of [view, signout]) {
      expect(r.headers.get('cache-control')).toBe('no-store')
      expect(r.text.includes(linh.key)).toBe(false)
      expect(r.cookies.join(';').includes(linh.key)).toBe(false)
    }
  })
})
