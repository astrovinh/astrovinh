# Team Pulse Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Claude Code mod (`team-pulse`) that shares each teammate's live sessions to a small Cloudflare server and shows the whole team in a side panel opened with `/team`.

**Architecture:** Each person's mod sends a heartbeat every 60 s (project, branch, AI "working on" line, working or idle, 5-hour and weekly limit percent) to a Cloudflare Worker that keeps one SQLite-backed Durable Object per team. The same mod reads the team snapshot every 30 s while its panel is open and draws one row per person: status, line, two limit bars and a 12-hour activity strip. Pure logic (heartbeat, status, rows, strip, line, drawing) lives in small tested files; `register.tsx` only wires events.

**Tech Stack:** Claude Code function-hook mods (TypeScript/TSX, `claude plugin validate`, `claude plugin test` with `claude-code/testing`); Cloudflare Workers + Durable Objects (SQLite storage, RPC), wrangler 4, vitest with `@cloudflare/vitest-pool-workers`.

**Spec:** `docs/superpowers/specs/2026-10-02-team-pulse-design.md`

## Global Constraints

- Repo: `~/astrovinh`, branch `claude/usage-bars-mod`. Mod in `mods/team-pulse/`, server in `servers/team-pulse/`. Never touch `mods/usage-bars/`.
- Heartbeat fields are exactly: `session, project, branch, line, state, fiveHour, week, startedAt`. Never prompts, replies, code, file paths beyond the folder name, cost or tokens.
- Field caps: session 32, project 64, branch 96, line 120, member name 40, team name 60. Request bodies over 2048 bytes are rejected.
- Rates: heartbeat every 60 s; panel read every 30 s, only while the panel is open; offline after 150 s without a heartbeat; idle after 10 min without a turn; AI line at most every 10 min, only after a new prompt.
- Rate limits: 2 heartbeats a minute per session; 10 reads a minute per member key (raised from the spec's 6 so `/team` opening in three sessions never trips it; Task 7 updates the spec).
- Retention: 7 days. Activity strip window: the last 12 hours ending now.
- Colors: green `#9ece6a`, amber from 60% `#e0af68`, red from 85% `#f7768e` (same as usage-bars).
- `/team create <team> <your name>` (the spec's `/team create <name>` gains the creator's name, since the server needs both).
- Opening: `/team` only. Mods cannot register a global shortcut in this build (no keybinding API; a `Button` can only name an existing engine action). The session header icons belong to the app.
- Network calls from the mod: 5 s timeout, failures back off 1, 2, 4 ... seconds capped at 5 minutes, never block a session.
- Copy: no em dashes in user-facing text. English only.
- Commits: local only. No push, no deploy without Astro's explicit OK in chat. End commit messages with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Hosting: Murror's Cloudflare account, free plan. Astro logs in himself (`npx wrangler login`); never handle his credentials.

## Review Focus

1. **Two sessions running at once** for one person: hours worked must count the overlap once, not twice. Test: `strip` union (Task 4).
2. **A session id reused by another member:** must not overwrite someone else's session. Test: server 403 (Task 6).
3. **A "working on" line with markup or quotes** (`<b>`, `&`, `"`): drawn as text, never as markup. Test: `rowSvg` escaping (Task 9).
4. **The viewer's Mac clock is off by minutes:** status must use the server's `now` from the snapshot, or everyone looks offline. Test: `buildRows` uses `snapshot.now` (Task 3).
5. **Two people join with the same name:** the panel becomes ambiguous. Test: server rejects a duplicate name with 409 (Task 5).

---

## File Structure

```
mods/team-pulse/
  .claude-plugin/plugin.json     manifest, names the types contract
  hooks/hooks.json               { "modules": ["./register.tsx"] }
  tsconfig.json                  extends the engine-written tsconfig, like usage-bars
  types/index.d.ts               Heartbeat, Snapshot, Membership, PluginState contract
  hooks/config.ts                server URL and every timing constant
  hooks/share.ts (+ .test.ts)    session facts -> Heartbeat, caps
  hooks/rows.ts (+ .test.ts)     Snapshot -> sorted Row[] with status text
  hooks/strip.ts (+ .test.ts)    segments -> 12-hour pieces + hours worked (union)
  hooks/line.ts (+ .test.ts)     AI line request, cleanup, throttle, fallback
  hooks/client.ts (+ .test.ts)   fetch wrapper with timeout, backoff, join-code parsing
  hooks/draw.ts (+ .test.ts)     SVG for limit bars + strip, escaping
  hooks/panel.tsx                Row[] -> element tree (desktop and terminal)
  hooks/register.tsx             events, /team command, timers
servers/team-pulse/
  package.json, tsconfig.json, wrangler.jsonc, vitest.config.ts
  src/util.ts                    ids, keys, sha256, safeEqual, text caps
  src/team.ts                    Durable Object: members, sessions, segments, rate limits
  src/index.ts                   Worker routes, body cap, test clock
  test/helpers.ts, test/*.test.ts
  scripts/fake-teammate.sh       sends heartbeats as a second member (end-to-end)
```

---

### Task 1: Spike the two unknowns that change code

Answers: can a mod call our server with `$.http.fetch` without a per-host approval, and is the command name `team` free. Throwaway; nothing here ships.

**Files:**
- Create (scratch, not committed): `$SCRATCH/probe-net/.claude-plugin/plugin.json`, `$SCRATCH/probe-net/hooks/hooks.json`, `$SCRATCH/probe-net/hooks/register.ts`
- Modify: `docs/superpowers/specs/2026-10-02-team-pulse-design.md` (Open items section)

- [ ] **Step 1: Write the probe mod**

`$SCRATCH` is this session's scratchpad directory.

```json
{ "name": "probe-net", "version": "0.1.0", "description": "Checks fetch to a local server and the command list" }
```

```json
{ "modules": ["./register.ts"] }
```

```ts
import type { Register } from 'claude-code'

const OUT = `${'$SCRATCH'}/probe-net/out.json` // replace $SCRATCH with the absolute path when writing

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const result: Record<string, unknown> = {}
    try {
      const r = await $.http.fetch('http://127.0.0.1:8799/ping', { method: 'GET' })
      result.fetch = { status: r.status, ok: r.ok, text: r.text.slice(0, 40) }
    } catch (err) {
      result.fetch = { error: String(err) }
    }
    try {
      const cmds = await $.command.list()
      result.teamTaken = cmds.some((c: any) => c.name === 'team')
    } catch (err) {
      result.commands = { error: String(err) }
    }
    await $.fs.write(OUT, JSON.stringify(result, null, 2))
    return next(e)
  })
}
```

- [ ] **Step 2: Run it against a local server**

```bash
cd "$SCRATCH" && mkdir -p ping && echo pong > ping/ping && (python3 -m http.server 8799 --bind 127.0.0.1 --directory ping &) && sleep 1
claude -p "Reply with ok" --plugin-dir "$SCRATCH/probe-net" ; cat "$SCRATCH/probe-net/out.json"
pkill -f "http.server 8799"
```

Expected: `out.json` exists (session.start runs even if the headless login has expired; seen on 2026-10-02). Read `fetch` and `teamTaken`.

- [ ] **Step 3: Record the answers in the spec**

Replace the "Open items" list in the spec with the findings, one line each:
- Shortcut: not possible in this build (no keybinding API for mods). `/team` only.
- Fetch: `<status or error from out.json>`. If it errored with a permission message, add to the README in Task 12: "the first `/team` asks you to allow the team server once".
- Command name: if `teamTaken` is true, rename the command to `/pulse` in every later task (search and replace `'team'` command name and copy).
- Sharing note: shown as a toast when the shared line changes plus `$.ui.status`, so it never competes with usage-bars above the prompt.

- [ ] **Step 4: Commit the spec update**

```bash
cd ~/astrovinh && git add docs/superpowers/specs/2026-10-02-team-pulse-design.md
git commit -m "docs: team-pulse spike answers

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Mod scaffold, contract and heartbeat builder

**Files:**
- Create: `mods/team-pulse/.claude-plugin/plugin.json`, `mods/team-pulse/hooks/hooks.json`, `mods/team-pulse/tsconfig.json`, `mods/team-pulse/.gitignore`, `mods/team-pulse/types/index.d.ts`, `mods/team-pulse/hooks/config.ts`, `mods/team-pulse/hooks/share.ts`, `mods/team-pulse/hooks/register.tsx` (stub)
- Test: `mods/team-pulse/hooks/share.test.ts`

**Interfaces:**
- Produces: types `Heartbeat`, `Snapshot`, `SnapshotSession`, `SnapshotSegment`, `Membership`; `config.ts` constants; `cap(s, n)`, `basename(path)`, `buildHeartbeat(facts: SessionFacts): Heartbeat`, `LIMITS`.

- [ ] **Step 1: Write the scaffold files**

`mods/team-pulse/.claude-plugin/plugin.json`:
```json
{
  "name": "team-pulse",
  "version": "0.1.0",
  "description": "See which teammates are running Claude Code, what they are working on, and their limits, in a side panel opened with /team.",
  "types": "./types/index.d.ts"
}
```

`mods/team-pulse/hooks/hooks.json`:
```json
{ "modules": ["./register.tsx"] }
```

`mods/team-pulse/tsconfig.json`:
```json
{
  "extends": "./.claude-plugin/types/tsconfig.json"
}
```

`mods/team-pulse/.gitignore`:
```
.claude-plugin/types/
```

`mods/team-pulse/types/index.d.ts`:
```ts
export type Heartbeat = {
  session: string
  project: string
  branch: string
  line: string
  state: 'working' | 'idle'
  fiveHour: number | null
  week: number | null
  startedAt: number
}

export type SnapshotSession = {
  id: string
  member: string
  project: string
  branch: string
  line: string
  state: 'working' | 'idle'
  stateSince: number
  fiveHour: number | null
  week: number | null
  startedAt: number
  seenAt: number
}

export type SnapshotSegment = { session: string; member: string; start: number; end: number }

export type Snapshot = {
  team: string
  now: number
  you: string
  members: { id: string; name: string }[]
  sessions: SnapshotSession[]
  segments: SnapshotSegment[]
}

export type Membership = {
  server: string
  teamId: string
  team: string
  memberId: string
  key: string
  name: string
  isAdmin: boolean
  joinCode?: string
}

declare module 'claude-code' {
  interface PluginState {
    'team-pulse': {
      snapshot: Snapshot | null
      fetchedAt: number
      problem: string | null
      expanded: string[]
    }
  }
}
```

`mods/team-pulse/hooks/config.ts`:
```ts
// Where the team server lives and how often everything runs. Task 12 sets the deployed URL.
export const DEFAULT_SERVER = 'http://127.0.0.1:8787'

export const HEARTBEAT_MS = 60_000
export const READ_MS = 30_000
export const OFFLINE_AFTER_MS = 150_000
export const IDLE_AFTER_MS = 10 * 60_000
export const LINE_EVERY_MS = 10 * 60_000
export const WINDOW_MS = 12 * 3_600_000
export const TIMEOUT_MS = 5_000
export const MAX_BACKOFF_MS = 5 * 60_000
export const PANE = 'team'
export const COMMAND = 'team'
```

`mods/team-pulse/hooks/register.tsx` (stub so the mod validates; Task 11 replaces it):
```tsx
import type { Register } from 'claude-code'

export const register: Register = () => {}
```

- [ ] **Step 2: Write the failing test**

`mods/team-pulse/hooks/share.test.ts`:
```ts
import { test, expect } from 'claude-code/testing'
import { basename, buildHeartbeat, cap } from './share'

const facts = {
  session: 'abc123',
  cwd: '/Users/linh/code/mobile-app/',
  branch: 'fix/paywall-restore',
  line: 'Fixing purchase restore on iOS',
  lastTurnAt: 1_000_000,
  now: 1_000_000 + 60_000,
  fiveHour: 64,
  week: 41,
  startedAt: 900_000
}

test('a heartbeat carries exactly the allowed fields', () => {
  const keys = Object.keys(buildHeartbeat(facts)).sort()
  expect(keys).toEqual(['branch', 'fiveHour', 'line', 'project', 'session', 'startedAt', 'state', 'week'])
})

test('project is the folder name only, never the path', () => {
  expect(buildHeartbeat(facts).project).toBe('mobile-app')
  expect(basename('/a/b/c')).toBe('c')
  expect(basename('c')).toBe('c')
})

test('every text field is capped and whitespace is collapsed', () => {
  const hb = buildHeartbeat({ ...facts, line: 'x'.repeat(500), branch: 'b'.repeat(500), session: 's'.repeat(99) })
  expect(hb.line.length).toBe(120)
  expect(hb.line.endsWith('…')).toBe(true)
  expect(hb.branch.length).toBe(96)
  expect(hb.session.length).toBe(32)
  expect(cap('  a \n  b  ', 10)).toBe('a b')
})

test('working until 10 minutes after the last turn, idle from then', () => {
  expect(buildHeartbeat({ ...facts, now: facts.lastTurnAt + 599_999 }).state).toBe('working')
  expect(buildHeartbeat({ ...facts, now: facts.lastTurnAt + 600_000 }).state).toBe('idle')
})

test('limits outside 0 to 100 or missing become clamped or null', () => {
  expect(buildHeartbeat({ ...facts, fiveHour: 140 }).fiveHour).toBe(100)
  expect(buildHeartbeat({ ...facts, week: undefined }).week).toBe(null)
  expect(buildHeartbeat({ ...facts, week: Number.NaN }).week).toBe(null)
})
```

- [ ] **Step 3: Run it to verify it fails**

Run: `cd ~/astrovinh/mods/team-pulse && claude plugin test .`
Expected: FAIL, `share.test.ts` cannot load `./share`.

- [ ] **Step 4: Write the implementation**

`mods/team-pulse/hooks/share.ts`:
```ts
// Session facts in, the one object we share out. Nothing else leaves the Mac.

import type { Heartbeat } from '../types'
import { IDLE_AFTER_MS } from './config'

export const LIMITS = { session: 32, project: 64, branch: 96, line: 120 } as const

export type SessionFacts = {
  session: string
  cwd: string
  branch: string
  line: string
  lastTurnAt: number
  now: number
  fiveHour?: number | null
  week?: number | null
  startedAt: number
}

/** Collapses whitespace and cuts to `n` characters, ending with an ellipsis when cut. */
export function cap(s: string, n: number): string {
  const t = s.replace(/\s+/g, ' ').trim()
  return t.length <= n ? t : `${t.slice(0, n - 1)}…`
}

/** The last folder of a path: the project name, never the path itself. */
export function basename(path: string): string {
  const parts = path.replace(/\/+$/, '').split('/')
  return parts[parts.length - 1] || path
}

const percent = (n: number | null | undefined) => (typeof n === 'number' && Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : null)

export function buildHeartbeat(f: SessionFacts): Heartbeat {
  return {
    session: cap(f.session, LIMITS.session),
    project: cap(basename(f.cwd), LIMITS.project),
    branch: cap(f.branch, LIMITS.branch),
    line: cap(f.line, LIMITS.line),
    state: f.now - f.lastTurnAt < IDLE_AFTER_MS ? 'working' : 'idle',
    fiveHour: percent(f.fiveHour),
    week: percent(f.week),
    startedAt: f.startedAt
  }
}
```

- [ ] **Step 5: Run tests and validate**

Run: `claude plugin test . && claude plugin validate .`
Expected: 5 pass, 0 fail; `✔ Validation passed` (an author warning is fine).

- [ ] **Step 6: Mutate behaviour once**

Change `< IDLE_AFTER_MS` to `<= IDLE_AFTER_MS` in `share.ts`, run `claude plugin test .`, confirm "working until 10 minutes" fails, then restore and rerun to 5 pass.

- [ ] **Step 7: Commit**

```bash
cd ~/astrovinh && git add mods/team-pulse
git commit -m "team-pulse: scaffold, contract and heartbeat builder

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Status and rows

**Files:**
- Create: `mods/team-pulse/hooks/rows.ts`
- Test: `mods/team-pulse/hooks/rows.test.ts`

**Interfaces:**
- Consumes: `Snapshot`, `SnapshotSession` (Task 2), `OFFLINE_AFTER_MS` (config).
- Produces: `type Status = 'live' | 'idle' | 'offline'`; `sessionStatus(s, now): Status`; `ago(ms): string`; `duration(ms): string`; `type SessionView = { id: string; line: string; where: string }`; `type Row = { id: string; name: string; you: boolean; status: Status; statusText: string; main: SessionView | null; others: SessionView[]; fiveHour: number | null; week: number | null }`; `buildRows(snapshot: Snapshot, elapsedMs: number): Row[]`.

- [ ] **Step 1: Write the failing test**

`mods/team-pulse/hooks/rows.test.ts`:
```ts
import { test, expect } from 'claude-code/testing'
import { ago, buildRows, duration, sessionStatus } from './rows'
import type { Snapshot, SnapshotSession } from '../types'

const NOW = 1_800_000_000_000
const s = (o: Partial<SnapshotSession>): SnapshotSession => ({
  id: 's1', member: 'm1', project: 'mobile-app', branch: 'main', line: 'Fixing restore', state: 'working',
  stateSince: NOW - 60_000, fiveHour: 10, week: 20, startedAt: NOW - 3_600_000, seenAt: NOW - 30_000, ...o
})
const snap = (sessions: SnapshotSession[], members = [{ id: 'm1', name: 'Linh' }]): Snapshot => ({
  team: 'Murror', now: NOW, you: 'm1', members, sessions, segments: []
})

test('offline from 150 s without a heartbeat, live before', () => {
  expect(sessionStatus(s({ seenAt: NOW - 149_000 }), NOW)).toBe('live')
  expect(sessionStatus(s({ seenAt: NOW - 151_000 }), NOW)).toBe('offline')
  expect(sessionStatus(s({ state: 'idle' }), NOW)).toBe('idle')
})

test('rows use the server clock, not the viewer clock', () => {
  // The viewer fetched 20 s ago; a session seen 120 s before the server's now is 140 s old: still live.
  const rows = buildRows(snap([s({ seenAt: NOW - 120_000 })]), 20_000)
  expect(rows[0].status).toBe('live')
  // 40 s later it is 160 s old: offline.
  expect(buildRows(snap([s({ seenAt: NOW - 120_000 })]), 40_000)[0].status).toBe('offline')
})

test('live first by session count, then idle, then offline by last seen', () => {
  const members = [{ id: 'a', name: 'Ann' }, { id: 'b', name: 'Bo' }, { id: 'c', name: 'Cy' }, { id: 'd', name: 'Di' }]
  const rows = buildRows(snap([
    s({ id: '1', member: 'a', seenAt: NOW - 200_000 }),
    s({ id: '2', member: 'b', state: 'idle' }),
    s({ id: '3', member: 'c' }), s({ id: '4', member: 'c' }),
    s({ id: '5', member: 'd' })
  ], members), 0)
  expect(rows.map(r => r.name)).toEqual(['Cy', 'Di', 'Bo', 'Ann'])
})

test('status text says sessions, idle time, or last seen', () => {
  const members = [{ id: 'a', name: 'Ann' }, { id: 'b', name: 'Bo' }, { id: 'c', name: 'Cy' }, { id: 'e', name: 'Ed' }]
  const rows = buildRows(snap([
    s({ id: '1', member: 'a', seenAt: NOW - 3 * 3_600_000 }),
    s({ id: '2', member: 'b', state: 'idle', stateSince: NOW - 12 * 60_000 }),
    s({ id: '3', member: 'c' }), s({ id: '4', member: 'c' })
  ], members), 0)
  const text = Object.fromEntries(rows.map(r => [r.name, r.statusText]))
  expect(text).toEqual({ Cy: '2 sessions', Bo: 'idle 12m', Ann: 'seen 3h ago', Ed: 'not active yet' })
})

test('main session, others, where line and limits from the latest session', () => {
  const rows = buildRows(snap([
    s({ id: '1', line: 'Older work', seenAt: NOW - 50_000, fiveHour: 5 }),
    s({ id: '2', line: 'Newest work', seenAt: NOW - 10_000, fiveHour: 64, week: 41, startedAt: NOW - 74 * 60_000, branch: 'feat/x' })
  ]), 0)
  expect(rows[0].main).toEqual({ id: '2', line: 'Newest work', where: 'mobile-app · feat/x · 1h 14m' })
  expect(rows[0].others.map(o => o.id)).toEqual(['1'])
  expect([rows[0].fiveHour, rows[0].week]).toEqual([64, 41])
  expect(rows[0].you).toBe(true)
})

test('an offline person has no main session', () => {
  const rows = buildRows(snap([s({ seenAt: NOW - 3_600_000 })]), 0)
  expect(rows[0].main).toBe(null)
  expect(rows[0].others).toEqual([])
})

test('ago and duration read like the mockup', () => {
  expect(ago(30_000)).toBe('just now')
  expect(ago(12 * 60_000)).toBe('12m')
  expect(ago(3 * 3_600_000 + 5 * 60_000)).toBe('3h')
  expect(ago(2 * 86_400_000)).toBe('2d')
  expect(duration(42 * 60_000)).toBe('42m')
  expect(duration(74 * 60_000)).toBe('1h 14m')
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `claude plugin test .` Expected: FAIL, cannot load `./rows`.

- [ ] **Step 3: Write the implementation**

`mods/team-pulse/hooks/rows.ts`:
```ts
// A team snapshot becomes one row per person, sorted for a glance.

import type { Snapshot, SnapshotSession } from '../types'
import { OFFLINE_AFTER_MS } from './config'

export type Status = 'live' | 'idle' | 'offline'
export type SessionView = { id: string; line: string; where: string }
export type Row = {
  id: string
  name: string
  you: boolean
  status: Status
  statusText: string
  main: SessionView | null
  others: SessionView[]
  fiveHour: number | null
  week: number | null
}

export function sessionStatus(s: Pick<SnapshotSession, 'state' | 'seenAt'>, now: number): Status {
  if (now - s.seenAt >= OFFLINE_AFTER_MS) return 'offline'
  return s.state === 'working' ? 'live' : 'idle'
}

export function ago(ms: number): string {
  const m = Math.floor(ms / 60_000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  return h < 24 ? `${h}h` : `${Math.floor(h / 24)}d`
}

export function duration(ms: number): string {
  const m = Math.max(0, Math.floor(ms / 60_000))
  return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`
}

const RANK: Record<Status, number> = { live: 0, idle: 1, offline: 2 }

/** `elapsedMs` is how long ago the snapshot was fetched; status uses the server's clock plus that. */
export function buildRows(snap: Snapshot, elapsedMs: number): Row[] {
  const now = snap.now + elapsedMs
  const rows = snap.members.map(m => {
    const mine = snap.sessions.filter(s => s.member === m.id).sort((a, b) => b.seenAt - a.seenAt)
    const active = mine
      .filter(s => sessionStatus(s, now) !== 'offline')
      .sort((a, b) => RANK[sessionStatus(a, now)] - RANK[sessionStatus(b, now)] || b.seenAt - a.seenAt)
    const status: Status = active.length ? sessionStatus(active[0]!, now) : 'offline'
    const view = (s: SnapshotSession): SessionView => ({
      id: s.id,
      line: s.line,
      where: [s.project, s.branch, duration(now - s.startedAt)].filter(Boolean).join(' · ')
    })
    const latest = mine[0]
    const statusText =
      status === 'live'
        ? `${active.length} session${active.length === 1 ? '' : 's'}`
        : status === 'idle'
          ? `idle ${ago(now - active[0]!.stateSince)}`
          : latest
            ? `seen ${ago(now - latest.seenAt)} ago`
            : 'not active yet'
    return {
      row: {
        id: m.id,
        name: m.name,
        you: m.id === snap.you,
        status,
        statusText,
        main: active[0] ? view(active[0]) : null,
        others: active.slice(1).map(view),
        fiveHour: latest?.fiveHour ?? null,
        week: latest?.week ?? null
      },
      count: active.length,
      lastSeen: latest?.seenAt ?? 0
    }
  })
  rows.sort((a, b) => RANK[a.row.status] - RANK[b.row.status] || b.count - a.count || b.lastSeen - a.lastSeen)
  return rows.map(r => r.row)
}
```

- [ ] **Step 4: Run tests**

Run: `claude plugin test .` Expected: all pass (5 share + 7 rows).

- [ ] **Step 5: Mutate behaviour once**

In `buildRows`, change `const now = snap.now + elapsedMs` to `const now = Date.now()`. Run tests; "rows use the server clock" must fail. Restore; all pass.

- [ ] **Step 6: Commit**

```bash
git add mods/team-pulse/hooks/rows.ts mods/team-pulse/hooks/rows.test.ts
git commit -m "team-pulse: status and sorted rows from a snapshot

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Activity strip

**Files:**
- Create: `mods/team-pulse/hooks/strip.ts`
- Test: `mods/team-pulse/hooks/strip.test.ts`

**Interfaces:**
- Consumes: `SnapshotSegment` (Task 2), `WINDOW_MS`, `OFFLINE_AFTER_MS` (config).
- Produces: `type Piece = { from: number; to: number; running: boolean }` (fractions 0..1 of the window); `strip(segments: { start: number; end: number }[], now: number): { pieces: Piece[]; hours: number }`.

- [ ] **Step 1: Write the failing test**

`mods/team-pulse/hooks/strip.test.ts`:
```ts
import { test, expect } from 'claude-code/testing'
import { strip } from './strip'

const H = 3_600_000
const NOW = 1_800_000_000_000

test('a segment inside the window maps to fractions and hours', () => {
  const r = strip([{ start: NOW - 6 * H, end: NOW - 3 * H }], NOW)
  expect(r.pieces).toEqual([{ from: 0.5, to: 0.75, running: false }])
  expect(r.hours).toBe(3)
})

test('a segment that began before the window is clipped to its start', () => {
  const r = strip([{ start: NOW - 20 * H, end: NOW - 10 * H }], NOW)
  expect(r.pieces[0]!.from).toBe(0)
  expect(r.hours).toBe(2)
})

test('a segment ending within 150 s of now is running', () => {
  expect(strip([{ start: NOW - H, end: NOW - 100_000 }], NOW).pieces[0]!.running).toBe(true)
  expect(strip([{ start: NOW - H, end: NOW - 200_000 }], NOW).pieces[0]!.running).toBe(false)
})

test('two sessions at once count the overlap once', () => {
  const r = strip([{ start: NOW - 4 * H, end: NOW - 2 * H }, { start: NOW - 3 * H, end: NOW - H }], NOW)
  expect(r.hours).toBe(3)
  expect(r.pieces.length).toBe(1)
})

test('nothing in the window means no pieces and zero hours', () => {
  expect(strip([{ start: NOW - 30 * H, end: NOW - 13 * H }], NOW)).toEqual({ pieces: [], hours: 0 })
  expect(strip([], NOW)).toEqual({ pieces: [], hours: 0 })
})

test('hours round to one decimal', () => {
  expect(strip([{ start: NOW - 1.26 * H, end: NOW - 0.01 * H }], NOW).hours).toBe(1.3)
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `claude plugin test .` Expected: FAIL, cannot load `./strip`.

- [ ] **Step 3: Write the implementation**

`mods/team-pulse/hooks/strip.ts`:
```ts
// The last 12 hours, ending now: where a person had sessions running. Overlapping
// sessions merge first, so two at once count once.

import { OFFLINE_AFTER_MS, WINDOW_MS } from './config'

export type Piece = { from: number; to: number; running: boolean }

export function strip(segments: { start: number; end: number }[], now: number): { pieces: Piece[]; hours: number } {
  const from = now - WINDOW_MS
  const clipped = segments
    .map(s => ({ start: Math.max(s.start, from), end: Math.min(s.end, now) }))
    .filter(s => s.end > s.start)
    .sort((a, b) => a.start - b.start)

  const merged: { start: number; end: number }[] = []
  for (const s of clipped) {
    const last = merged[merged.length - 1]
    if (last && s.start <= last.end) last.end = Math.max(last.end, s.end)
    else merged.push({ ...s })
  }

  const pieces = merged.map(s => ({
    from: (s.start - from) / WINDOW_MS,
    to: (s.end - from) / WINDOW_MS,
    running: now - s.end < OFFLINE_AFTER_MS
  }))
  const ms = merged.reduce((sum, s) => sum + (s.end - s.start), 0)
  return { pieces, hours: Math.round((ms / 3_600_000) * 10) / 10 }
}
```

- [ ] **Step 4: Run tests**

Run: `claude plugin test .` Expected: all pass.

- [ ] **Step 5: Mutate behaviour once**

Replace the merge loop body with `merged.push({ ...s })` (no merging). "count the overlap once" must fail. Restore.

- [ ] **Step 6: Commit**

```bash
git add mods/team-pulse/hooks/strip.ts mods/team-pulse/hooks/strip.test.ts
git commit -m "team-pulse: 12-hour activity strip with overlap merged

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Server scaffold, create and join

**Files:**
- Create: `servers/team-pulse/package.json`, `tsconfig.json`, `wrangler.jsonc`, `vitest.config.ts`, `.gitignore`, `src/util.ts`, `src/team.ts`, `src/index.ts`, `test/helpers.ts`, `test/join.test.ts`

**Interfaces:**
- Produces (HTTP): `POST /teams {team, name}` -> `{teamId, team, joinCode, memberId, key, isAdmin: true}`; `POST /teams/:id/join {code, name}` -> `{teamId, team, memberId, key, isAdmin: false}`. Errors are `{error: string}` with 400, 403, 404, 409, 413.
- Produces (code): `Team` Durable Object with RPC methods returning `Res = { status: number; body: unknown }`; util `randomId`, `randomHex`, `sha256`, `safeEqual`, `text`.
- Test clock: when the binding `ALLOW_TEST_CLOCK` is `"1"`, the header `x-now` sets the time. It is set only in `vitest.config.ts`, never in `wrangler.jsonc`.

- [ ] **Step 1: Scaffold and install**

```bash
mkdir -p ~/astrovinh/servers/team-pulse/{src,test,scripts} && cd ~/astrovinh/servers/team-pulse
npm init -y >/dev/null
npm install -D wrangler@4 typescript @cloudflare/workers-types vitest @cloudflare/vitest-pool-workers
```

If npm reports a peer conflict between `vitest` and `@cloudflare/vitest-pool-workers`, install the vitest version the pool's `peerDependencies` names (`npm view @cloudflare/vitest-pool-workers peerDependencies`).

`servers/team-pulse/package.json` scripts (merge into the generated file):
```json
{
  "scripts": {
    "dev": "wrangler dev --port 8787",
    "test": "vitest run",
    "deploy": "wrangler deploy",
    "typecheck": "tsc --noEmit"
  }
}
```

`servers/team-pulse/.gitignore`:
```
node_modules/
.wrangler/
```

`servers/team-pulse/tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "es2022",
    "module": "es2022",
    "moduleResolution": "bundler",
    "strict": true,
    "noEmit": true,
    "types": ["@cloudflare/workers-types", "@cloudflare/vitest-pool-workers"]
  },
  "include": ["src", "test"]
}
```

`servers/team-pulse/wrangler.jsonc`:
```jsonc
{
  "name": "team-pulse",
  "main": "src/index.ts",
  "compatibility_date": "2026-09-01",
  "durable_objects": { "bindings": [{ "name": "TEAM", "class_name": "Team" }] },
  "migrations": [{ "tag": "v1", "new_sqlite_classes": ["Team"] }]
}
```

`servers/team-pulse/vitest.config.ts`:
```ts
import { defineWorkersConfig } from '@cloudflare/vitest-pool-workers/config'

export default defineWorkersConfig({
  test: {
    poolOptions: {
      workers: {
        wrangler: { configPath: './wrangler.jsonc' },
        miniflare: { bindings: { ALLOW_TEST_CLOCK: '1' } }
      }
    }
  }
})
```

If the installed pool version no longer exports `defineWorkersConfig`, follow that version's README for the equivalent config with the same two settings (wrangler config path, `ALLOW_TEST_CLOCK` binding).

- [ ] **Step 2: Write the failing test**

`servers/team-pulse/test/helpers.ts`:
```ts
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
```

`servers/team-pulse/test/join.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { api, newTeam } from './helpers'

describe('create and join', () => {
  it('creates a team and returns an admin key and a join code', async () => {
    const r = await api('POST', '/teams', { body: { team: 'Murror', name: 'Astro' } })
    expect(r.status).toBe(200)
    expect(r.body.isAdmin).toBe(true)
    expect(r.body.joinCode).toMatch(/^[a-z2-9]{10}\.[a-z2-9]{8}$/)
    expect(r.body.key).toMatch(/^[0-9a-f]{64}$/)
  })

  it('joins with the right code and gets a member key', async () => {
    const { linh } = await newTeam()
    expect(linh.isAdmin).toBe(false)
    expect(linh.key).toMatch(/^[0-9a-f]{64}$/)
  })

  it('refuses a wrong join code', async () => {
    const { teamId } = await newTeam()
    const r = await api('POST', `/teams/${teamId}/join`, { body: { code: 'wrongcod', name: 'Bao' } })
    expect(r.status).toBe(403)
  })

  it('refuses a second member with the same name', async () => {
    const { teamId, code } = await newTeam()
    const r = await api('POST', `/teams/${teamId}/join`, { body: { code, name: 'linh' } })
    expect(r.status).toBe(409)
  })

  it('refuses a team that does not exist', async () => {
    const r = await api('POST', '/teams/aaaaaaaaaa/join', { body: { code: 'x', name: 'Bao' } })
    expect(r.status).toBe(404)
  })

  it('refuses a body over 2 KB and a body that is not JSON', async () => {
    expect((await api('POST', '/teams', { raw: JSON.stringify({ team: 'x'.repeat(3000), name: 'A' }) })).status).toBe(413)
    expect((await api('POST', '/teams', { raw: '{nope' })).status).toBe(400)
  })
})
```

- [ ] **Step 3: Run it to verify it fails**

Run: `cd ~/astrovinh/servers/team-pulse && npx vitest run`
Expected: FAIL, `src/index.ts` missing.

- [ ] **Step 4: Write the implementation**

`servers/team-pulse/src/util.ts`:
```ts
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
```

`servers/team-pulse/src/team.ts`:
```ts
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
```

`servers/team-pulse/src/index.ts`:
```ts
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
      default:
        return json({ status: 404, body: { error: 'Not found' } })
    }
  }
}

