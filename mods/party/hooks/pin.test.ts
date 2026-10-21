import { test, expect } from 'claude-code/testing'
import { followAction, paneStateOf, pinnedAfterClose } from './pin'

test('a closed pane opens when the panel is pinned', () => { expect(followAction(true, 'closed')).toBe('open') })
test('a shown pane stays open when the panel is pinned', () => { expect(followAction(true, 'shown')).toBe('none') })
test('a waiting pane is left for the engine to seat', () => { expect(followAction(true, 'waiting')).toBe('none') })
test('a closed pane stays closed when the panel is not pinned', () => { expect(followAction(false, 'closed')).toBe('none') })
test('a shown pane closes when the panel is not pinned', () => { expect(followAction(false, 'shown')).toBe('close') })
test('a waiting pane closes when the panel is not pinned', () => { expect(followAction(false, 'waiting')).toBe('close') })
test('only the person closing the pane unpins it', () => {
  for (const kind of ['person', 'plugin', 'unload'] as const) {
    expect(pinnedAfterClose(kind, true)).toBe(kind !== 'person')
    expect(pinnedAfterClose(kind, false)).toBe(false)
  }
})
test('pane placement distinguishes waiting, shown and absent panes', () => {
  expect(paneStateOf([], 'party')).toBe('closed')
  expect(paneStateOf([{ id: 'other', isPlaced: true }], 'party')).toBe('closed')
  expect(paneStateOf([{ id: 'party', isPlaced: false }], 'party')).toBe('waiting')
  expect(paneStateOf([{ id: 'party', isPlaced: true }], 'party')).toBe('shown')
})
