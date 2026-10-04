import { test, expect } from 'claude-code/testing'
import { openAfter, pinnedAfterClose } from './pin'

test('the person closing the panel un-pins it', () => {
  expect(pinnedAfterClose('person', true)).toBe(false)
  expect(pinnedAfterClose('person', false)).toBe(false)
})

test('the engine unloading the pane keeps the pin as it was', () => {
  expect(pinnedAfterClose('unload', true)).toBe(true)
  expect(pinnedAfterClose('unload', false)).toBe(false)
})

test('a close the plugin made itself keeps the pin as it was', () => {
  expect(pinnedAfterClose('plugin', true)).toBe(true)
  expect(pinnedAfterClose('plugin', false)).toBe(false)
})

test('an open the engine placed counts as open', () => {
  expect(openAfter({ isPlaced: true })).toBe(true)
})

test('an open the engine held back (split view, narrow window) does not count as open', () => {
  expect(openAfter({ isPlaced: false, reason: 'narrow' })).toBe(false)
})

test('a rejected or missing open result does not count as open', () => {
  expect(openAfter(undefined)).toBe(false)
  expect(openAfter(null)).toBe(false)
})
