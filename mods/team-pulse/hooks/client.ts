// Calls to the team server: JSON in and out, a 5 s timeout, never a thrown error.

import { MAX_BACKOFF_MS, TIMEOUT_MS } from './config'

export type CallResult<T> = { ok: true; data: T } | { ok: false; status: number; message: string }

export async function call<T>(
  $: any,
  server: string,
  c: { method: 'GET' | 'POST' | 'PUT' | 'DELETE'; path: string; key?: string; body?: unknown }
): Promise<CallResult<T>> {
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (c.key) headers.authorization = `Bearer ${c.key}`
  const timeout = $.clock.sleep(TIMEOUT_MS).then(() => {
    throw new Error('timeout')
  })
  try {
    const r = await Promise.race([
      $.http.fetch(`${server.replace(/\/+$/, '')}${c.path}`, {
        method: c.method,
        headers,
        body: c.body === undefined ? undefined : JSON.stringify(c.body)
      }),
      timeout
    ])
    let data: any = null
    try {
      data = r.text ? JSON.parse(r.text) : null
    } catch {
      data = null
    }
    return r.ok ? { ok: true, data } : { ok: false, status: r.status, message: data?.error ?? `The team server answered ${r.status}` }
  } catch {
    return { ok: false, status: 0, message: "Can't reach the team server" }
  }
}

export function backoffMs(failures: number): number {
  return failures <= 0 ? 0 : Math.min(MAX_BACKOFF_MS, 1000 * 2 ** (failures - 1))
}

export function parseJoinCode(code: string): { teamId: string; secret: string } | null {
  const m = /^([a-z2-9]{10})\.([a-z2-9]{8})$/.exec(code.trim())
  return m ? { teamId: m[1]!, secret: m[2]! } : null
}
