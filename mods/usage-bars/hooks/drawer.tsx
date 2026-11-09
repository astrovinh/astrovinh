import { bytes } from './cleanup'
import type { Actions, View } from './actions'
import type { Item } from './scan'
import { LEGEND, ROW_H, rowSvg, SHARE_H, shareSvg } from './gauge'
import type { Gauge } from './gauge'

const ON = '\u25cf'
const OFF = '\u25cb'
/**
 * Room beside the pictures, in CSS px: Close and Quit start right after each picture, so they share one
 * left edge; the tick sits before Disk rows. Nothing is sized in text cells, whose pixel width the
 * desktop never reports (sizing in cells made the drawer wider than the card).
 */
const ACTION_PX = 70
const TICK_PX = 22

/** One share bar and a colour legend drawn as pictures, with native text buttons beside them; the host supplies the card. */
export function drawerView(ui: any, gauge: Gauge, view: View, actions: Actions, close: () => Promise<void>, widthPx: number) {
  const { Box, Text, Button, Svg } = ui
  // The drawer takes the band's text width, so both share one left and one right edge.
  const width = Math.max(240, widthPx)
  const rowPx = width - ACTION_PX
  const ready = view.phase === 'ready'
  const picked = (kind: Item['kind']) => view.items.filter(i => i.kind === kind && view.selected.includes(i.id) && i.eligible)
  const total = (items: Item[]) => bytes(items.reduce((n, i) => n + i.bytes, 0))
  const share = (n: number) => (gauge.capacity > 0 ? n / gauge.capacity : 0)
  const caches = view.items.filter(i => i.kind === 'cache').slice(0, 6)
  const cpu = view.panel === 'cpu'
  const listed = view.panel === 'disk' ? caches.map(i => share(i.bytes)) : view.groups.map(g => share(cpu ? g.cpu : g.bytes))
  const picture = (key: string, source: string, alt: string, px: number, height: number) => <Svg key={key} source={source} alt={alt || 'Row'} width={px} height={height} />
  const quiet = (text: string) => <Text size="footnote" dimColor>{text}</Text>
  const line = (text: string) => <Box marginTop={1}><Text size="body">{text}</Text></Box>
  const action = (key: string, label: string, onPress: () => void) => (
    <Box marginTop={1}><Button key={key} plain onPress={onPress}><Text size="body">{label}</Text></Button></Box>
  )
  const heading = (text: string) => <Box marginTop={1}><Text size="footnote" dimColor>{text}</Text></Box>
  const item = (color: string | null) => (i: Item) => (
    <Box key={`usage-row-${i.id}`} flexDirection="row" alignItems="center">
      {i.eligible ? (
        <Button key={`usage-item-${i.id}`} plain onPress={() => actions.toggle(i.id)}>
          <Text size="body">{view.selected.includes(i.id) ? ON : OFF}</Text>
        </Button>
      ) : <Text size="body">{'\u00a0'}</Text>}
      {picture(`usage-pic-${i.id}`, rowSvg(color, i.name, i.eligible ? '' : 'kept, has changes', bytes(i.bytes), rowPx - TICK_PX), `${i.name} ${bytes(i.bytes)}`, rowPx - TICK_PX, ROW_H)}
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
    <Box key="usage-drawer" flexDirection="column" marginTop={1}>
      <Box flexDirection="row" alignItems="center">
        {picture('usage-share', shareSvg(gauge, ready ? listed : [], rowPx), `${gauge.title} ${gauge.subtitle}`, rowPx, SHARE_H)}
        <Box marginLeft={1}><Button key="usage-close" plain onPress={close}>{quiet('Close')}</Button></Box>
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
              {/* "protected" is drawn in the picture's action column; Quit is a native button right after it. */}
              {picture(`usage-pic-${g.id}`, rowSvg(LEGEND[n % LEGEND.length]!, g.name, String(g.pids.length), cpu ? `${Math.round(g.cpu)}%` : bytes(g.bytes), rowPx, g.protected ? 'protected' : '', ACTION_PX), `${g.name} ${cpu ? `${Math.round(g.cpu)}%` : bytes(g.bytes)}${g.protected ? ', protected' : ''}`, g.protected ? width : rowPx, ROW_H)}
              {g.protected ? null : (
                <Box marginLeft={1}>
                  <Button key={`usage-quit-${g.id}`} plain onPress={() => actions.quit(g.id)}>{quiet(view.armed === `quit-${g.id}` ? 'Sure?' : 'Quit')}</Button>
                </Box>
              )}
            </Box>
          ))}
          <Box marginTop={1}><Button key="usage-refresh" plain onPress={() => actions.refresh()}>{quiet('Refresh')}</Button></Box>
        </Box>
      )}
      {view.panel !== 'disk' || view.phase === 'readonly' ? null : <Box marginTop={1}><Text size="footnote" dimColor>Your projects, notes and git work are never listed.</Text></Box>}
    </Box>
  )
}
