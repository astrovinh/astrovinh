// Calls to the team server: JSON in and out, a 5 s timeout, never a thrown error.

import { MAX_BACKOFF_MS } from './config'

export type CallResult<T> = { ok: true; data: T } | { ok: false; status: number; message: string }

/** The URL and options for one call. The engine follows `$` only inside the file that spells it, so the fetch itself lives in register.tsx. */
export function requestOf(server: string, c: { method: 'GET' | 'POST' | 'PUT' | 'DELETE'; path: string; key?: string; body?: unknown }) {
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (c.key) headers.authorization = `Bearer ${c.key}`
  return {
    url: `${server.replace(/\/+$/, '')}${c.path}`,
    init: { method: c.method, headers, body: c.body === undefined ? undefined : JSON.stringify(c.body) }
  }
}

/** A fetch response as a CallResult. */
export function resultOf<T>(r: { ok: boolean; status: number; text?: string }): CallResult<T> {
  let data: any = null
  try {
    data = r.text ? JSON.parse(r.text) : null
  } catch {
    data = null
  }
  return r.ok ? { ok: true, data } : { ok: false, status: r.status, message: data?.error ?? `The team server answered ${r.status}` }
}

export const UNREACHABLE: CallResult<never> = { ok: false, status: 0, message: "Can't reach the team server" }

export function backoffMs(failures: number): number {
  return failures <= 0 ? 0 : Math.min(MAX_BACKOFF_MS, 1000 * 2 ** (failures - 1))
}

export function parseJoinCode(code: string): { teamId: string; secret: string } | null {
  const m = /^([a-z2-9]{10})\.([a-z2-9]{8})$/.exec(code.trim())
  return m ? { teamId: m[1]!, secret: m[2]! } : null
}
