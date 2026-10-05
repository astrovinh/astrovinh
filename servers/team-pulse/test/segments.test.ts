import { describe, expect, it } from 'vitest'
import { T0, api, newTeam } from './helpers'

const hb = (state: string) => ({
  session: 'sessA', project: 'mobile-app', branch: 'fix/restore', line: 'Fixing restore', state,
  fiveHour: 64, week: 41, startedAt: T0 - 3_600_000
})

async function run(steps: [number, string][]) {
  const { teamId, linh } = await newTeam()
  for (const [at, state] of steps) await api('PUT', `/teams/${teamId}/sessions/sessA`, { key: linh.key, body: hb(state), now: T0 + at })
  const snap = await api('GET', `/teams/${teamId}`, { key: linh.key, now: T0 + 1_000_000 })
  return snap.body.segments.map((s: any) => [s.start - T0, s.end - T0, s.state])
}

describe('segments carry the session state', () => {
  it('working then working extends one segment', async () => {
    expect(await run([[0, 'working'], [60_000, 'working']])).toEqual([[0, 60_000, 'working']])
  })

  it('working then idle within 150 s makes two contiguous segments', async () => {
    expect(await run([[0, 'working'], [60_000, 'working'], [120_000, 'idle']])).toEqual([[0, 60_000, 'working'], [60_000, 120_000, 'idle']])
  })

  it('idle then working likewise', async () => {
    expect(await run([[0, 'idle'], [60_000, 'idle'], [120_000, 'working']])).toEqual([[0, 60_000, 'idle'], [60_000, 120_000, 'working']])
  })

  it('a gap over 150 s starts a fresh segment in the new state', async () => {
    expect(await run([[0, 'working'], [60_000, 'working'], [300_000, 'idle']])).toEqual([[0, 60_000, 'working'], [300_000, 300_000, 'idle']])
  })

  it('a heartbeat that continues the idle segment extends it', async () => {
    expect(await run([[0, 'idle'], [100_000, 'idle'], [200_000, 'idle']])).toEqual([[0, 200_000, 'idle']])
  })

  it('an unknown state is stored as working', async () => {
    expect(await run([[0, 'bogus']])).toEqual([[0, 0, 'working']])
  })
})
