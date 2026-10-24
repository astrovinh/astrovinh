import { test, expect } from 'claude-code/testing'
import { ANIMALS, SPECIES, animalSvg } from './animals'
import type { AgentState, AnimalKey } from '../types'

const states: AgentState[] = ['idle', 'running', 'waiting', 'pending', 'completed', 'failed', 'killed']
const normalize = (s: string) => s.replace(/a\d+_/g, 'id_')

test('the species retain every coat from the existing team avatar engine', () => {
  expect(Object.fromEntries(Object.entries(SPECIES).map(([kind, sp]) => [kind, sp.coats.length]))).toEqual({ cat: 4, dog: 4, fox: 2, bear: 3, panda: 1, rabbit: 3, owl: 2, frog: 2, penguin: 2 })
  expect(SPECIES.rabbit!.coats[1]).toEqual(['#9a8f86', '#e6ded6', '#4f4740'])
})

test('second lead coats draw distinct art and the second fox uses the existing grey coat', () => {
  expect(ANIMALS.ember2.kind).toBe('fox')
  expect(ANIMALS.ember2.coat).toBe(1)
  for (const [first, second] of [['ember', 'ember2'], ['mochi', 'mochi2'], ['biscuit', 'biscuit2'], ['waddle', 'waddle2']] as const) {
    const base = animalSvg(first, 'idle', 'think', 3, { still: true }).source
    const next = animalSvg(second, 'idle', 'think', 3, { still: true }).source
    expect(normalize(base) === normalize(next)).toBe(false)
  }
})

test('every approved species draws a bounded self-contained 36px SVG', () => {
  expect(Object.keys(SPECIES)).toHaveLength(9)
  expect(new Set(Object.values(ANIMALS).map(a => a.kind)).size).toBe(9)
  for (const key of Object.keys(ANIMALS) as AnimalKey[]) {
    for (const state of states) {
      const { source, alt } = animalSvg(key, state, 'edit')
      expect(source.startsWith('<svg ')).toBe(true)
      expect(source.endsWith('</svg>')).toBe(true)
      expect(source.includes('width="36" height="36"')).toBe(true)
      expect(source.includes('<rect')).toBe(true)
      expect(source.length < 131072).toBe(true)
      expect(/<script|(?:href|src)=|<!ENTITY|<foreignObject/i.test(source)).toBe(false)
      expect(alt).toContain(ANIMALS[key].name)
    }
  }
  expect(animalSvg('ember', 'running', 'edit').alt).toBe('Ember the fox, working')
  expect(animalSvg('ember', 'idle', 'think', 2).source).toContain('width="24" height="24"')
})

test('all seven states have different artwork even with unique ids removed', () => {
  const art = states.map(s => normalize(animalSvg('ember', s, 'read').source))
  expect(new Set(art).size).toBe(7)
})

test('still pictures omit every animation and the drifting Z and sparkle layers', () => {
  for (const state of states) {
    const still = animalSvg('ember', state, 'edit', 3, { still: true }).source
    expect(still.includes('<animate')).toBe(false)
    expect(still.includes('#9db4ff')).toBe(false)
    expect(still.includes('#ffe58a')).toBe(false)
  }
})

test('state artwork carries the approved motion, eyes and badges', () => {
  for (const state of ['running', 'waiting', 'completed', 'failed', 'killed'] as const) {
    expect(animalSvg('ember', state, 'read').source).toContain('fill="#f6f1e6"')
  }
  expect(animalSvg('ember', 'idle', 'think').source).toContain('dur="3.8s"')
  expect(animalSvg('ember', 'running', 'edit').source).toContain('dur="0.6s"')
  expect(animalSvg('ember', 'waiting', 'think').source).toContain('1;.35;1')
  expect(animalSvg('ember', 'pending', 'think').source).toContain('#9db4ff')
  expect(animalSvg('ember', 'completed', 'think').source).toContain('#ffe58a')
  expect(animalSvg('ember', 'failed', 'think').source).toContain('rotate(-9 6 10)')
  expect(animalSvg('ember', 'killed', 'think').source).toContain('opacity=".6"')
  const badges = ['read', 'edit', 'run', 'think'].map(t => normalize(animalSvg('ember', 'running', t as 'read').source))
  expect(new Set(badges).size).toBe(4)
})

test('each call has disjoint ids and its internal references resolve', () => {
  const a = animalSvg('ember', 'killed', 'think').source
  const b = animalSvg('ember', 'killed', 'think').source
  const ids = (s: string) => [...s.matchAll(/ id="([^"]+)"/g)].map(m => m[1]!)
  expect(ids(a).length > 0).toBe(true)
  expect(ids(a).some(id => ids(b).includes(id))).toBe(false)
  for (const s of [a, b]) for (const m of s.matchAll(/url\(#([^)]+)\)/g)) expect(ids(s).includes(m[1]!)).toBe(true)
})