function team(env: Env, teamId: string) {
  return env.TEAM.get(env.TEAM.idFromName(teamId))
}
```

- [ ] **Step 5: Run tests**

Run: `npx vitest run && npx tsc --noEmit`
Expected: 6 pass; tsc exit 0.

- [ ] **Step 6: Mutate behaviour once**

In `join`, delete the `nameTaken` line. "same name" must fail. Restore.

- [ ] **Step 7: Commit**

```bash
cd ~/astrovinh && git add servers/team-pulse
git commit -m "team-pulse server: create and join a team

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Server heartbeats, segments and snapshot

**Files:**
- Modify: `servers/team-pulse/src/team.ts` (add `me`, `heartbeat`, `snapshot`, `prune`), `servers/team-pulse/src/index.ts` (routes)
- Test: `servers/team-pulse/test/heartbeat.test.ts`

**Interfaces:**
- Consumes: Task 5 helpers and `Team`.
- Produces (HTTP): `PUT /teams/:id/sessions/:session` (member key, Heartbeat body) -> `{ok: true}`; `GET /teams/:id` -> `Snapshot` (same shape as `mods/team-pulse/types/index.d.ts`). 401 for a missing or unknown key; 403 for another member's session; 429 when over a rate limit.

- [ ] **Step 1: Write the failing test**

