# Team Pulse: design

Date: 2026-10-02 · Owner: Astro · Status: approved in conversation, awaiting spec review

## Goal

A side panel in Claude Code that shows which teammates are running sessions right now, what each session is working on, how much of their 5-hour and weekly limits they have used, and how active they have been over the last 12 hours. Glanceable, calm, spacious.

Success: Astro opens the panel with `/team` and, in under five seconds, can say who is working, on what, and who is close to a limit.

## Decisions already made

| Topic | Decision |
|---|---|
| Data source | A share mod each teammate opts into. Org analytics was rejected: daily totals only, no live sessions, no "working on". |
| Packaging | One mod, `team-pulse`, installed by everyone: it shares the owner's sessions and shows the panel. Separate from `usage-bars`. |
| Direction | A + C: roster rows with 5h and week bars plus a thin activity strip. Mockup: https://claude.ai/artifact/33ATGLHc7rSLQrC1MnPfhz |
| Opening | `/team` toggles the panel. A keyboard shortcut (ctrl+x t) only if the mod API allows a mod to own one (verify first). The session header icons belong to the app and cannot be extended by a mod. |
| Hosting | Murror's Cloudflare account, free plan. |
| Rates | Heartbeat every 60 s; panel refresh every 30 s while open; offline after 150 s without a heartbeat. About 43k requests a day for 5 people, under the 100k free limit. |

## Architecture

```
Teammate's Mac                    Team server                     Viewer's Mac
team-pulse mod  --heartbeat 60s-> Cloudflare Worker  <--read 30s-- team-pulse mod
 reads own session                + Durable Object per team        /team panel
 writes AI line                   latest heartbeat per session     roster + 12h strip
 shares limits                    session segments, 7 days
```

### Units

| Unit | Job | Depends on |
|---|---|---|
| `mod/hooks/share.ts` | Builds the heartbeat from session facts. Pure. | nothing |
| `mod/hooks/status.ts` | Classifies live, idle, offline from timestamps. Pure. | nothing |
| `mod/hooks/strip.ts` | Turns session segments into the 12-hour strip and hours worked. Pure. | nothing |
| `mod/hooks/panel.tsx` | Draws the panel from a team snapshot. | the three above |
| `mod/hooks/client.ts` | Talks to the server: create, join, leave, heartbeat, read. Retries with backoff. | `$.http.fetch` |
| `mod/hooks/register.tsx` | Wires events: session start, measure, prompt submit, `/team` command, timers. | all of the above |
| `server/src/index.ts` | Worker routes, auth, size caps, rate limits. | Durable Object |
| `server/src/team.ts` | Durable Object: members, sessions, segments, retention. SQLite storage. | nothing |

## What a heartbeat carries

Exactly these fields, nothing else:

| Field | Example | Limit |
|---|---|---|
| `session` | random id made on the teammate's Mac, not the Claude session id | 32 chars |
| `project` | folder name of the session's working directory | 64 chars |
| `branch` | current git branch, or empty | 96 chars |
| `line` | "Fixing purchase restore on iOS" | 120 chars |
| `state` | `working` or `idle` | enum |
| `fiveHour` | 64 | 0 to 100, or null |
| `week` | 41 | 0 to 100, or null |
| `startedAt` | epoch ms | number |

Never sent: prompts, model replies, code, file paths beyond the folder name, cost, tokens. A unit test asserts the heartbeat object has exactly these keys.

## The "working on" line

- Written on the teammate's Mac with `$.model.complete` on a small model, from the latest prompt only, at most once every 10 minutes and only after a new prompt.
- Prompt text never leaves the Mac except to that model call, which goes through the teammate's own Claude login.
- `/team say "..."` sets the line by hand and stops AI lines until `/team say` with no text.
- `/team pause` stops all sharing for this Mac; `/team resume` starts it again. While paused, the teammate shows as offline.
- The teammate sees the exact shared line in a small "Sharing: ... · /team pause" note. Where it draws (its own band row, or composed with `usage-bars` above the prompt) is settled in the first build step.
- If the model call fails, the last line stays; with no line yet, the project and branch stand in.

## Status rules

- **Live:** a heartbeat in the last 150 s and a turn in the last 10 min.
- **Idle:** a heartbeat in the last 150 s, no turn for 10 min or more. Shows "idle 12m".
- **Offline:** no heartbeat for 150 s or more. Shows "seen 3h ago".
- A person's status is their most active session's status.

## Server

