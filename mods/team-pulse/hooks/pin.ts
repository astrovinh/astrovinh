/** Whether the Team panel should reopen next session, after it closed. Only the person's own close un-pins it. */
export function pinnedAfterClose(kind: 'plugin' | 'person' | 'unload', current: boolean): boolean {
  return kind === 'person' ? false : current
}

/** Where the Team pane stands in the engine's own record: on screen, held back (narrow window, split view), or not open at all. */
export function paneStateOf(panes: readonly { id: string; isPlaced: boolean }[], id: string): 'shown' | 'waiting' | 'closed' {
  const pane = panes.find(p => p.id === id)
  if (!pane) return 'closed'
  return pane.isPlaced ? 'shown' : 'waiting'
}

/** How this session's pane should follow the shared panel pin. */
export function followAction(pinned: boolean, state: 'shown' | 'waiting' | 'closed'): 'open' | 'close' | 'none' {
  if (pinned && state === 'closed') return 'open'
  if (!pinned && state !== 'closed') return 'close'
  return 'none'
}