`servers/team-pulse/test/heartbeat.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { T0, api, newTeam } from './helpers'

const hb = (o: Record<string, unknown> = {}) => ({
  session: 'sessA', project: 'mobile-app', branch: 'fix/restore', line: 'Fixing restore', state: 'working',
  fiveHour: 64, week: 41, startedAt: T0 - 3_600_000, ...o
})

describe('heartbeats and the snapshot', () => {
  it('stores a heartbeat and returns it in the snapshot with the server clock', async () => {
    const { teamId, linh, admin } = await newTeam()
    expect((await api('PUT', `/teams/${teamId}/sessions/sessA`, { key: linh.key, body: hb() })).status).toBe(200)
    const snap = await api('GET', `/teams/${teamId}`, { key: admin.key, now: T0 + 5_000 })
    expect(snap.status).toBe(200)
    expect(snap.body.now).toBe(T0 + 5_000)
    expect(snap.body.you).toBe(admin.memberId)
    expect(snap.body.members.map((m: any) => m.name)).toEqual(['Astro', 'Linh'])
    expect(snap.body.sessions[0]).toMatchObject({ id: 'sessA', member: linh.memberId, line: 'Fixing restore', fiveHour: 64, seenAt: T0 })
  })

  it('turns away a missing or unknown key', async () => {
    const { teamId } = await newTeam()
    expect((await api('GET', `/teams/${teamId}`)).status).toBe(401)
    expect((await api('PUT', `/teams/${teamId}/sessions/s1`, { key: 'f'.repeat(64), body: hb() })).status).toBe(401)
  })

  it('refuses writing a session that belongs to someone else', async () => {
    const { teamId, linh, admin } = await newTeam()
    await api('PUT', `/teams/${teamId}/sessions/sessA`, { key: linh.key, body: hb() })
    const r = await api('PUT', `/teams/${teamId}/sessions/sessA`, { key: admin.key, body: hb({ line: 'hijack' }), now: T0 + 60_000 })
    expect(r.status).toBe(403)
    const snap = await api('GET', `/teams/${teamId}`, { key: admin.key, now: T0 + 60_000 })
    expect(snap.body.sessions[0].line).toBe('Fixing restore')
  })

  it('extends a segment within 150 s and starts a new one after', async () => {
    const { teamId, linh } = await newTeam()
    const put = (now: number) => api('PUT', `/teams/${teamId}/sessions/sessA`, { key: linh.key, body: hb(), now })
    await put(T0)
    await put(T0 + 149_000)
    await put(T0 + 149_000 + 151_000)
    const snap = await api('GET', `/teams/${teamId}`, { key: linh.key, now: T0 + 400_000 })
    expect(snap.body.segments.map((s: any) => [s.start - T0, s.end - T0])).toEqual([[0, 149_000], [300_000, 300_000]])
  })

  it('keeps state_since while the state holds and resets it on change', async () => {
    const { teamId, linh } = await newTeam()
    const put = (now: number, state: string) => api('PUT', `/teams/${teamId}/sessions/sessA`, { key: linh.key, body: hb({ state }), now })
    await put(T0, 'idle')
    await put(T0 + 60_000, 'idle')
    let snap = await api('GET', `/teams/${teamId}`, { key: linh.key, now: T0 + 61_000 })
    expect(snap.body.sessions[0].stateSince).toBe(T0)
    await put(T0 + 120_000, 'working')
    snap = await api('GET', `/teams/${teamId}`, { key: linh.key, now: T0 + 121_000 })
    expect(snap.body.sessions[0].stateSince).toBe(T0 + 120_000)
  })

  it('caps every field and rejects a bad session id', async () => {
    const { teamId, linh } = await newTeam()
    await api('PUT', `/teams/${teamId}/sessions/sessA`, { key: linh.key, body: hb({ line: 'x'.repeat(500), fiveHour: 400, week: 'lots' }) })
    const snap = await api('GET', `/teams/${teamId}`, { key: linh.key })
    expect(snap.body.sessions[0].line.length).toBe(120)
    expect(snap.body.sessions[0].fiveHour).toBe(null)
    expect(snap.body.sessions[0].week).toBe(null)
    expect((await api('PUT', `/teams/${teamId}/sessions/${encodeURIComponent('a b')}`, { key: linh.key, body: hb() })).status).toBe(400)
  })

  it('drops segments and sessions older than 7 days on the next write', async () => {
    const { teamId, linh } = await newTeam()
    await api('PUT', `/teams/${teamId}/sessions/old`, { key: linh.key, body: hb({ session: 'old' }), now: T0 })
    const later = T0 + 8 * 86_400_000
    await api('PUT', `/teams/${teamId}/sessions/new`, { key: linh.key, body: hb({ session: 'new' }), now: later })
    const snap = await api('GET', `/teams/${teamId}`, { key: linh.key, now: later })
    expect(snap.body.sessions.map((s: any) => s.id)).toEqual(['new'])
  })

  it('limits heartbeats to 2 a minute per session and reads to 10 a minute per key', async () => {
    const { teamId, linh } = await newTeam()
    const put = (now: number) => api('PUT', `/teams/${teamId}/sessions/sessA`, { key: linh.key, body: hb(), now })
    expect((await put(T0)).status).toBe(200)
    expect((await put(T0 + 1_000)).status).toBe(200)
    expect((await put(T0 + 2_000)).status).toBe(429)
    expect((await put(T0 + 61_000)).status).toBe(200)
    const reads = []
    for (let i = 0; i < 11; i++) reads.push((await api('GET', `/teams/${teamId}`, { key: linh.key, now: T0 + i })).status)
    expect(reads.slice(0, 10).every(s => s === 200)).toBe(true)
    expect(reads[10]).toBe(429)
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run test/heartbeat.test.ts` Expected: FAIL (404s from the router).

