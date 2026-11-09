import type { View } from '../types'
export type { View } from '../types'
import { bytes, removeArgv } from './cleanup'
import { parseProcesses, protectedProcess, ownTree, sameProcess, signalArgv, PS } from './procs'
import type { Group } from './procs'
import { checkTarget, command, scanDisk, scanGroups, scanSimulators, scanWorktrees, size, stat } from './scan'
import type { Context, IO, Item } from './scan'
import type { Panel } from './bars'

export const initialView = (): View => ({ panel: null, phase: 'readonly', items: [], groups: [], selected: [], armed: null, until: 0, message: '' })
export type Host = IO & { home: () => Promise<string | undefined>; tmp: () => Promise<string | undefined>; cwd: () => Promise<string>; now: () => Promise<number>; after: (ms: number, fn: () => void) => unknown }
/** Only event handlers call this controller. Rendering reads its published snapshot. */
export function cleanupActions(io: Host, publish: (view: View) => Promise<void>) {
  let view = initialView(); let epoch = 0; let locked = false
  let context: Context | null = null
  const put = async (next: View) => { view = next; await publish(next) }
  const clock = async () => ({ ...context!, now: await io.now() })
  const fail = async (token: number, message: string) => {
    if (token === epoch) await put({ ...view, phase: 'error', armed: null, message })
  }
  const load = async (token: number, message = '') => {
    const c = await clock()
    const items = view.panel === 'disk' ? await scanDisk(io, c) : []
    const gs = view.panel === 'cpu' || view.panel === 'mem' ? await scanGroups(io, c, view.panel) : []
    if (token !== epoch) return
    await put({ ...view, phase: 'ready', items, groups: gs, selected: items.filter(i => i.kind === 'cache').slice(0,6).map(i => i.id), armed: null, until: 0, message })
  }
  const confirm = async (id: string): Promise<boolean> => {
    const now = await io.now()
    if (view.armed === id && now < view.until) return true
    const token = epoch; const until = now + 5000
    await put({ ...view, armed: id, until })
    // Only resets the label. It never scans, removes files or sends a signal.
    io.after(5000, () => { if (token === epoch && view.armed === id && view.until === until) void put({ ...view, armed: null, until: 0 }) })
    return false
  }
  return {
    async close() { epoch++; await put(initialView()) },
    async open(panel: Panel) {
      const token = ++epoch
      await put({ ...initialView(), panel, phase: 'looking' })
      try {
        const platform = (await command(io, ['uname', '-s'])).trim()
        if (token !== epoch) return
        if (platform !== 'Darwin') {
          if (token === epoch) await put({ ...view, phase: 'readonly' })
          return
        }
        const home = await io.home(); const tmp = await io.tmp()
        const hs = home ? await stat(io, home) : null
        const ts = tmp ? await stat(io, tmp.replace(/\/$/, '')) : null
        const uid = Number((await command(io, ['id', '-u'])).trim())
        // The child asks for its parent's PID, the engine process hosting this mod.
        const pid = Number((await command(io, ['python3', '-c', 'import os; print(os.getppid())'])).trim())
        if (!hs?.realPath || !Number.isSafeInteger(uid) || uid <= 0 || !Number.isSafeInteger(pid) || pid <= 1) throw new Error('Missing host identity')
        const cwd = await io.cwd(); const cs = await stat(io, cwd)
        if (!cs?.realPath) throw new Error('Missing session directory')
        context = { home: hs.realPath, tmp: ts?.realPath ?? '', uid, pid, cwd: cs.realPath, now: await io.now() }
        if (token === epoch) await load(token)
      } catch { await fail(token, 'Could not read these items.') }
    },
    async refresh() {
      if (view.phase !== 'ready' || locked) return
      const token = ++epoch
      await put({ ...view, phase: 'looking', message: '', armed: null })
      try { await load(token) } catch { await fail(token, 'Could not read these items.') }
    },
    async toggle(id: string) {
      if (view.phase !== 'ready' || locked || !view.items.some(i => i.id === id && i.eligible)) return
      const kind = view.items.find(i => i.id === id)!.kind
      const previous = kind === 'cache' ? view.selected : view.selected.filter(x => view.items.find(i => i.id === x)?.kind !== kind)
      const selected = view.selected.includes(id) ? view.selected.filter(x => x !== id) : [...previous, id]
      await put({ ...view, selected, armed: null, until: 0 })
    },
    async clean(kind: Item['kind']) {
      if (view.phase !== 'ready' || locked || !context) return
      const selected = view.items.filter(i => i.kind === kind && i.eligible && view.selected.includes(i.id))
      if (!selected.length) return
      const token = epoch
      locked = true
      if (kind !== 'cache' && !await confirm(`remove-${kind}`)) { locked = false; return }
      if (token !== epoch) { locked = false; return }
      await put({ ...view, phase: 'busy', armed: null, message: 'Looking...' })
      try {
        const c = await clock(); let before = 0; let after = 0
        for (const item of selected) {
          if (token !== epoch) return
          if (kind === 'cache') {
            for (const t of item.targets) {
              if (token !== epoch) return
              if (!await checkTarget(io, c, t)) throw new Error('Changed item')
              before += await size(io, t.path)
              if (token !== epoch) return
              // No tool-wide cache command can widen this exact path allowlist.
              const r = await io.run(removeArgv(t.path), { timeoutMs: 3000 })
              if (r.exitCode !== 0) throw new Error('Removal failed')
              if (await stat(io, t.path)) after += await size(io, t.path)
            }
          } else {
            const fresh = kind === 'sim' ? await scanSimulators(io, c) : await scanWorktrees(io, c)
            const current = fresh.find(i => i.id === item.id && i.eligible && JSON.stringify(i.argv) === JSON.stringify(item.argv))
            if (!current?.argv || token !== epoch) throw new Error('Changed item')
            before += current.bytes
            const r = await io.run(current.argv, { timeoutMs: 3000 })
            if (r.exitCode !== 0) throw new Error('Removal failed')
            const remaining = kind === 'sim' ? await scanSimulators(io, await clock()) : await scanWorktrees(io, await clock())
            after += remaining.find(i => JSON.stringify(i.argv) === JSON.stringify(item.argv))?.bytes ?? 0
          }
        }
        await load(token, `Freed ${bytes(Math.max(0, before - after))}`)
      } catch { await fail(token, 'Could not clear this item.') }
      finally { locked = false }
    },
    async quit(id: string) {
      if (view.phase !== 'ready' || locked || !context) return
      const group = view.groups.find(g => g.id === id)
      if (!group || group.protected) return
      const token = epoch
      locked = true
      if (!await confirm(`quit-${id}`)) { locked = false; return }
      if (token !== epoch) { locked = false; return }
      await put({ ...view, phase: 'busy', armed: null, message: 'Looking...' })
      try {
        const c = await clock(); let before = 0; const signalled: number[] = []
        // Rebuild protection from the live tree, then read each PID immediately before signalling.
        const all = parseProcesses(await command(io, PS)); const tree = ownTree(all, c.pid)
        if (!all.some(p => p.pid === c.pid)) throw new Error('Missing process tree')
        for (const original of group.processes) {
          if (token !== epoch) return
          const rpid = await io.run(['ps', '-ww', '-p', String(original.pid), '-o', PS[PS.length - 1]!], { timeoutMs: 3000 })
          if (token !== epoch) return
          if (rpid.isStdoutTruncated) throw new Error('Incomplete process identity')
          const fresh = rpid.exitCode === 0 ? parseProcesses(rpid.stdout)[0] : undefined
          if (!sameProcess(original, fresh) || !fresh || protectedProcess(fresh, c.uid, tree)) continue
          before += fresh.rss
          const r = await io.run(signalArgv([fresh.pid]), { timeoutMs: 3000 })
          if (r.exitCode !== 0) throw new Error('Signal failed')
          signalled.push(fresh.pid)
        }
        const remaining = parseProcesses(await command(io, PS))
        const after = remaining.filter(p => signalled.includes(p.pid) && group.processes.some(original => sameProcess(original, p))).reduce((n,p) => n + p.rss, 0)
        await load(token, `Freed ${bytes(Math.max(0, before - after))}`)
      } catch { await fail(token, 'Could not quit this app.') }
      finally { locked = false }
    }
  }
}
export type Actions = ReturnType<typeof cleanupActions>