- Routes: `POST /teams` (create), `POST /teams/:id/join`, `POST /teams/:id/leave`, `PUT /teams/:id/sessions/:session` (heartbeat), `GET /teams/:id` (snapshot), `DELETE /teams/:id/members/:member` (admin), `POST /teams/:id/code` (admin rotates join code).
- Auth: every call carries `Authorization: Bearer <key>`. Create returns an admin key and a join code. Join returns a member key. The server stores only SHA-256 hashes of keys.
- A member can write only their own sessions. Reads are members only.
- Size caps per field as above; request bodies over 2 KB are rejected.
- Rate limits: 2 heartbeats a minute per session, 10 reads a minute per key (so the panel opening in three sessions never trips it).
- Retention: latest heartbeat per session; session segments (start, end) for 7 days; older rows deleted on each write. `leave` and admin removal delete that member's rows at once.
- Segments: a heartbeat extends the open segment when it arrives within 150 s of the last one; otherwise it starts a new segment.

## Panel

- Header: "Team · 3 live · 5". Close mark at the right.
- Order: live (most sessions first, then most recent turn), idle, offline (most recently seen first). The viewer appears as "(you)".
- Row: initial with status dot; name; right side "3 sessions · +2", "idle 12m" or "seen 3h ago"; the line on one line, cut with an ellipsis; "project · branch · 1h 14m"; 5h bar and percent; Week bar and percent; 12-hour strip and hours worked.
- Click a row to unfold its other sessions; click again to fold.
- Bars and the strip draw as small SVG images on the desktop; names and lines are app text. The terminal draws the same layout in characters.
- Strip: the last 12 hours ending now, the same for every time zone; the running piece is brighter; hours worked is the sum of segments inside the window.
- Colors: green, amber from 60%, red from 85%, matching `usage-bars`.
- Not joined: "Create a team with /team create <name>, or join one with /team join <code> <name>."
- Server unreachable: "Can't reach the team server · last update 3 min ago", keeping the last snapshot.

## Commands

`/team` (toggle panel), `/team create <name>`, `/team join <code> <name>`, `/team leave`, `/team pause`, `/team resume`, `/team say "<text>"`, `/team code` (admin: rotate), `/team remove <name>` (admin).

## Errors

- Sharing never blocks a session: every network call has a 5 s timeout, failures back off (1, 2, 4 ... up to 5 minutes) and retry quietly.
- A rejected key (removed from the team) stops sharing and the panel says "You were removed from the team. Join again with /team join <code> <name>."
- Unknown or malformed snapshot fields are skipped, never drawn raw.

## Testing

Mod (`claude plugin test`):
- heartbeat has exactly the allowed keys, and caps every field;
- status at the boundaries: 149 s live, 151 s offline; 9 min 59 s working, 10 min idle;
- strip across midnight, across time zones (+7 and -7), a segment starting before the window, an open segment;
- ordering of live, idle, offline; "(you)" placement;
- escaping of names and lines; AI line cap and fallback to project and branch;
- each key guard is broken on purpose once to confirm a named test fails.

Server (vitest with the Workers pool):
- an outsider gets 401; a member cannot write another member's session; a wrong join code fails;
- 8-day-old segments are gone after a write; leave and remove delete rows;
- size caps and rate limits;
- segment extension at 149 s and a new segment at 151 s.

End to end:
- two sessions on Astro's Mac joined as two members, against `wrangler dev`, then against the deployed Worker;
- first real check: one teammate on their own Mac.

Not verifiable alone: behaviour on teammates' Macs and accounts until that first trial.

## Open items to settle in the first build step

Settled by the spike on 2026-10-02 (probe run headless with `claude -p`, Claude Code 2.1.287):

- Shortcut: not possible in this build (no keybinding API for mods). `/team` only.
- Fetch: `$.http.fetch` to `http://127.0.0.1:8799/ping` returned status 200, ok true, body "pong", with no permission prompt or error. Caveat: this was a headless run against a local address, so a prompt for a remote host in an interactive session is not ruled out. If the first real `/team` call shows one, add to the README in Task 12: "the first `/team` asks you to allow the team server once".
- Command name: `teamTaken` is false, so `/team` stays. No rename to `/pulse` needed.
- Sharing note: shown as a toast when the shared line changes plus `$.ui.status`, so it never competes with usage-bars above the prompt.

## Out of scope

Cost sharing, org analytics trends, history beyond 7 days, notifications, a web dashboard.
