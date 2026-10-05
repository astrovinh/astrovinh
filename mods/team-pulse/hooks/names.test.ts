import { test, expect } from 'claude-code/testing'
import { cleanName } from './names'

test('angle brackets typed around a name from the guide are stripped', () => {
  expect(cleanName('<Brian>')).toBe('Brian')
})

test('quotes around a name are stripped', () => {
  expect(cleanName('"Linh"')).toBe('Linh')
  expect(cleanName("'Linh'")).toBe('Linh')
})

test('spaces around a name are stripped', () => {
  expect(cleanName('  Mai  ')).toBe('Mai')
})

test('only surrounding brackets and quotes go, not ones inside the name', () => {
  expect(cleanName('A<b>c')).toBe('A<b>c')
})

test('a name that is only brackets becomes empty', () => {
  expect(cleanName('<>')).toBe('')
})

test('brackets with spaces inside are tidied once the brackets go', () => {
  expect(cleanName('< Brian >')).toBe('Brian')
})
