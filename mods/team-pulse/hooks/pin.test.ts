import { test, expect } from 'claude-code/testing'
import { paneStateOf, pinnedAfterClose } from './pin'

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

test('no pane with that id means closed', () => {
  expect(paneStateOf([], 'team')).toBe('closed')
  expect(paneStateOf([{ id: 'other', isPlaced: true }], 'team')).toBe('closed')
})

test('a placed pane is shown', () => {
  expect(paneStateOf([{ id: 'other', isPlaced: false }, { id: 'team', isPlaced: true }], 'team')).toBe('shown')
})

test('a pane the engine is holding back (split view, narrow window) is waiting, not shown', () => {
  expect(paneStateOf([{ id: 'team', isPlaced: false }], 'team')).toBe('waiting')
})
