import { test, expect } from 'claude-code/testing'
import { followAction, paneStateOf, pinnedAfterClose } from './pin'

test('a closed pane opens when the panel is pinned', () => {
  expect(followAction(true, 'closed')).toBe('open')
})

test('a shown pane stays open when the panel is pinned', () => {
  expect(followAction(true, 'shown')).toBe('none')
})

test('a waiting pane is left for the engine to seat', () => {
  expect(followAction(true, 'waiting')).toBe('none')
})

test('a closed pane stays closed when the panel is not pinned', () => {
  expect(followAction(false, 'closed')).toBe('none')
})

test('a shown pane closes when the panel is not pinned', () => {
  expect(followAction(false, 'shown')).toBe('close')
})

test('a waiting pane closes when the panel is not pinned', () => {
  expect(followAction(false, 'waiting')).toBe('close')
})

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
