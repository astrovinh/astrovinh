// Every machine's load in one row: each machine posts a small card to a synced folder,
// and machines that post nothing (no session open, or not a Mac) are asked over ssh.

import { parseCpu, parseDisk, parseMemory } from './system'

export type Card = {
  name: string
  at: number
  cpu: number | null
  memory: number | null
  disk: { percent: number; freeGb: number } | null
}

/** Where this machine's own card goes, where to look for others, and who to ask over ssh. Kept per machine, outside git. */
export type MachinesConfig = {
  name: string
  /** Every machine expected in the row, in order; one that never reports shows as off. */
  order: string[]
  outbox?: string
  inbox?: string
  ssh: { name: string; host: string }[]
}

/** A card older than this draws as off: the sync and the ssh round both land well inside it. */
export const STALE_MS = 90_000
export const CARD_DIR = 'machine-load'

const clamp = (n: number) => Math.max(0, Math.min(100, n))

export function parseConfig(text: string | undefined): MachinesConfig | null {
  let raw: any
  try {
    raw = JSON.parse(text ?? '')
  } catch {
    return null
  }
  if (!raw || typeof raw.name !== 'string' || !raw.name) return null
  const str = (v: unknown) => (typeof v === 'string' && v ? v : undefined)
  const ssh = Array.isArray(raw.ssh) ? raw.ssh.filter((s: any) => s && str(s.name) && str(s.host)).map((s: any) => ({ name: s.name, host: s.host })) : []
  const order = Array.isArray(raw.order) ? raw.order.filter((n: unknown) => typeof n === 'string' && n) : []
  return { name: raw.name, order: order.includes(raw.name) ? order : [raw.name, ...order], outbox: str(raw.outbox), inbox: str(raw.inbox), ssh }
}

export function parseCard(text: string | undefined): Card | null {
  let c: any
  try {
    c = JSON.parse(text ?? '')
  } catch {
    return null
  }
  if (!c || typeof c.name !== 'string' || !Number.isFinite(c.at)) return null
  const pct = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? clamp(v) : null)
  const disk = c.disk && Number.isFinite(c.disk.percent) && Number.isFinite(c.disk.freeGb) ? { percent: clamp(c.disk.percent), freeGb: c.disk.freeGb } : null
  return { name: c.name, at: c.at, cpu: pct(c.cpu), memory: pct(c.memory), disk }
}

/** How busy a machine is right now: the higher of CPU and memory. Disk fills slowly and stays in the drawer. */
export function load(c: Card): number | null {
  const v = [c.cpu, c.memory].filter((n): n is number => n !== null)
  return v.length ? Math.max(...v) : null
}

export function isStale(c: Card | undefined, now: number): boolean {
  return !c || now - c.at > STALE_MS
}

/** One row per expected machine, this one first, then the order; a machine that reported but is not listed goes last. */
export function roster(cfg: MachinesConfig, cards: Card[]): { name: string; card?: Card }[] {
  const newest = new Map<string, Card>()
  for (const c of cards) if (!newest.has(c.name) || newest.get(c.name)!.at < c.at) newest.set(c.name, c)
  const names = [...cfg.order, ...[...newest.keys()].filter(n => !cfg.order.includes(n)).sort()]
  return names.map(name => ({ name, card: newest.get(name) }))
}

/** Asks for the same three readings on a Mac or on Linux, each section after a marker line. */
export const REMOTE = ['if [ "$(uname)" = Darwin ]; then', 'echo @cores; sysctl -n hw.ncpu; echo @ps; ps -A -o %cpu=; echo @pressure; memory_pressure -Q; echo @df; df -k /System/Volumes/Data;', 'else', 'echo @stat; head -1 /proc/stat; sleep 1; head -1 /proc/stat; echo @free; free -b; echo @df; df -kP /;', 'fi'].join(' ')

function sections(out: string): Record<string, string> {
  const s: Record<string, string> = {}
  let key = ''
  for (const line of out.split('\n')) {
    const m = /^@(\w+)$/.exec(line.trim())
    if (m) {
      key = m[1]!
      s[key] = ''
      continue
    }
    if (key) s[key] += `${line}\n`
  }
  return s
}

/** Two `/proc/stat` cpu lines a second apart: busy is the share of the time not spent idle or waiting. */
export function parseProcStat(text: string): number | null {
  const rows = text
    .trim()
    .split('\n')
    .filter(l => l.startsWith('cpu '))
    .map(l => l.trim().split(/\s+/).slice(1).map(Number))
  if (rows.length < 2) return null
  const [a, b] = [rows[0]!, rows[1]!]
  const total = (r: number[]) => r.reduce((x, y) => x + (Number.isFinite(y) ? y : 0), 0)
  const idle = (r: number[]) => (r[3] ?? 0) + (r[4] ?? 0)
  const dt = total(b) - total(a)
  return dt > 0 ? clamp(((dt - (idle(b) - idle(a))) / dt) * 100) : null
}

/** `free -b`: what is not available is in use. */
export function parseFree(text: string): number | null {
  const cols = (/^Mem:\s+(.*)$/m.exec(text)?.[1] ?? '').split(/\s+/).map(Number)
  const [total, , , , , available] = cols
  return total && Number.isFinite(available) ? clamp((1 - available! / total) * 100) : null
}

export function parseRemote(name: string, out: string, now: number): Card {
  const s = sections(out)
  const cpu = s.stat !== undefined ? parseProcStat(s.stat) : parseCpu(s.ps ?? '', Number((s.cores ?? '').trim()) || 0)
  const memory = s.free !== undefined ? parseFree(s.free) : parseMemory(s.pressure ?? '')
  return { name, at: now, cpu, memory, disk: parseDisk(s.df ?? '') }
}

type Run = (argv: string[], init?: { timeoutMs?: number }) => Promise<{ exitCode: number; stdout: string; stderr?: string }>
type Fs = { list: (path: string) => Promise<{ name: string; kind: string }[]>; read: (path: string) => Promise<string> }

/** One machine over ssh; null when it cannot be reached, so its ring shows off rather than a stale reading. `note` hears why, for the local log. */
export async function askOverSsh(run: Run, name: string, host: string, now: () => Promise<number>, note: (line: string) => void = () => {}): Promise<Card | null> {
  const r = await run(['ssh', '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=4', host, REMOTE], { timeoutMs: 10_000 }).catch((e: unknown) => {
    note(`${name}: ssh did not finish: ${e instanceof Error ? e.message : String(e)}`)
    return null
  })
  if (!r) return null
  if (r.exitCode !== 0) {
    note(`${name}: exit ${r.exitCode}: ${(r.stderr ?? '').trim().split('\n')[0]}`)
    return null
  }
  const card = parseRemote(name, r.stdout, await now())
  note(`${name}: ok cpu ${card.cpu === null ? '-' : Math.round(card.cpu)} memory ${card.memory === null ? '-' : Math.round(card.memory)} (${r.stdout.length} bytes)`)
  return card
}

/** Every card one level under the inbox, in `<folder>/machine-load/<name>.json`. */
export async function readCards(fs: Fs, inbox: string): Promise<Card[]> {
  const cards: Card[] = []
  for (const dir of await fs.list(inbox).catch(() => [])) {
    if (dir.kind !== 'dir') continue
    const at = `${inbox}/${dir.name}/${CARD_DIR}`
    for (const f of await fs.list(at).catch(() => [])) {
      if (f.kind !== 'file' || !f.name.endsWith('.json')) continue
      const c = parseCard(await fs.read(`${at}/${f.name}`).catch(() => undefined))
      if (c) cards.push(c)
    }
  }
  return cards
}
