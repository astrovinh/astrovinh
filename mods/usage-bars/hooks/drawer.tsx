import { bytes } from './cleanup'
import type { Actions, View } from './actions'
import type { Item } from './scan'
import { gaugeSvg, GAUGE, meterSvg, METER_W } from './gauge'
import type { Gauge } from './gauge'

const ON = '\u25cf'
const OFF = '\u25cb'

/** Native text and text-only buttons beside small round and bar pictures; the host supplies the card surface. */
export function drawerView(ui: any, gauge: Gauge, view: View, actions: Actions, close: () => Promise<void>, columns?: number) {
  const { Box, Text, Button, Svg } = ui
  const ready = view.phase === 'ready'
  const picked = (kind: Item['kind']) => view.items.filter(i => i.kind === kind && view.selected.includes(i.id) && i.eligible)
  const total = (items: Item[]) => bytes(items.reduce((n, i) => n + i.bytes, 0))
  const meter = (n: number, max: number) => <Svg source={meterSvg(max ? n / max : 0, gauge.color)} alt="" width={METER_W} height={6} />
  const row = (max: number) => (i: Item) => i.eligible ? (
    <Box key={`usage-row-${i.id}`} flexDirection="row" justifyContent="space-between" alignItems="center">
      <Button key={`usage-item-${i.id}`} plain onPress={() => actions.toggle(i.id)}>
        <Text size="body">{`${view.selected.includes(i.id) ? ON : OFF}  ${i.name}`}</Text>
      </Button>
      <Box flexDirection="row" alignItems="center">
        {meter(i.bytes, max)}
        <Box width={9} justifyContent="flex-end"><Text size="body" tabular>{bytes(i.bytes)}</Text></Box>
      </Box>
    </Box>
  ) : <Text key={`usage-kept-${i.id}`} size="footnote" dimColor>{`${i.name}   kept (has changes)`}</Text>
  const action = (key: string, label: string, onPress: () => void) => (
    <Box marginTop={1}><Button key={key} plain onPress={onPress}><Text size="body">{label}</Text></Button></Box>
  )
  const heading = (text: string) => <Text size="footnote" dimColor>{text.toUpperCase()}</Text>
  const section = (kind: 'worktree' | 'sim', name: string, button: string) => {
    const items = view.items.filter(i => i.kind === kind)
    if (!items.some(i => i.eligible)) return null
    const max = Math.max(...items.map(i => i.bytes))
    return (
      <Box key={`usage-section-${kind}`} flexDirection="column" marginTop={1}>
        {heading(name)}
        {items.map(row(max))}
        {!picked(kind).length ? null : action(`usage-remove-${kind}`, view.armed === `remove-${kind}` ? 'Sure?' : `${button} ${total(picked(kind))}`, () => actions.clean(kind))}
      </Box>
    )
  }
  const caches = view.items.filter(i => i.kind === 'cache').slice(0, 6)
  const biggest = Math.max(1, ...view.groups.map(g => g.bytes))
  return (
    <Box key="usage-drawer" flexDirection="column" alignSelf="flex-start" width={Math.min(60, Math.max(1, (columns ?? 62) - 2))} marginTop={1}>
      <Box flexDirection="row" justifyContent="space-between" alignItems="center">
        <Box flexDirection="row" alignItems="center">
          <Svg source={gaugeSvg(gauge.percent, gauge.color)} alt="" width={GAUGE} height={GAUGE} />
          <Box flexDirection="column" marginLeft={2}>
            <Text size="body">{gauge.title}</Text>
            <Text size="footnote" dimColor tabular>{gauge.subtitle}</Text>
          </Box>
        </Box>
        <Button key="usage-close" plain onPress={close}><Text size="footnote">Close</Text></Button>
      </Box>
      {!view.message ? null : <Box marginTop={1}><Text size="body">{view.message}</Text></Box>}
      {view.phase === 'looking' ? <Box marginTop={1}><Text size="body" dimColor>Looking...</Text></Box> : null}
      {!ready ? null : view.panel === 'disk' ? (
        <Box flexDirection="column" marginTop={1}>
          {heading(`Safe to clear: ${total(caches)}`)}
          {!view.items.some(i => i.eligible) ? <Text size="body">Nothing to clear right now.</Text> : null}
          {caches.map(row(Math.max(1, ...caches.map(i => i.bytes))))}
          {!picked('cache').length ? null : action('usage-clean', `Clean up ${total(picked('cache'))}`, () => actions.clean('cache'))}
          {section('worktree', 'Old worktrees', 'Remove worktrees')}
          {section('sim', 'Old simulators', 'Remove simulators')}
        </Box>
      ) : (
        <Box flexDirection="column" marginTop={1}>
          {!view.groups.length ? <Text size="body">Nothing to clear right now.</Text> : null}
          {view.groups.map(g => (
            <Box key={`usage-group-${g.id}`} flexDirection="row" justifyContent="space-between" alignItems="center">
              <Box flexDirection="column">
                <Text size="body">{g.name}</Text>
                <Text size="footnote" dimColor>{`${g.pids.length} ${g.pids.length === 1 ? 'process' : 'processes'}`}</Text>
              </Box>
              <Box flexDirection="row" alignItems="center">
                {meter(g.bytes, biggest)}
                <Box width={9} justifyContent="flex-end"><Text size="body" tabular>{bytes(g.bytes)}</Text></Box>
                <Box width={9} justifyContent="flex-end">
                  {g.protected ? <Text size="footnote" dimColor>protected</Text> : (
                    <Button key={`usage-quit-${g.id}`} plain onPress={() => actions.quit(g.id)}><Text size="body">{view.armed === `quit-${g.id}` ? 'Sure?' : 'Quit'}</Text></Button>
                  )}
                </Box>
              </Box>
            </Box>
          ))}
          <Box marginTop={1}><Button key="usage-refresh" plain onPress={() => actions.refresh()}><Text size="footnote">Refresh</Text></Button></Box>
        </Box>
      )}
      {view.panel !== 'disk' || view.phase === 'readonly' ? null : <Box marginTop={1}><Text size="footnote" dimColor>Your projects, notes and git work are never listed.</Text></Box>}
    </Box>
  )
}
