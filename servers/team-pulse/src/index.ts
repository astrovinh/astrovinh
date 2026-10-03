import { Team } from './team'
import { randomId } from './util'
import type { Res } from './util'

export { Team }

export interface Env {
  TEAM: DurableObjectNamespace<Team>
  ALLOW_TEST_CLOCK?: string
}

export const MAX_BODY = 2048
const TEAM_ID = /^[a-z2-9]{10}$/

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
      case 'PUT sessions/:id':
        return json(await t.heartbeat(key, decodeURIComponent(parts[3] ?? ''), body, now))
      case 'GET ':
        return json(await t.snapshot(key, now))
      case 'POST leave':
        return json(await t.leave(key))
      case 'DELETE members/:id':
        return json(await t.remove(key, decodeURIComponent(parts[3] ?? '')))
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
