import { test, expect } from 'claude-code/testing'
import { parseBattery, parseCpu, parseDisk, parseMemory, ring, ringColor } from './system'

// Output captured from a real Mac on 2026-10-02.
const DF_DATA = `Filesystem     1024-blocks      Used Available Capacity iused      ifree %iused  Mounted on
/dev/disk3s5   971350180 720950104 218346940    77% 9512347 2183469400    0%   /System/Volumes/Data`
const PMSET = `Now drawing from 'AC Power'
 -InternalBattery-0 (id=39256163)\t100%; charged; 0:00 remaining present: true`

test('cpu is the summed process share divided by the cores', () => {
  expect(parseCpu('12.0\n 8.5\n0.0\n\n', 10)).toBe(2.05)
  expect(parseCpu('900\n', 4)).toBe(100)
  expect(parseCpu('5\n', 0)).toBe(null)
})

test('memory used is what memory_pressure does not report free', () => {
  expect(parseMemory('The system has 34359738368\n...\nSystem-wide memory free percentage: 68%')).toBe(32)
  expect(parseMemory('no reading')).toBe(null)
})

test('disk reads the Data volume: used over used plus available', () => {
  const d = parseDisk(DF_DATA)!
  expect(Math.round(d.percent)).toBe(77)
  expect(Math.round(d.freeGb)).toBe(224)
  expect(parseDisk('Filesystem 1024-blocks Used Available')).toBe(null)
})

test('battery reads percent and state, and is null without a battery', () => {
  expect(parseBattery(PMSET)).toEqual({ percent: 100, state: 'charged' })
  expect(parseBattery(" -InternalBattery-0 (id=1)\t12%; discharging; 0:40 remaining present: true")).toEqual({ percent: 12, state: 'discharging' })
  expect(parseBattery("Now drawing from 'AC Power'\n")).toBe(null)
})

test('a low battery is red while a busy CPU is red', () => {
  expect(ringColor('battery', 10)).toBe('#f7768e')
  expect(ringColor('battery', 90)).toBe('#9ece6a')
  expect(ringColor('load', 90)).toBe('#f7768e')
  expect(ringColor('load', 10)).toBe('#9ece6a')
})

test('a ring fills its share of the circle, and an empty one draws only the track', () => {
  const half = ring(6, 7, 5, 50, '#9ece6a', '#333')
  expect(half.includes('stroke-dasharray="15.71 31.42"')).toBe(true)
  expect(ring(6, 7, 5, 0, '#9ece6a', '#333').split('<circle').length - 1).toBe(1)
})
