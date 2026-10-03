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
