import { Team } from './team'
import { randomId } from './util'
import type { Res } from './util'

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

const json = (r: Res) =>
  new Response(JSON.stringify(r.body), { status: r.status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } })

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url)
    const testNow = env.ALLOW_TEST_CLOCK === '1' ? Number(req.headers.get('x-now')) : Number.NaN
    const now = Number.isFinite(testNow) && testNow > 0 ? testNow : Date.now()

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
    const key = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '')
    const parts = url.pathname.split('/').filter(Boolean)
    if (parts[0] !== 'teams') return json({ status: 404, body: { error: 'Not found' } })

    if (parts.length === 1 && req.method === 'POST') {
      const teamId = randomId(10)
      return json(await team(env, teamId).create(teamId, body, now))
    }

    const teamId = parts[1] ?? ''
    if (!TEAM_ID.test(teamId)) return json({ status: 404, body: { error: 'No such team' } })
    const t = team(env, teamId)
    const route = `${req.method} ${parts.slice(2).join('/').replace(/^(sessions|members)\/[^/]+$/, '$1/:id')}`

    switch (route) {
      case 'POST join':
        return json(await t.join(body, now))
      case 'PUT sessions/:id': {
        const sid = decode(parts[3] ?? '')
        if (sid === null) return json({ status: 400, body: { error: 'Bad session id' } })
        return json(await t.heartbeat(key, sid, body, now))
      }
      case 'PUT status':
        return json(await t.setStatus(key, body, now))
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
