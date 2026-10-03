const ALPHABET = 'abcdefghijkmnpqrstuvwxyz23456789'

export function randomId(n: number): string {
  const bytes = crypto.getRandomValues(new Uint8Array(n))
  return Array.from(bytes, b => ALPHABET[b % ALPHABET.length]).join('')
}

export function randomHex(bytes: number): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(bytes)), b => b.toString(16).padStart(2, '0')).join('')
}

export async function sha256(s: string): Promise<string> {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))
  return Array.from(new Uint8Array(d), b => b.toString(16).padStart(2, '0')).join('')
}

/** Compares without stopping at the first different character. */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

/** A trimmed string cut to `max`, or '' for anything that is not a string. */
export function text(v: unknown, max: number): string {
  return typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : ''
}

export type Res = { status: number; body: unknown }
export const ok = (body: unknown): Res => ({ status: 200, body })
export const fail = (status: number, error: string): Res => ({ status, body: { error } })
