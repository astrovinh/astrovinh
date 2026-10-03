/** Whether the Team panel should reopen next session, after it closed. Only the person's own close un-pins it. */
export function pinnedAfterClose(kind: 'plugin' | 'person' | 'unload', current: boolean): boolean {
  return kind === 'person' ? false : current
}
