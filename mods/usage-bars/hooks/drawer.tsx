import { bytes } from './cleanup'
import type { Actions, View } from './actions'
import type { Item } from './scan'

/** Plain native text and text-only buttons; the host supplies the card surface. */
export function drawerView(ui: any, title: string, view: View, actions: Actions, close: () => Promise<void>, columns?: number) {
  const { Box, Text, Button } = ui
  const ready = view.phase === 'ready'
  const picked = (kind: Item['kind']) => view.items.filter(i => i.kind === kind && view.selected.includes(i.id) && i.eligible)
  const total = (items: Item[]) => bytes(items.reduce((n,i) => n + i.bytes, 0))
  const row = (i: Item) => i.eligible ? (
    <Button key={`usage-item-${i.id}`} plain onPress={() => actions.toggle(i.id)}>
      <Text size="body" tabular>{`${view.selected.includes(i.id) ? '[x]' : '[ ]'} ${i.name}   ${bytes(i.bytes)}`}</Text>
    </Button>
  ) : <Text key={`usage-kept-${i.id}`} size="footnote" dimColor>{`${i.name}   kept (has changes)`}</Text>
  const section = (kind: 'worktree' | 'sim', name: string, button: string) => {
    const items = view.items.filter(i => i.kind === kind)
    if (!items.some(i => i.eligible)) return null
    return (
      <Box key={`usage-section-${kind}`} flexDirection="column" marginTop={1}>
        <Text size="body">{name}</Text>
        {items.map(row)}
        {!picked(kind).length ? null : <Button key={`usage-remove-${kind}`} plain onPress={() => actions.clean(kind)}>
          <Text size="body">{view.armed === `remove-${kind}` ? 'Sure?' : `${button} ${total(picked(kind))}`}</Text>
        </Button>}
      </Box>
    )
  }
  const caches = view.items.filter(i => i.kind === 'cache')
  return (
    <Box key="usage-drawer" flexDirection="column" alignSelf="flex-start" width={Math.min(60, Math.max(1, (columns ?? 62) - 2))} marginTop={1}>
      <Box flexDirection="row" justifyContent="space-between" alignItems="center">
        <Text size="body" tabular>{title}</Text>
        <Button key="usage-close" plain onPress={close}><Text size="footnote">Close</Text></Button>
      </Box>
      {!view.message ? null : <Text size="body">{view.message}</Text>}
      {view.phase === 'looking' ? <Text size="body">Looking...</Text> : null}
      {!ready ? null : view.panel === 'disk' ? (
        <Box flexDirection="column" marginTop={1}>
          <Text size="body" tabular>{`Safe to clear: ${total(caches)}`}</Text>
          {!view.items.some(i => i.eligible) ? <Text size="body">Nothing to clear right now.</Text> : null}
          {caches.slice(0,6).map(row)}
          {!picked('cache').length ? null : <Button key="usage-clean" plain onPress={() => actions.clean('cache')}>
            <Text size="body">{`Clean up ${total(picked('cache'))}`}</Text>
          </Button>}
          {section('worktree', 'Old worktrees', 'Remove worktrees')}
          {section('sim', 'Old simulators', 'Remove simulators')}
        </Box>
      ) : (
        <Box flexDirection="column" marginTop={1}>
          {!view.groups.length ? <Text size="body">Nothing to clear right now.</Text> : null}
          {view.groups.map(g => (
            <Box key={`usage-group-${g.id}`} flexDirection="row" justifyContent="space-between" alignItems="center">
              <Text size="body" tabular>{`${g.name}   ${bytes(g.bytes)}   ${g.pids.length} ${g.pids.length === 1 ? 'process' : 'processes'}`}</Text>
              {g.protected ? <Text size="footnote" dimColor>protected</Text> : (
                <Button key={`usage-quit-${g.id}`} plain onPress={() => actions.quit(g.id)}><Text size="body">{view.armed === `quit-${g.id}` ? 'Sure?' : 'Quit'}</Text></Button>
              )}
            </Box>
          ))}
          <Button key="usage-refresh" plain onPress={() => actions.refresh()}><Text size="footnote">Refresh</Text></Button>
        </Box>
      )}
      {view.panel !== 'disk' || view.phase === 'readonly' ? null : <Text size="footnote" dimColor>Your projects, notes and git work are never listed.</Text>}
    </Box>
  )
}
