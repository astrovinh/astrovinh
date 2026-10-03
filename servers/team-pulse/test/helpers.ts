import { SELF } from 'cloudflare:test'

export const T0 = 1_800_000_000_000

export async function api(method: string, path: string, opts: { key?: string; body?: unknown; now?: number; raw?: string } = {}) {
  const headers: Record<string, string> = { 'content-type': 'application/json', 'x-now': String(opts.now ?? T0) }
  if (opts.key) headers.authorization = `Bearer ${opts.key}`
  const body = opts.raw ?? (opts.body === undefined ? undefined : JSON.stringify(opts.body))
  const res = await SELF.fetch(`https://pulse.test${path}`, { method, headers, body })
  return { status: res.status, body: (await res.json()) as any }
}

export async function newTeam() {
  const created = await api('POST', '/teams', { body: { team: 'Murror', name: 'Astro' } })
  const [teamId, code] = created.body.joinCode.split('.')
  const linh = await api('POST', `/teams/${teamId}/join`, { body: { code, name: 'Linh' } })
  return { teamId, code, admin: created.body, linh: linh.body }
}