- [ ] **Step 3: Write the implementation**

Add to `servers/team-pulse/src/team.ts`, inside `class Team` after `join`:
```ts
  static readonly OFFLINE_AFTER_MS = 150_000
  static readonly KEEP_MS = 7 * 86_400_000
  static readonly WINDOW_MS = 12 * 3_600_000

  protected async me(key: string): Promise<{ id: string; name: string; isAdmin: boolean } | null> {
    if (!key) return null
    const r = this.sql.exec('SELECT id, name, is_admin FROM members WHERE key_hash = ?', await sha256(key)).toArray()[0]
    return r ? { id: String(r.id), name: String(r.name), isAdmin: Number(r.is_admin) === 1 } : null
  }

  protected prune(now: number) {
    this.sql.exec('DELETE FROM segments WHERE end_at < ?', now - Team.KEEP_MS)
    this.sql.exec('DELETE FROM sessions WHERE seen_at < ?', now - Team.KEEP_MS)
  }

  async heartbeat(key: string, sessionId: string, body: any, now: number): Promise<Res> {
    const me = await this.me(key)
    if (!me) return fail(401, 'Not a member of this team')
    const sid = text(sessionId, CAPS.session)
    if (!sid || !/^[A-Za-z0-9_-]+$/.test(sid)) return fail(400, 'Bad session id')
    if (this.limited(`hb:${sid}`, 2, now)) return fail(429, 'Too many heartbeats')
    const existing = this.sql.exec('SELECT member, state, state_since FROM sessions WHERE id = ?', sid).toArray()[0]
    if (existing && String(existing.member) !== me.id) return fail(403, 'That session belongs to someone else')

    const state = body?.state === 'idle' ? 'idle' : 'working'
    const since = existing && String(existing.state) === state ? Number(existing.state_since) : now
    const pct = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 100 ? v : null)
    const startedAt = typeof body?.startedAt === 'number' && Number.isFinite(body.startedAt) ? body.startedAt : now
    this.sql.exec(
      `INSERT INTO sessions (id, member, project, branch, line, state, state_since, five_hour, week, started_at, seen_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET project = excluded.project, branch = excluded.branch, line = excluded.line,
         state = excluded.state, state_since = excluded.state_since, five_hour = excluded.five_hour, week = excluded.week,
         started_at = excluded.started_at, seen_at = excluded.seen_at`,
      sid, me.id, text(body?.project, CAPS.project), text(body?.branch, CAPS.branch), text(body?.line, CAPS.line),
      state, since, pct(body?.fiveHour), pct(body?.week), startedAt, now
    )

    const last = this.sql.exec('SELECT rowid AS rid, end_at FROM segments WHERE session = ? ORDER BY end_at DESC LIMIT 1', sid).toArray()[0]
    if (last && now - Number(last.end_at) < Team.OFFLINE_AFTER_MS) this.sql.exec('UPDATE segments SET end_at = ? WHERE rowid = ?', now, last.rid)
    else this.sql.exec('INSERT INTO segments (session, member, start_at, end_at) VALUES (?, ?, ?, ?)', sid, me.id, now, now)

    this.prune(now)
    return ok({ ok: true })
  }

  async snapshot(key: string, now: number): Promise<Res> {
    const me = await this.me(key)
    if (!me) return fail(401, 'Not a member of this team')
    if (this.limited(`rd:${me.id}`, 10, now)) return fail(429, 'Too many reads')
    const members = this.sql.exec('SELECT id, name FROM members ORDER BY joined_at, rowid').toArray()
    const sessions = this.sql.exec('SELECT * FROM sessions ORDER BY seen_at DESC').toArray()
    const segments = this.sql.exec('SELECT session, member, start_at, end_at FROM segments WHERE end_at >= ? ORDER BY start_at', now - Team.WINDOW_MS).toArray()
    return ok({
      team: this.meta('team'),
      now,
      you: me.id,
      members: members.map(m => ({ id: String(m.id), name: String(m.name) })),
      sessions: sessions.map(s => ({
        id: String(s.id), member: String(s.member), project: String(s.project), branch: String(s.branch), line: String(s.line),
        state: String(s.state), stateSince: Number(s.state_since), fiveHour: s.five_hour === null ? null : Number(s.five_hour),
        week: s.week === null ? null : Number(s.week), startedAt: Number(s.started_at), seenAt: Number(s.seen_at)
      })),
      segments: segments.map(s => ({ session: String(s.session), member: String(s.member), start: Number(s.start_at), end: Number(s.end_at) }))
    })
  }
```

In `servers/team-pulse/src/index.ts`, replace the `switch` with:
```ts
    switch (route) {
      case 'POST join':
        return json(await t.join(body, now))
      case 'PUT sessions/:id':
        return json(await t.heartbeat(key, decodeURIComponent(parts[3] ?? ''), body, now))
      case 'GET ':
        return json(await t.snapshot(key, now))
      default:
        return json({ status: 404, body: { error: 'Not found' } })
    }
```

(`GET /teams/:id` has no parts after the id, so its route string is `'GET '`.)

- [ ] **Step 4: Run tests**

Run: `npx vitest run && npx tsc --noEmit` Expected: 14 pass; tsc exit 0.

- [ ] **Step 5: Mutate behaviour once each**

1. Remove the `existing.member !== me.id` check: "belongs to someone else" must fail. Restore.
2. Change `< Team.OFFLINE_AFTER_MS` to `<= 300_000` in the segment rule: "extends a segment within 150 s" must fail. Restore.

- [ ] **Step 6: Commit**

```bash
git add servers/team-pulse
git commit -m "team-pulse server: heartbeats, segments, snapshot, retention, rate limits

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Server leave, remove and code rotation

**Files:**
- Modify: `servers/team-pulse/src/team.ts`, `servers/team-pulse/src/index.ts`, `docs/superpowers/specs/2026-10-02-team-pulse-design.md` (read limit 10)
- Test: `servers/team-pulse/test/members.test.ts`

**Interfaces:**
- Produces (HTTP): `POST /teams/:id/leave` -> `{ok: true}`; `DELETE /teams/:id/members/:member` (admin) -> `{ok: true}`; `POST /teams/:id/code` (admin) -> `{joinCode}`. Non-admin gets 403.

- [ ] **Step 1: Write the failing test**

`servers/team-pulse/test/members.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { T0, api, newTeam } from './helpers'

const hb = { session: 's1', project: 'p', branch: 'b', line: 'l', state: 'working', fiveHour: 1, week: 2, startedAt: T0 }

describe('leaving, removing and rotating', () => {
  it('leave deletes the member, their sessions and their segments', async () => {
    const { teamId, linh, admin } = await newTeam()
    await api('PUT', `/teams/${teamId}/sessions/s1`, { key: linh.key, body: hb })
    expect((await api('POST', `/teams/${teamId}/leave`, { key: linh.key })).status).toBe(200)
    const snap = await api('GET', `/teams/${teamId}`, { key: admin.key })
    expect(snap.body.members.map((m: any) => m.name)).toEqual(['Astro'])
    expect(snap.body.sessions).toEqual([])
    expect(snap.body.segments).toEqual([])
    expect((await api('GET', `/teams/${teamId}`, { key: linh.key, now: T0 + 1 })).status).toBe(401)
  })

  it('the admin can remove a member; a member cannot', async () => {
    const { teamId, linh, admin } = await newTeam()
    expect((await api('DELETE', `/teams/${teamId}/members/${admin.memberId}`, { key: linh.key })).status).toBe(403)
    expect((await api('DELETE', `/teams/${teamId}/members/${linh.memberId}`, { key: admin.key })).status).toBe(200)
    expect((await api('GET', `/teams/${teamId}`, { key: linh.key, now: T0 + 1 })).status).toBe(401)
  })

  it('rotating the code makes the old one stop working', async () => {
    const { teamId, code, admin, linh } = await newTeam()
    expect((await api('POST', `/teams/${teamId}/code`, { key: linh.key })).status).toBe(403)
    const r = await api('POST', `/teams/${teamId}/code`, { key: admin.key })
    expect(r.status).toBe(200)
    const [, fresh] = r.body.joinCode.split('.')
    expect(fresh).not.toBe(code)
    expect((await api('POST', `/teams/${teamId}/join`, { body: { code, name: 'Bao' } })).status).toBe(403)
    expect((await api('POST', `/teams/${teamId}/join`, { body: { code: fresh, name: 'Bao' } })).status).toBe(200)
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run test/members.test.ts` Expected: FAIL (404s).

- [ ] **Step 3: Write the implementation**

Add to `class Team`:
```ts
  protected deleteMember(id: string) {
    this.sql.exec('DELETE FROM segments WHERE member = ?', id)
    this.sql.exec('DELETE FROM sessions WHERE member = ?', id)
    this.sql.exec('DELETE FROM members WHERE id = ?', id)
  }

  async leave(key: string): Promise<Res> {
    const me = await this.me(key)
    if (!me) return fail(401, 'Not a member of this team')
    this.deleteMember(me.id)
    return ok({ ok: true })
  }

  async remove(key: string, memberId: string): Promise<Res> {
    const me = await this.me(key)
    if (!me) return fail(401, 'Not a member of this team')
    if (!me.isAdmin) return fail(403, 'Only the team admin can remove someone')
    this.deleteMember(memberId)
    return ok({ ok: true })
  }

  async rotate(key: string): Promise<Res> {
    const me = await this.me(key)
    if (!me) return fail(401, 'Not a member of this team')
    if (!me.isAdmin) return fail(403, 'Only the team admin can change the join code')
    const code = randomId(8)
    this.setMeta('code', code)
    return ok({ joinCode: `${this.meta('id')}.${code}` })
  }
```

Add cases to the `switch` in `src/index.ts`:
```ts
      case 'POST leave':
        return json(await t.leave(key))
      case 'DELETE members/:id':
        return json(await t.remove(key, decodeURIComponent(parts[3] ?? '')))
      case 'POST code':
        return json(await t.rotate(key))
```

In the spec, change "6 reads a minute per key" to "10 reads a minute per key (so the panel opening in three sessions never trips it)".

- [ ] **Step 4: Run tests**

Run: `npx vitest run && npx tsc --noEmit` Expected: 17 pass; tsc exit 0.

- [ ] **Step 5: Mutate behaviour once**

Remove the `isAdmin` check in `remove`: "a member cannot" must fail. Restore.

- [ ] **Step 6: Commit**

```bash
git add servers/team-pulse docs/superpowers/specs/2026-10-02-team-pulse-design.md
git commit -m "team-pulse server: leave, admin remove, join code rotation

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Mod client and AI line

**Files:**
- Create: `mods/team-pulse/hooks/client.ts`, `mods/team-pulse/hooks/line.ts`
- Test: `mods/team-pulse/hooks/client.test.ts`, `mods/team-pulse/hooks/line.test.ts`

**Interfaces:**
- Consumes: config constants; `cap` from `share.ts`.
- Produces: `type CallResult<T> = { ok: true; data: T } | { ok: false; status: number; message: string }`; `call<T>($, server, { method, path, key?, body? }): Promise<CallResult<T>>`; `backoffMs(failures: number): number`; `parseJoinCode(code: string): { teamId: string; secret: string } | null`; `lineDue(lastAt: number | null, now: number): boolean`; `lineRequest(prompt: string): { model: string; system: string; prompt: string; maxTokens: number }`; `cleanLine(text: string): string | null`; `fallbackLine(project: string, branch: string): string`.

- [ ] **Step 1: Write the failing tests**

`mods/team-pulse/hooks/client.test.ts`:
```ts
import { test, expect } from 'claude-code/testing'
import { backoffMs, parseJoinCode } from './client'

test('backoff doubles from 1 s and stops at 5 minutes', () => {
  expect([0, 1, 2, 3, 4].map(backoffMs)).toEqual([0, 1000, 2000, 4000, 8000])
  expect(backoffMs(20)).toBe(300_000)
})

test('a join code splits into team and secret, and junk is refused', () => {
  expect(parseJoinCode('abcdefghij.k2m3n4p5')).toEqual({ teamId: 'abcdefghij', secret: 'k2m3n4p5' })
  expect(parseJoinCode(' abcdefghij.k2m3n4p5 ')).toEqual({ teamId: 'abcdefghij', secret: 'k2m3n4p5' })
  expect(parseJoinCode('nope')).toBe(null)
  expect(parseJoinCode('ABCDEFGHIJ.k2m3n4p5')).toBe(null)
})
```

`mods/team-pulse/hooks/line.test.ts`:
```ts
import { test, expect } from 'claude-code/testing'
import { cleanLine, fallbackLine, lineDue, lineRequest } from './line'

test('a new line is due at first and then every 10 minutes', () => {
  expect(lineDue(null, 0)).toBe(true)
  expect(lineDue(0, 599_999)).toBe(false)
  expect(lineDue(0, 600_000)).toBe(true)
})

test('the request asks a small model for a short line from a capped prompt', () => {
  const r = lineRequest('x'.repeat(5000))
  expect(r.model).toBe('haiku')
  expect(r.maxTokens).toBe(30)
  expect(r.prompt.length).toBe(2000)
  expect(r.system.includes('4 to 8')).toBe(true)
})

test('the reply is cleaned: first line, no quotes, no end punctuation, capped', () => {
  expect(cleanLine('"Fixing purchase restore on iOS."\nMore')).toBe('Fixing purchase restore on iOS')
  expect(cleanLine('   ')).toBe(null)
  expect(cleanLine('y'.repeat(300))!.length).toBe(120)
})

test('without a line, project and branch stand in', () => {
  expect(fallbackLine('mobile-app', 'fix/x')).toBe('mobile-app · fix/x')
  expect(fallbackLine('mobile-app', '')).toBe('mobile-app')
})
```

- [ ] **Step 2: Run to verify they fail**

Run: `cd ~/astrovinh/mods/team-pulse && claude plugin test .` Expected: FAIL, cannot load `./client` and `./line`.

- [ ] **Step 3: Write the implementations**

`mods/team-pulse/hooks/client.ts`:
```ts
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
```

`mods/team-pulse/hooks/line.ts`:
```ts
// The "working on" line: written on this Mac by a small model from the latest prompt.

import { LINE_EVERY_MS } from './config'
import { cap, LIMITS } from './share'

const SYSTEM =
  'Summarize what this developer is working on in 4 to 8 plain words, sentence case, no ending punctuation, no quotes. ' +
  'Never include names, secrets, file contents or code. Reply with the summary only.'

export function lineDue(lastAt: number | null, now: number): boolean {
  return lastAt === null || now - lastAt >= LINE_EVERY_MS
}

export function lineRequest(prompt: string) {
  return { model: 'haiku', system: SYSTEM, prompt: prompt.slice(0, 2000), maxTokens: 30 }
}

export function cleanLine(text: string): string | null {
  const first = (text.split('\n').find(l => l.trim()) ?? '').trim()
  const bare = first.replace(/^["'“”‘’`]+|["'“”‘’`]+$/g, '').replace(/[.!?;:,]+$/, '').trim()
  return bare ? cap(bare, LIMITS.line) : null
}

export function fallbackLine(project: string, branch: string): string {
  return branch ? `${project} · ${branch}` : project
}
```

- [ ] **Step 4: Run tests and validate**

Run: `claude plugin test . && claude plugin validate .` Expected: all pass; validation passes.

- [ ] **Step 5: Commit**

```bash
git add mods/team-pulse/hooks/client.ts mods/team-pulse/hooks/client.test.ts mods/team-pulse/hooks/line.ts mods/team-pulse/hooks/line.test.ts
git commit -m "team-pulse: server client with backoff, and the AI working-on line

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Drawing the bars and strip

**Files:**
- Create: `mods/team-pulse/hooks/draw.ts`
- Test: `mods/team-pulse/hooks/draw.test.ts`

**Interfaces:**
- Consumes: `Piece` (Task 4).
- Produces: `esc(s: string): string`; `severity(p: number): string`; `ROW_SVG_W = 300`; `ROW_SVG_H = 46`; `rowSvg(r: { fiveHour: number | null; week: number | null; pieces: Piece[]; hours: number; name: string }): { source: string; alt: string }`; `textBar(p: number | null, cells: number): string`.

- [ ] **Step 1: Write the failing test**

`mods/team-pulse/hooks/draw.test.ts`:
```ts
import { test, expect } from 'claude-code/testing'
import { esc, rowSvg, ROW_SVG_W, severity, textBar } from './draw'

test('severity matches usage-bars: green, amber from 60, red from 85', () => {
  expect([severity(10), severity(60), severity(85)]).toEqual(['#9ece6a', '#e0af68', '#f7768e'])
})

test('a row draws two bars and a strip at a fixed width', () => {
  const { source, alt } = rowSvg({ fiveHour: 64, week: 41, pieces: [{ from: 0.5, to: 0.75, running: true }], hours: 3, name: 'Linh' })
  expect(source.includes(`width="${ROW_SVG_W}"`)).toBe(true)
  expect(source.includes('>64%<') && source.includes('>41%<') && source.includes('>3.0h<')).toBe(true)
  expect(alt).toBe('Linh: 5-hour 64%, week 41%, 3.0 hours in the last 12 hours')
})

test('missing limits draw a dash, never a bar', () => {
  const { source } = rowSvg({ fiveHour: null, week: null, pieces: [], hours: 0, name: 'Hoa' })
  expect(source.split('>–<').length - 1).toBe(2)
})

test('names and lines are escaped', () => {
  expect(esc('<b>&"x"')).toBe('&lt;b&gt;&amp;&quot;x&quot;')
  const { source } = rowSvg({ fiveHour: 1, week: 1, pieces: [], hours: 0, name: '<script>' })
  expect(source.includes('<script>')).toBe(false)
})

test('terminal bars fill in proportion', () => {
  expect(textBar(50, 10)).toBe('━━━━━─────')
  expect(textBar(null, 4)).toBe('····')
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `claude plugin test .` Expected: FAIL, cannot load `./draw`.

- [ ] **Step 3: Write the implementation**

`mods/team-pulse/hooks/draw.ts`:
```ts
// Small SVG drawings for a panel row: the 5-hour bar, the week bar and the 12-hour strip.

import type { Piece } from './strip'

export const ROW_SVG_W = 300
export const ROW_SVG_H = 46
const LABEL_W = 40
const VALUE_W = 36
const BAR_W = ROW_SVG_W - LABEL_W - VALUE_W
const INK = '#8b8b8b'
const TRACK = 'rgba(139,139,139,0.22)'
const STRIP = 'rgba(122,162,247,0.55)'
const STRIP_NOW = '#7aa2f7'

export function esc(s: string): string {
  return s.replace(/[&<>"]/g, c => (c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : '&quot;'))
}

export function severity(p: number): string {
  return p >= 85 ? '#f7768e' : p >= 60 ? '#e0af68' : '#9ece6a'
}

function line(y: number, label: string, track: string, value: string): string {
  return (
    `<text x="0" y="${y + 4}" fill="${INK}">${label}</text>` +
    `<g transform="translate(${LABEL_W} ${y - 2})">${track}</g>` +
    `<text x="${ROW_SVG_W}" y="${y + 4}" fill="${INK}" text-anchor="end">${value}</text>`
  )
}

function bar(p: number | null): string {
  const base = `<rect width="${BAR_W - 8}" height="4" rx="2" fill="${TRACK}"/>`
  if (p === null) return base
  const w = Math.max(p > 0 ? 2 : 0, Math.round(((BAR_W - 8) * Math.min(100, p)) / 100))
  return base + `<rect width="${w}" height="4" rx="2" fill="${severity(p)}"/>`
}

function stripTrack(pieces: Piece[]): string {
  const w = BAR_W - 8
  return (
    `<rect y="-1" width="${w}" height="6" rx="3" fill="${TRACK}"/>` +
    pieces
      .map(pc => `<rect x="${(pc.from * w).toFixed(1)}" y="-1" width="${Math.max(1.5, (pc.to - pc.from) * w).toFixed(1)}" height="6" rx="3" fill="${pc.running ? STRIP_NOW : STRIP}"/>`)
      .join('')
  )
}

export function rowSvg(r: { fiveHour: number | null; week: number | null; pieces: Piece[]; hours: number; name: string }): { source: string; alt: string } {
  const pct = (p: number | null) => (p === null ? '–' : `${Math.round(p)}%`)
  const source =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${ROW_SVG_W}" height="${ROW_SVG_H}" viewBox="0 0 ${ROW_SVG_W} ${ROW_SVG_H}" ` +
    `font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif" font-size="10" style="font-variant-numeric:tabular-nums">` +
    line(7, '5h', bar(r.fiveHour), pct(r.fiveHour)) +
    line(22, 'Week', bar(r.week), pct(r.week)) +
    line(38, '12h', stripTrack(r.pieces), `${r.hours.toFixed(1)}h`) +
    `</svg>`
  const alt = `${esc(r.name)}: 5-hour ${pct(r.fiveHour)}, week ${pct(r.week)}, ${r.hours.toFixed(1)} hours in the last 12 hours`
  return { source, alt }
}

export function textBar(p: number | null, cells: number): string {
  if (p === null) return '·'.repeat(cells)
  const on = Math.round((cells * Math.max(0, Math.min(100, p))) / 100)
  return '━'.repeat(on) + '─'.repeat(cells - on)
}
```

Note: `rowSvg` never embeds `name` in `source`, only in `alt` (escaped), which is why the `<script>` test holds.

- [ ] **Step 4: Run tests**

Run: `claude plugin test .` Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add mods/team-pulse/hooks/draw.ts mods/team-pulse/hooks/draw.test.ts
git commit -m "team-pulse: SVG limit bars and activity strip for panel rows

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: The panel tree

**Files:**
- Create: `mods/team-pulse/hooks/panel.tsx`

**Interfaces:**
- Consumes: `Row` (Task 3), `strip` (Task 4), `rowSvg`, `textBar`, `ROW_SVG_W`, `ROW_SVG_H` (Task 9), `Snapshot`.
- Produces: `drawPanel(ui: any, surface: string, view: { rows: Row[]; snapshot: Snapshot | null; problem: string | null; expanded: string[]; fetchedAgoMs: number; joined: boolean }): unknown` (an element tree). Expand buttons use key `expand:<memberId>`.

- [ ] **Step 1: Write the implementation**

`mods/team-pulse/hooks/panel.tsx`:
```tsx
// The team panel: one row per person. Desktop draws bars and the strip as SVG; the terminal uses characters.

import type { Snapshot } from '../types'
import { ROW_SVG_H, ROW_SVG_W, rowSvg, textBar } from './draw'
import type { Row } from './rows'
import { ago } from './rows'
import { strip } from './strip'

const DOT = { live: '#4cc38a', idle: '#e0a84a', offline: '#5f5e58' } as const

export function drawPanel(
  ui: any,
  surface: string,
  v: { rows: Row[]; snapshot: Snapshot | null; problem: string | null; expanded: string[]; fetchedAgoMs: number; joined: boolean }
) {
  const { Box, Text, Svg, Button } = ui

  if (!v.joined) {
    return (
      <Box flexDirection="column" paddingX={2} paddingY={1}>
        <Text>Create a team with /team create &lt;team&gt; &lt;your name&gt;, or join one with /team join &lt;code&gt; &lt;your name&gt;.</Text>
      </Box>
    )
  }
  if (!v.snapshot) {
    return (
      <Box paddingX={2} paddingY={1}>
        <Text dimColor>{v.problem ?? 'Loading the team…'}</Text>
      </Box>
    )
  }

  const snap = v.snapshot
  const live = v.rows.filter(r => r.status === 'live').length
  const now = snap.now + v.fetchedAgoMs

  return (
    <Box flexDirection="column">
      <Box paddingX={2} paddingY={1} justifyContent="space-between">
        <Text bold>{snap.team}</Text>
        <Text dimColor>{`${live} live · ${v.rows.length}`}</Text>
      </Box>
      {v.problem ? (
        <Box paddingX={2}>
          <Text dimColor>{`${v.problem} · last update ${ago(v.fetchedAgoMs)} ago`}</Text>
        </Box>
      ) : null}
      {v.rows.map(r => {
        const st = strip(snap.segments.filter(s => s.member === r.id), now)
        const open = v.expanded.includes(r.id)
        return (
          <Box key={`row:${r.id}`} flexDirection="column" paddingX={2} paddingY={1}>
            <Box justifyContent="space-between">
              <Text>
                <Text color={DOT[r.status]}>● </Text>
                <Text bold>{r.name}</Text>
                {r.you ? <Text dimColor> (you)</Text> : null}
              </Text>
              <Text dimColor>{r.statusText}</Text>
            </Box>
            {r.main ? <Text wrap="truncate">{r.main.line}</Text> : <Text dimColor>Not running Claude Code</Text>}
            {r.main ? <Text dimColor wrap="truncate">{r.main.where}</Text> : null}
            {surface === 'desktop' && Svg ? (
              <Box marginTop={1}>
                <Svg {...rowSvg({ fiveHour: r.fiveHour, week: r.week, pieces: st.pieces, hours: st.hours, name: r.name })} width={ROW_SVG_W} height={ROW_SVG_H} />
              </Box>
            ) : (
              <Text dimColor>{`5h ${textBar(r.fiveHour, 8)} ${r.fiveHour ?? '–'}%  Week ${textBar(r.week, 8)} ${r.week ?? '–'}%  12h ${st.hours.toFixed(1)}h`}</Text>
            )}
            {r.others.length ? (
              <Button key={`expand:${r.id}`} plain label={open ? 'Hide other sessions' : `+${r.others.length} more session${r.others.length === 1 ? '' : 's'}`} />
            ) : null}
            {open ? r.others.map(o => <Text key={`s:${o.id}`} dimColor wrap="truncate">{`${o.line} · ${o.where}`}</Text>) : null}
          </Box>
        )
      })}
    </Box>
  )
}
```

- [ ] **Step 2: Validate**

Run: `claude plugin validate .` Expected: passes. (The tree itself is checked live in Task 11 Step 4; the engine reports a refused tree as a dim transcript line naming the reason.)

- [ ] **Step 3: Commit**

```bash
git add mods/team-pulse/hooks/panel.tsx
git commit -m "team-pulse: panel tree for desktop and terminal

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: Wiring: /team, heartbeats, reads, AI line

**Files:**
- Modify: `mods/team-pulse/hooks/register.tsx` (replace the stub)

**Interfaces:**
- Consumes: everything above.
- Produces: the `/team` command with subcommands `create <team> <your name>`, `join <code> <your name>`, `leave`, `pause`, `resume`, `say <text>` (empty clears), `code` (admin), `remove <name>` (admin), `server <url>`; the `team` pane.
- `$.store` keys: `membership` (Membership), `paused` (boolean), `said` (string | null). `$.state` keys as declared in Task 2.

- [ ] **Step 1: Write the wiring**

`mods/team-pulse/hooks/register.tsx`:
```tsx
import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { Membership, Snapshot } from '../types'
import { backoffMs, call, parseJoinCode } from './client'
import { COMMAND, DEFAULT_SERVER, HEARTBEAT_MS, PANE, READ_MS } from './config'
import { cleanLine, fallbackLine, lineDue, lineRequest } from './line'
import { drawPanel } from './panel'
import { buildRows } from './rows'
import { basename, buildHeartbeat } from './share'

const snapshot = atom({ plugin: 'team-pulse', key: 'snapshot' } as const, null as Snapshot | null)
const fetchedAt = atom({ plugin: 'team-pulse', key: 'fetchedAt' } as const, 0)
const problem = atom({ plugin: 'team-pulse', key: 'problem' } as const, null as string | null)
const expanded = atom({ plugin: 'team-pulse', key: 'expanded' } as const, [] as string[])

// This session's own facts; a reload starts them over, which only delays one heartbeat.
const sessionId = Array.from(crypto.getRandomValues(new Uint8Array(12)), b => b.toString(16).padStart(2, '0')).join('')
let cwd = ''
let lastTurnAt = 0
let lastPrompt = ''
let line: string | null = null
let lineAt: number | null = null
let beatFailures = 0
let nextBeatAt = 0
let panelOpen = false

const membership = async ($: any) => ((await $.store.get('membership')) as Membership | undefined) ?? null
const server = async ($: any) => ((await $.store.get('server')) as string | undefined) ?? DEFAULT_SERVER

async function branchOf($: any): Promise<string> {
  const r = await $.process.run(['git', '-C', cwd, 'rev-parse', '--abbrev-ref', 'HEAD'], { timeoutMs: 2000 }).catch(() => null)
  return r && r.exitCode === 0 ? r.stdout.trim() : ''
}

async function beat($: any) {
  const m = await membership($)
  if (!m || (await $.store.get('paused')) === true) return
  const now = await $.clock.now()
  if (now < nextBeatAt) return
  const u = await $.session.usage().catch(() => null)
  const branch = await branchOf($)
  const said = (await $.store.get('said')) as string | null | undefined
  const hb = buildHeartbeat({
    session: sessionId,
    cwd,
    branch,
    line: said || line || fallbackLine(basename(cwd), branch),
    lastTurnAt,
    now,
    fiveHour: u?.rateLimits?.find((l: any) => l.kind === 'five_hour')?.percentUsed ?? null,
    week: u?.rateLimits?.find((l: any) => l.kind === 'seven_day')?.percentUsed ?? null,
    startedAt: u?.startedAt ?? now
  })
  const r = await call($, m.server, { method: 'PUT', path: `/teams/${m.teamId}/sessions/${sessionId}`, key: m.key, body: hb })
  if (r.ok) {
    beatFailures = 0
    nextBeatAt = 0
    $.ui.status(`Sharing: ${hb.line}`)
  } else if (r.status === 401) {
    await $.store.delete('membership')
    $.ui.status(undefined)
    $.ui.toast('You were removed from the team. Join again with /team join <code> <your name>.')
  } else {
    beatFailures += 1
    nextBeatAt = now + backoffMs(beatFailures)
  }
}

async function refresh($: any) {
  const m = await membership($)
  if (!m) return
  const r = await call<Snapshot>($, m.server, { method: 'GET', path: `/teams/${m.teamId}`, key: m.key })
  if (r.ok && (!r.data || !Array.isArray(r.data.members) || !Array.isArray(r.data.sessions) || !Array.isArray(r.data.segments))) {
    await update($, problem, () => 'The team server sent something unexpected')
  } else if (r.ok) {
    await update($, snapshot, () => r.data)
    await update($, fetchedAt, () => Date.now())
    await update($, problem, () => null)
  } else if (r.status !== 429) {
    // A 429 keeps the last view quietly; anything else says why.
    await update($, problem, () => r.message)
  }
}

async function writeLine($: any) {
  if ((await $.store.get('said')) || (await $.store.get('paused')) === true || !lastPrompt) return
  const now = await $.clock.now()
  if (!lineDue(lineAt, now)) return
  lineAt = now
  const r = await $.model.complete(lineRequest(lastPrompt)).catch(() => null)
  const clean = r && r.isAnswered ? cleanLine(r.text) : null
  if (clean && clean !== line) {
    line = clean
    $.ui.toast(`Sharing with your team: "${clean}" · /team pause to stop`)
  }
}

async function openPanel($: any) {
  panelOpen = true
  await $.ui.open({ id: PANE, title: 'Team' })
  await refresh($)
}

async function runCommand($: any, args: string): Promise<string> {
  const [sub = '', ...rest] = args.trim().split(/\s+/)
  const m = await membership($)
  const srv = await server($)

  switch (sub) {
    case '':
      if (panelOpen) {
        panelOpen = false
        await $.ui.close({ id: PANE })
        return 'Team panel closed.'
      }
      await openPanel($)
      return 'Team panel opened.'
    case 'create': {
      const [team, ...name] = rest
      if (!team || !name.length) return 'Use /team create <team> <your name>, for example /team create Murror Astro.'
      const r = await call<any>($, srv, { method: 'POST', path: '/teams', body: { team, name: name.join(' ') } })
      if (!r.ok) return r.message
      await $.store.set('membership', { server: srv, teamId: r.data.teamId, team: r.data.team, memberId: r.data.memberId, key: r.data.key, name: name.join(' '), isAdmin: true, joinCode: r.data.joinCode })
      await openPanel($)
      return `Created ${r.data.team}. Teammates join with: /team join ${r.data.joinCode} <their name>`
    }
    case 'join': {
      const [code = '', ...name] = rest
      const parsed = parseJoinCode(code)
      if (!parsed || !name.length) return 'Use /team join <code> <your name>. Ask the team admin for the code.'
      const r = await call<any>($, srv, { method: 'POST', path: `/teams/${parsed.teamId}/join`, body: { code: parsed.secret, name: name.join(' ') } })
      if (!r.ok) return r.message
      await $.store.set('membership', { server: srv, teamId: r.data.teamId, team: r.data.team, memberId: r.data.memberId, key: r.data.key, name: name.join(' '), isAdmin: false })
      await openPanel($)
      return `Joined ${r.data.team}. Your sessions are shared from now on; /team pause stops it.`
    }
    case 'leave': {
      if (!m) return 'You are not in a team.'
      const r = await call($, m.server, { method: 'POST', path: `/teams/${m.teamId}/leave`, key: m.key })
      if (!r.ok) return r.message
      await $.store.delete('membership')
      $.ui.status(undefined)
      return `You left ${m.team}. Your shared data was deleted.`
    }
    case 'pause':
      await $.store.set('paused', true)
      $.ui.status(undefined)
      return 'Sharing paused on this Mac. Teammates will see you as offline. /team resume starts it again.'
    case 'resume':
      await $.store.set('paused', false)
      nextBeatAt = 0
      void beat($).catch(() => {})
      return 'Sharing resumed.'
    case 'say': {
      const text = rest.join(' ').replace(/^["']|["']$/g, '').trim()
      await $.store.set('said', text || null)
      nextBeatAt = 0
      void beat($).catch(() => {})
      return text ? `Your line is now "${text}". /team say with nothing after it goes back to automatic lines.` : 'Back to automatic lines.'
    }
    case 'code': {
      if (!m?.isAdmin) return 'Only the team admin can change the join code.'
      const r = await call<any>($, m.server, { method: 'POST', path: `/teams/${m.teamId}/code`, key: m.key })
      if (!r.ok) return r.message
      await $.store.set('membership', { ...m, joinCode: r.data.joinCode })
      return `New join code: ${r.data.joinCode}. The old one no longer works.`
    }
    case 'remove': {
      if (!m?.isAdmin) return 'Only the team admin can remove someone.'
      const snap = await read($, snapshot)
      const who = snap?.members.find(x => x.name.toLowerCase() === rest.join(' ').toLowerCase())
      if (!who) return 'No one on the team has that name. Open /team to see the names.'
      const r = await call($, m.server, { method: 'DELETE', path: `/teams/${m.teamId}/members/${who.id}`, key: m.key })
      if (!r.ok) return r.message
      await refresh($)
      return `Removed ${who.name}. Their shared data was deleted.`
    }
    case 'server':
      if (!rest[0]) return `Team server: ${srv}`
      await $.store.set('server', rest[0])
      return `Team server set to ${rest[0]} for new teams. Run /team join or /team create to use it.`
    default:
      return 'Commands: /team, create, join, leave, pause, resume, say, code, remove, server.'
  }
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    cwd = e.cwd
    await $.command.register({ name: COMMAND, description: "See your teammates' Claude Code sessions" })
    void beat($).catch(() => {})
    $.clock.every(HEARTBEAT_MS, () => void beat($).catch(() => {}))
    $.clock.every(READ_MS, () => {
      if (panelOpen) void refresh($).catch(() => {})
    })
    return next(e)
  })

  on('prompt.submit', async ($, e, next) => {
    lastTurnAt = await $.clock.now()
    if (!e.text.startsWith('/')) {
      lastPrompt = e.text
      void writeLine($).catch(() => {})
    }
    return next(e)
  })

  on('command.run', { command: 'team' }, async ($, e) => ({ text: await runCommand($, e.args) }))

  on('ui.close', async ($, e, next) => {
    if (e.id === PANE) panelOpen = false
    return next(e)
  })

  on('ui.press', async ($, e, next) => {
    if (e.plugin !== 'team-pulse' || !e.element.startsWith('expand:')) return next(e)
    const id = e.element.slice('expand:'.length)
    await update($, expanded, list => (list.includes(id) ? list.filter(x => x !== id) : [...list, id]))
    return next(e)
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const snap = await read($, snapshot)
    const at = await read($, fetchedAt)
    const agoMs = at ? Math.max(0, Date.now() - at) : 0
    return drawPanel($.ui.resolve(e), e.surface, {
      rows: snap ? buildRows(snap, agoMs) : [],
      snapshot: snap,
      problem: await read($, problem),
      expanded: await read($, expanded),
      fetchedAgoMs: agoMs,
      joined: (await membership($)) !== null
    })
  })
}
```

- [ ] **Step 2: Validate, test and type-check**

Run: `cd ~/astrovinh/mods/team-pulse && claude plugin validate . && claude plugin test .`
Expected: validation passes and lists `$.command.register`, `$.http.fetch (via call)`, `$.model.complete (via writeLine)`; all tests pass.

Then load the mod once in an interactive session so the engine writes `.claude-plugin/types/` (see Task 12 Step 1), and run: `npx -y -p typescript@5.6 tsc -p . --noEmit`. Fix every error in `mods/team-pulse/hooks/*` (event input field names are the engine's; if `e.id`, `e.element`, `e.plugin`, `e.cwd` or `e.args` differ, use the names tsc reports).

- [ ] **Step 3: Commit**

```bash
cd ~/astrovinh && git add mods/team-pulse
git commit -m "team-pulse: /team command, heartbeats, panel reads and AI line

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 12: End to end on this Mac, then deploy (deploy needs Astro's OK)

**Files:**
- Create: `servers/team-pulse/scripts/fake-teammate.sh`, `mods/team-pulse/README.md`
- Modify: `mods/team-pulse/hooks/config.ts` (deployed URL), `~/.claude/settings.json` (add the mod folder to `CLAUDE_CODE_PLUGIN_DIRS`, backup first)

- [ ] **Step 1: Run the server locally and load the mod**

```bash
cd ~/astrovinh/servers/team-pulse && npm run dev
```

(Run it in the background.) Add the mod to `CLAUDE_CODE_PLUGIN_DIRS` the same way `mods/usage-bars/install.sh` does: back up `~/.claude/settings.json` to `settings.json.before-team-pulse-<date>`, then append `~/astrovinh/mods/team-pulse` with `os.pathsep`. Ask Astro to quit and reopen the app (mods load only on launch in the desktop app; seen 2026-10-02).

- [ ] **Step 2: Write the fake teammate script**

`servers/team-pulse/scripts/fake-teammate.sh`:
```bash
#!/usr/bin/env bash
# Joins a team as a second member and sends a heartbeat every 60 s, so one Mac can see two people.
# Usage: fake-teammate.sh <server> <join code> <name>
set -euo pipefail
SERVER="$1"; CODE="$2"; NAME="$3"
TEAM="${CODE%%.*}"; SECRET="${CODE##*.}"
KEY=$(curl -fsS -X POST "$SERVER/teams/$TEAM/join" -H 'content-type: application/json' \
  -d "{\"code\":\"$SECRET\",\"name\":\"$NAME\"}" | python3 -c 'import json,sys; print(json.load(sys.stdin)["key"])')
SID="fake$(date +%s)"
echo "Joined as $NAME. Ctrl-C to stop."
while true; do
  NOW=$(python3 -c 'import time; print(int(time.time()*1000))')
  curl -fsS -X PUT "$SERVER/teams/$TEAM/sessions/$SID" -H "authorization: Bearer $KEY" -H 'content-type: application/json' \
    -d "{\"session\":\"$SID\",\"project\":\"mobile-app\",\"branch\":\"fix/paywall-restore\",\"line\":\"Fixing purchase restore on iOS\",\"state\":\"working\",\"fiveHour\":64,\"week\":41,\"startedAt\":$NOW}" >/dev/null
  sleep 60
done
```

`chmod +x servers/team-pulse/scripts/fake-teammate.sh`

- [ ] **Step 3: Run the end-to-end checks in the app**

In a session after the restart, record each result:
1. `/team create Murror Astro`: returns a join code; the panel opens showing "Astro (you)".
2. `servers/team-pulse/scripts/fake-teammate.sh http://127.0.0.1:8787 <code> Linh`: within 30 s Linh appears live with the line, both bars and a strip.
3. Send a normal prompt in the session: within a minute a toast shows your AI line; the panel shows it on your row. Note the model call's cost from `$.session.usage().cost` before and after (answers spec open item 4).
4. Stop the fake teammate: Linh turns offline within about 3 minutes ("seen just now ago" must not appear; expect "seen 2m ago" or similar).
5. `/team pause`: your row goes offline within 3 minutes; `/team resume` brings it back.
6. `/team` toggles the panel closed and open.
7. Stop `npm run dev`: the panel says "Can't reach the team server · last update Nm ago" and keeps the rows.

Fix anything that fails at its cause (root-cause skill), add a test that pins it, commit, and rerun the list.

- [ ] **Step 4: Ask Astro before deploying**

Stop and ask in chat: "Ready to deploy the team server to Murror's Cloudflare (free plan). You'll run `npx wrangler login` yourself. OK?" Wait for a clear yes.

- [ ] **Step 5: Deploy and point the mod at it**

```bash
cd ~/astrovinh/servers/team-pulse && npx wrangler deploy
```

Copy the printed `https://team-pulse.<account>.workers.dev` URL into `DEFAULT_SERVER` in `mods/team-pulse/hooks/config.ts`. Run `claude plugin test .` in the mod. Repeat Step 3 items 1 to 3 against the deployed URL (`/team server <url>` first if the old local membership is stored).

- [ ] **Step 6: Write the README for teammates**

`mods/team-pulse/README.md`:
```markdown
# team-pulse

A side panel showing which teammates are running Claude Code, what each session is working on, and their 5-hour and weekly limits. Open it with `/team`.

## What you share

Every 60 seconds while a session is open: the project folder name, the git branch, a one-line summary of what you are working on, whether you are working or idle, and your 5-hour and weekly limit percentages. Never your prompts, Claude's replies, code, file paths or cost. The summary is written on your Mac by a small Claude model from your latest prompt; you see each new line in a toast before teammates do.

## Install

Clone the repo, then add `mods/team-pulse` to Claude Code's plugin folders (the same way `mods/usage-bars/install.sh` does) and reopen the app.

## Commands

- `/team`: open or close the panel
- `/team join <code> <your name>`: join with the code your admin shares
- `/team pause` and `/team resume`: stop and restart sharing on this Mac
- `/team say <text>`: set your line yourself; `/team say` alone goes back to automatic lines
- `/team leave`: leave the team and delete your shared data
```

- [ ] **Step 7: Commit**

```bash
cd ~/astrovinh && git add mods/team-pulse servers/team-pulse/scripts
git commit -m "team-pulse: end-to-end checks, deployed server URL, teammate README

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 8: First teammate trial**

Astro shares the join code and README with one teammate. Not verifiable from this Mac; report it as the open item until that teammate's row shows live.
