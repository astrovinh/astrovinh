/** Only the person's close unpins the panel shared by all sessions. */
export function pinnedAfterClose(kind: 'plugin' | 'person' | 'unload', current: boolean): boolean {
  return kind === 'person' ? false : current
}

export function paneStateOf(panes: readonly { id: string; isPlaced: boolean }[], id: string): 'shown' | 'waiting' | 'closed' {
  const pane = panes.find(p => p.id === id)
  return pane ? pane.isPlaced ? 'shown' : 'waiting' : 'closed'
}

export function followAction(pinned: boolean, state: 'shown' | 'waiting' | 'closed'): 'open' | 'close' | 'none' {
  if (pinned && state === 'closed') return 'open'
  if (!pinned && state !== 'closed') return 'close'
  return 'none'
}
