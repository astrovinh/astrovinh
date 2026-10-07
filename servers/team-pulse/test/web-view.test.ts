import { expect, it } from 'vitest'
import type { Snapshot } from '../../../mods/team-pulse/types'
import { renderWebView } from '../src/web-view'
import { T0 } from './helpers'

it('clocked working, idle and offline rows have visible status labels beside their clocks', () => {
  const snap: Snapshot = {
    team: 'Example', now: T0, you: 'working', signals: [], segments: [],
    members: ['working', 'idle', 'offline'].map(id => ({ id, name: id, tz: 'Asia/Ho_Chi_Minh' })),
    sessions: [
      { id: 'a', member: 'working', state: 'working' as const, seenAt: T0 },
      { id: 'b', member: 'idle', state: 'idle' as const, seenAt: T0 },
      { id: 'c', member: 'offline', state: 'working' as const, seenAt: T0 - 3_600_000 }
    ].map(s => ({ ...s, project: '', branch: '', line: '', stateSince: T0 - 120_000, fiveHour: null, week: null, startedAt: T0 - 3_600_000 }))
  }
  const html = renderWebView(snap)
  for (const label of ['working', 'idle 12m', 'seen 1h ago']) {
    expect(html.includes(`<span class="status-text">${label}</span>`), label).toBe(true)
  }
  expect(html.match(/class="clock">VN /g)).toHaveLength(3)
})
