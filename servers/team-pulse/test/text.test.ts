import { describe, expect, it } from 'vitest'
import { text } from '../src/util'

describe('text()', () => {
  it('removes control characters like ESC (U+001B)', () => {
    const escSeq = String.fromCharCode(27) + '[31m'
    expect(text('a' + escSeq + 'b', 100)).toBe('a [31mb')
  })

  it('removes NUL characters (U+0000)', () => {
    expect(text('a' + String.fromCharCode(0) + 'b', 100)).toBe('a b')
  })

  it('removes U+0085 characters', () => {
    expect(text('a' + String.fromCharCode(0x85) + 'b', 100)).toBe('a b')
  })

  it('removes other control characters in the ranges U+0000-U+001F and U+007F-U+009F', () => {
    // Test a few other control chars
    expect(text('a' + String.fromCharCode(1) + 'b', 100)).toBe('a b')
    expect(text('a' + String.fromCharCode(31) + 'b', 100)).toBe('a b')
    expect(text('a' + String.fromCharCode(0x80) + 'b', 100)).toBe('a b')
    expect(text('a' + String.fromCharCode(0x9F) + 'b', 100)).toBe('a b')
  })

  it('collapses newlines and tabs to single spaces (existing behavior)', () => {
    expect(text('a\n\tb', 100)).toBe('a b')
    expect(text('a\t\t\nb', 100)).toBe('a b')
  })

  it('does not leave trailing space after the cut', () => {
    expect(text('abc def', 4)).toBe('abc')
  })

  it('returns empty string for non-strings', () => {
    expect(text(null, 100)).toBe('')
    expect(text(undefined, 100)).toBe('')
    expect(text(123, 100)).toBe('')
    expect(text(true, 100)).toBe('')
    expect(text({}, 100)).toBe('')
  })

  it('returns empty string for whitespace-only input', () => {
    expect(text('   \n\t  ', 100)).toBe('')
  })

  it('trims both ends', () => {
    expect(text('  hello  ', 100)).toBe('hello')
  })

  it('collapses multiple spaces to single space', () => {
    expect(text('a    b', 100)).toBe('a b')
  })

  it('cuts to max by code points (not UTF-16 units)', () => {
    // ASCII chars: 'abcd' with max=2 should give 'ab'
    expect(text('abcd', 2)).toBe('ab')
  })
})
