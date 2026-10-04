/** Whether the Team panel should reopen next session, after it closed. Only the person's own close un-pins it. */
export function pinnedAfterClose(kind: 'plugin' | 'person' | 'unload', current: boolean): boolean {
  return kind === 'person' ? false : current
}

/** Whether the panel is really on screen after an open. The engine holds back an unasked pane in a narrow window (split view), and a rejected call leaves nothing open. */
export function openAfter(result: { isPlaced: boolean; reason?: string } | null | undefined): boolean {
  return result?.isPlaced === true
}
