import { test, expect } from 'claude-code/testing'
import { avatarSvg, speciesOf } from './avatar'

test('the same seed always gives the same picture', () => {
  expect(avatarSvg('member-abc', 30, 'live').source).toBe(avatarSvg('member-abc', 30, 'live').source)
  expect(avatarSvg('member-abc', 30, 'live').alt).toBe(avatarSvg('member-abc', 30, 'live').alt)
})

test('different seeds give different pictures', () => {
  expect(avatarSvg('member-abc', 30, 'live').source).not.toBe(avatarSvg('member-xyz', 30, 'live').source)
})

test('200 seeds cover at least 7 of the 9 species', () => {
  const kinds = new Set(Array.from({ length: 200 }, (_, i) => speciesOf(`member-${i}`)))
  expect(kinds.size).toBeGreaterThanOrEqual(7)
})

test('species match the approved mockup generator for known seeds', () => {
  expect(speciesOf('m1')).toBe('penguin')
  expect(speciesOf('member-abc')).toBe('dog')
  expect(speciesOf('AstroMac21')).toBe('fox')
  expect(speciesOf('zzz')).toBe('fox')
})

test('the alt text names the species and never a person', () => {
  expect(avatarSvg('member-abc', 30, 'live').alt).toBe('dog avatar')
  expect(avatarSvg('m1', 30, 'idle').alt).toBe('penguin avatar')
})

test('the status dot color follows the status', () => {
  expect(avatarSvg('m1', 30, 'live').source.includes('fill="#8CC9A1"')).toBe(true)
  expect(avatarSvg('m1', 30, 'idle').source.includes('fill="#D6BA7B"')).toBe(true)
  expect(avatarSvg('m1', 30, 'offline').source.includes('fill="#7B776C"')).toBe(true)
  expect(avatarSvg('m1', 30, 'live').source.includes('fill="#D6BA7B"')).toBe(false)
  expect(avatarSvg('m1', 30, 'offline').source.includes('fill="#8CC9A1"')).toBe(false)
})

test('the dot has a panel-colored ring and sits in the bottom-right corner', () => {
  const s = avatarSvg('m1', 30, 'live').source
  const circles = [...s.matchAll(/<circle cx="([\d.]+)" cy="([\d.]+)" r="([\d.]+)" fill="(#[0-9a-fA-F]{6})"/g)]
  expect(circles.length).toBe(2)
  const [ring, dot] = circles
  expect(ring![4]).toBe('#20201f')
  expect(Math.abs(Number(dot![3]) - 30 * 0.16) < 0.01).toBe(true)
  expect(Math.abs(Number(ring![3]) - (30 * 0.16 + 2)) < 0.01).toBe(true)
  expect(Number(dot![1])).toBeGreaterThan(15)
  expect(Number(dot![2])).toBeGreaterThan(15)
  expect(Number(ring![1]) + Number(ring![3])).toBeLessThanOrEqual(30)
})

test('rounded corners clip the background and sprite; only the sprite is crisp', () => {
  const s = avatarSvg('m1', 30, 'live').source
  expect(s.includes(`<rect width="30" height="30" rx="${(30 * 0.22).toFixed(2)}"/>`)).toBe(true)
  expect(s.includes('clip-path="url(#a)"')).toBe(true)
  expect(s.split('shape-rendering="crispEdges"').length - 1).toBe(1)
  // the crisp group closes before the dot circles
  expect(s.indexOf('</g>')).toBeLessThan(s.indexOf('<circle'))
  expect(s.indexOf('shape-rendering')).toBeLessThan(s.indexOf('</g>'))
})

test('the size sets the svg size and no number is NaN', () => {
  for (const size of [16, 30, 64]) {
    const s = avatarSvg('member-abc', size, 'idle').source
    expect(s.includes(`width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"`)).toBe(true)
    expect(s.includes('NaN')).toBe(false)
    expect(s.includes('undefined')).toBe(false)
  }
})

test('a non-ASCII or empty seed still draws', () => {
  for (const seed of ['', '\u0110\u1ee9c', '\u{1F634}']) {
    const a = avatarSvg(seed, 30, 'live')
    expect(a.source.includes('NaN')).toBe(false)
    expect(a.alt.endsWith(' avatar')).toBe(true)
  }
})
