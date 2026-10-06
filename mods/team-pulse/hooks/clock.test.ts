import { test, expect } from 'claude-code/testing'
import { clockLabel, placeOf } from './clock'

test('the mod runtime formats IANA zones at a fixed instant', () => {
  const instant = Date.UTC(2026, 9, 6, 15, 40)
  const time = (timeZone: string) => new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(instant)
  expect(time('Asia/Ho_Chi_Minh')).toBe('22:40')
  expect(time('America/Los_Angeles')).toBe('08:40')
})

test('places use the approved short labels', () => {
  const labels = [
    ['Asia/Ho_Chi_Minh', 'VN'], ['Asia/Saigon', 'VN'], ['America/Los_Angeles', 'Pacific'],
    ['America/Denver', 'Mountain'], ['America/Chicago', 'Central'], ['America/New_York', 'Eastern'],
    ['Europe/London', 'London'], ['Asia/Singapore', 'Singapore'], ['Asia/Tokyo', 'Tokyo'], ['Australia/Sydney', 'Sydney']
  ]
  for (const [tz, place] of labels) expect(placeOf(tz!)).toBe(place)
})

test('other places use the last path segment with spaces', () => {
  expect(placeOf('Asia/Kolkata')).toBe('Kolkata')
  expect(placeOf('America/Argentina/Buenos_Aires')).toBe('Buenos Aires')
  expect(placeOf('UTC')).toBe('UTC')
})

test('clock labels include the place and 12-hour time with AM or PM', () => {
  const instant = Date.UTC(2026, 9, 6, 15, 40)
  expect(clockLabel('Asia/Ho_Chi_Minh', instant)).toBe('VN 10:40 PM')
  expect(clockLabel('America/Los_Angeles', instant)).toBe('Pacific 8:40 AM')
  expect(clockLabel('UTC', Date.UTC(2026, 0, 1, 0, 5))).toBe('UTC 12:05 AM')
  expect(clockLabel('UTC', Date.UTC(2026, 0, 1, 12, 5))).toBe('UTC 12:05 PM')
  expect(clockLabel('UTC', Date.UTC(2026, 0, 1, 1, 5))).toBe('UTC 1:05 AM')
})

test('zone data accounts for daylight saving time', () => {
  expect(clockLabel('America/Los_Angeles', Date.UTC(2026, 0, 6, 15, 40))).toBe('Pacific 7:40 AM')
})

test('missing or invalid zones have no clock label', () => {
  for (const tz of ['', null, undefined, 'Not/A_Zone']) expect(clockLabel(tz, 0)).toBeNull()
})
