import { Team } from './team'
import { randomId } from './util'
import type { Res } from './util'
import { cookie, WEB_CSP, WEB_HEADERS, webApp, webPage } from './web'
import type { WebRes } from './web'
import { renderWebView } from './web-view'
import type { Snapshot } from '../../../mods/team-pulse/types'

export { Team }

export interface Env {
  TEAM: DurableObjectNamespace<Team>
  ALLOW_TEST_CLOCK?: string
}

const MAX_BODY = 2048
const TEAM_ID = /^[a-z2-9]{10}$/

/** decodeURIComponent that answers null instead of throwing on a malformed escape. */
const decode = (s: string): string | null => {
  try {
    return decodeURIComponent(s)
  } catch {
    return null
  }
}

const json = (r: WebRes) => {
  const headers = new Headers({ 'content-type': 'application/json', ...WEB_HEADERS })
  for (const value of r.cookies ?? []) headers.append('set-cookie', value)
  return new Response(JSON.stringify(r.body), { status: r.status, headers })
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url)
    const testNow = env.ALLOW_TEST_CLOCK === '1' ? Number(req.headers.get('x-now')) : Number.NaN
    const now = Number.isFinite(testNow) && testNow > 0 ? testNow : Date.now()
    const parts = url.pathname.split('/').filter(Boolean)
    if (parts[0] === 'web') {
      // Check before body parsing or any storage work, including unknown browser POST routes.
      if (req.method === 'POST' && req.headers.get('origin') !== url.origin) return json({ status: 403, body: { error: 'Browser requests must come from this origin' } })
      if (req.method === 'GET' && url.pathname === '/web/assets/app.js') {
        return new Response(webApp, { headers: { ...WEB_HEADERS, 'content-type': 'text/javascript; charset=utf-8', 'content-security-policy': WEB_CSP } })
      }
      if (req.method === 'GET' && parts.length === 2 && TEAM_ID.test(parts[1]!)) {
        return new Response(webPage, { headers: { ...WEB_HEADERS, 'content-type': 'text/html; charset=utf-8', 'content-security-policy': WEB_CSP } })
      }
    }

    const raw = req.method === 'GET' || req.method === 'DELETE' ? '' : await req.text()
    if (raw.length > MAX_BODY) return json({ status: 413, body: { error: 'Request too large' } })
    let body: any = {}
    if (raw) {
      try {
        body = JSON.parse(raw)
      } catch {
        return json({ status: 400, body: { error: 'Body is not JSON' } })
      }
    }
    const key = /^Bearer\s+(.+)$/i.exec(req.headers.get('authorization') ?? '')?.[1] ?? ''
    if (parts[0] === 'web') {
      const teamId = parts[1] ?? ''
      if (!TEAM_ID.test(teamId) || parts.length !== 3) return json({ status: 404, body: { error: 'Not found' } })
      const t = team(env, teamId)
      switch (`${req.method} ${parts[2]}`) {
        case 'POST challenge': return json(await t.webChallenge(now))
        case 'POST exchange': return json(await t.webExchange(cookie(req, `__Host-tpc_${teamId}`), now))
        case 'GET snapshot': return json(await t.webSnapshot(cookie(req, `__Host-tpw_${teamId}`), now))
        case 'GET view': {
          // Reuse the exact session, caller filtering, cache and rate limit of task 30.
          const r: Res = await t.webSnapshot(cookie(req, `__Host-tpw_${teamId}`), now)
          if (r.status !== 200) return json(r)
          return new Response(renderWebView(r.body as Snapshot), { headers: { ...WEB_HEADERS, 'content-type': 'text/html; charset=utf-8', 'content-security-policy': WEB_CSP } })
        }
        case 'POST signout': return json(await t.webSignout(cookie(req, `__Host-tpw_${teamId}`), now))
        default: return json({ status: 404, body: { error: 'Not found' } })
      }
    }
    if (parts[0] !== 'teams') return json({ status: 404, body: { error: 'Not found' } })

    if (parts.length === 1 && req.method === 'POST') {
      const teamId = randomId(10)
      return json(await team(env, teamId).create(teamId, body, now))
    }

    const teamId = parts[1] ?? ''
    if (!TEAM_ID.test(teamId)) return json({ status: 404, body: { error: 'No such team' } })
    const t = team(env, teamId)
    const route = `${req.method} ${parts.slice(2).join('/').replace(/^(sessions|members|signals)\/[^/]+$/, '$1/:id')}`

    switch (route) {
      case 'POST web/approve':
        return json(await t.webApprove(key, body, now))
      case 'POST web/revoke':
        return json(await t.webRevoke(key))
      case 'POST join':
        return json(await t.join(body, now))
      case 'POST pair':
        return json(await t.pair(key, now))
      case 'POST pair/join':
        return json(await t.pairJoin(body, now))
      case 'POST signals':
        return json(await t.sendSignal(key, body, now))
      case 'PUT signals/:id':
        return json(await t.finishHandoff(key, decode(parts[3] ?? '') ?? '', body, now))
      case 'PUT sessions/:id': {
        const sid = decode(parts[3] ?? '')
        if (sid === null) return json({ status: 400, body: { error: 'Bad session id' } })
        return json(await t.heartbeat(key, sid, body, now))
      }
      case 'PUT status':
        return json(await t.setStatus(key, body, now))
      case 'PUT clock':
        return json(await t.setClock(key, body, now))
      case 'PUT name':
        return json(await t.rename(key, body, now))
      case 'GET ':
        return json(await t.snapshot(key, now))
      case 'POST leave':
        return json(await t.leave(key))
      case 'DELETE members/:id': {
        const id = decode(parts[3] ?? '')
        if (id === null) return json({ status: 400, body: { error: 'Bad member id' } })
        return json(await t.remove(key, id))
      }
      case 'POST code':
        return json(await t.rotate(key))
      default:
        return json({ status: 404, body: { error: 'Not found' } })
    }
  }
}

function team(env: Env, teamId: string) {
  return env.TEAM.get(env.TEAM.idFromName(teamId))
}
