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

test('without a line, the branch stands in, or nothing', () => {
  expect(fallbackLine('fix/x')).toBe('fix/x')
  expect(fallbackLine('')).toBe('')
})

test('curly quotes are stripped too', () => {
  expect(cleanLine('\u201cFix purchase restore on iOS\u201d')).toBe('Fix purchase restore on iOS')
  expect(cleanLine('\u2018Tuning prompts\u2019')).toBe('Tuning prompts')
})

test('NONE means there was nothing to summarize, so no line', () => {
  expect(cleanLine('NONE')).toBe(null)
  expect(cleanLine('none.')).toBe(null)
  expect(cleanLine('"NONE"')).toBe(null)
  expect(cleanLine('Fixing purchase restore on iOS')).toBe('Fixing purchase restore on iOS')
  // A reply that starts with the word None is None, whatever follows; a longer word is not.
  expect(cleanLine('NONE - nothing to summarize')).toBe(null)
  expect(cleanLine('None (no work described)')).toBe(null)
  expect(cleanLine('None of the tests pass yet')).toBe(null)
  expect(cleanLine('Nonetheless fixing the build')).toBe('Nonetheless fixing the build')
  expect(cleanLine('Fixing the build, none left')).toBe('Fixing the build, none left')
})

test('the request lets the model say there is nothing to summarize', () => {
  expect(lineRequest('hi').system.includes('reply with exactly NONE')).toBe(true)
})

test('the system describes a person doing any kind of work and keeps NONE', () => {
  const system = lineRequest('Planning the next research study').system
  expect(system.includes('developer')).toBe(false)
  expect(system.includes('this person')).toBe(true)
  for (const kind of ['writing', 'design', 'research', 'planning', 'ops', 'code']) expect(system.includes(kind)).toBe(true)
  expect(system.includes('NONE')).toBe(true)
})
