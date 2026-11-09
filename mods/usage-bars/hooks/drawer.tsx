import { bytes } from './cleanup'
import type { Actions, View } from './actions'
import type { Item } from './scan'
import { CELL_PX, LEGEND, ROW_H, rowSvg, SHARE_H, shareSvg } from './gauge'
import type { Gauge } from './gauge'

const ON = '\u25cf'
const OFF = '\u25cb'
/** Text columns beside the pictures: Close and Quit at the right, the tick at the left. */
const ACTION_W = 12
const TICK_W = 3

/** One share bar and a colour legend drawn as pictures, with native text buttons beside them; the host supplies the card. */
export function drawerView(ui: any, gauge: Gauge, view: View, actions: Actions, close: () => Promise<void>, widthPx: number) {
  const { Box, Text, Button, Svg } = ui
  // The drawer takes the band's width, so both share one left and one right edge.
  const width = Math.max(20, Math.floor(widthPx / CELL_PX))
  const px = (cells: number) => cells * CELL_PX
  const ready = view.phase === 'ready'
  const picked = (kind: Item['kind']) => view.items.filter(i => i.kind === kind && view.selected.includes(i.id) && i.eligible)
  const total = (items: Item[]) => bytes(items.reduce((n, i) => n + i.bytes, 0))
  const share = (n: number) => (gauge.capacity > 0 ? n / gauge.capacity : 0)
  const caches = view.items.filter(i => i.kind === 'cache').slice(0, 6)
  const cpu = view.panel === 'cpu'
  const listed = view.panel === 'disk' ? caches.map(i => share(i.bytes)) : view.groups.map(g => share(cpu ? g.cpu : g.bytes))
  const picture = (key: string, source: string, alt: string, cells: number, height: number) => <Svg key={key} source={source} alt={alt} width={px(cells)} height={height} />
  const quiet = (text: string) => <Text size="footnote" dimColor>{text}</Text>
  const line = (text: string) => <Box marginTop={1}><Text size="body">{text}</Text></Box>
  const action = (key: string, label: string, onPress: () => void) => (
    <Box marginTop={1}><Button key={key} plain onPress={onPress}><Text size="body">{label}</Text></Button></Box>
  )
  const heading = (text: string) => <Box marginTop={1}><Text size="footnote" dimColor>{text}</Text></Box>
  const item = (color: string | null) => (i: Item) => (
    <Box key={`usage-row-${i.id}`} flexDirection="row" alignItems="center">
      <Box width={TICK_W}>
        {i.eligible ? (
          <Button key={`usage-item-${i.id}`} plain onPress={() => actions.toggle(i.id)}>
            <Text size="body">{view.selected.includes(i.id) ? ON : OFF}</Text>
          </Button>
        ) : null}
      </Box>
      {picture(`usage-pic-${i.id}`, rowSvg(color, i.name, i.eligible ? '' : 'kept, has changes', bytes(i.bytes), px(width - TICK_W)), `${i.name} ${bytes(i.bytes)}`, width - TICK_W, ROW_H)}
    </Box>
  )
  const section = (kind: 'worktree' | 'sim', name: string, button: string) => {
    const items = view.items.filter(i => i.kind === kind)
    if (!items.some(i => i.eligible)) return null
    return (
      <Box key={`usage-section-${kind}`} flexDirection="column">
        {heading(name)}
        {items.map(item(null))}
        {!picked(kind).length ? null : action(`usage-remove-${kind}`, view.armed === `remove-${kind}` ? 'Sure?' : `${button} ${total(picked(kind))}`, () => actions.clean(kind))}
      </Box>
    )
  }
  return (
    <Box key="usage-drawer" flexDirection="column" width={width} marginTop={1}>
      <Box flexDirection="row" alignItems="flex-start">
        {picture('usage-share', shareSvg(gauge, ready ? listed : [], px(width - ACTION_W)), `${gauge.title} ${gauge.subtitle}`, width - ACTION_W, SHARE_H)}
        <Box width={ACTION_W} alignItems="flex-end" paddingTop={1}><Button key="usage-close" plain onPress={close}>{quiet('Close')}</Button></Box>
      </Box>
      {!view.message ? null : line(view.message)}
      {view.phase === 'looking' ? <Box marginTop={1}><Text size="body" dimColor>Looking...</Text></Box> : null}
      {!ready ? null : view.panel === 'disk' ? (
        <Box flexDirection="column">
          {heading(`Safe to clear: ${total(caches)}`)}
          {!view.items.some(i => i.eligible) ? line('Nothing to clear right now.') : null}
          {caches.map((c, n) => item(LEGEND[n % LEGEND.length]!)(c))}
          {!picked('cache').length ? null : action('usage-clean', `Clean up ${total(picked('cache'))}`, () => actions.clean('cache'))}
          {section('worktree', 'Old worktrees', 'Remove worktrees')}
          {section('sim', 'Old simulators', 'Remove simulators')}
        </Box>
      ) : (
        <Box flexDirection="column" marginTop={1}>
          {!view.groups.length ? line('Nothing to clear right now.') : null}
          {view.groups.map((g, n) => (
            <Box key={`usage-group-${g.id}`} flexDirection="row" alignItems="center">
              {picture(`usage-pic-${g.id}`, rowSvg(LEGEND[n % LEGEND.length]!, g.name, String(g.pids.length), cpu ? `${Math.round(g.cpu)}%` : bytes(g.bytes), px(width - ACTION_W)), `${g.name} ${cpu ? `${Math.round(g.cpu)}%` : bytes(g.bytes)}`, width - ACTION_W, ROW_H)}
              <Box width={ACTION_W} alignItems="flex-end">
                {g.protected ? quiet('protected') : (
                  <Button key={`usage-quit-${g.id}`} plain onPress={() => actions.quit(g.id)}>{quiet(view.armed === `quit-${g.id}` ? 'Sure?' : 'Quit')}</Button>
                )}
              </Box>
            </Box>
          ))}
          <Box marginTop={1}><Button key="usage-refresh" plain onPress={() => actions.refresh()}>{quiet('Refresh')}</Button></Box>
        </Box>
      )}
      {view.panel !== 'disk' || view.phase === 'readonly' ? null : <Box marginTop={1}><Text size="footnote" dimColor>Your projects, notes and git work are never listed.</Text></Box>}
    </Box>
  )
}
