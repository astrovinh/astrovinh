# usage-bars

A Claude Code mod that draws one row above the prompt, always visible:

- **Day**: the 5-hour rate-limit window
- **Week**: the 7-day rate-limit window
- **Ctx**: the context window, stacked with one color per category

Limit bars turn amber at 60% and red at 85%. A second line shows reset times and the context legend.

On desktop, click the CPU, Mem or Disk pill to look at cleanup choices. On macOS, a separate button runs the action. Other systems keep the read-only view.
The desktop band stays on one line at any width: the bars shrink first, then the dollar figure, then Ctx and Week drop. The C, M and D readings (CPU, memory, disk) always show.

## Use it

Run Claude Code locally (terminal or desktop Code tab) with:

    claude --plugin-dir /path/to/astrovinh/mods/usage-bars

Day and Week need a subscription plan; on an API key they show `n/a`.
The band above the prompt draws on the terminal and desktop surfaces only.

## Cleanup

Opening a pill only reads sizes and lists. Nothing is removed or quit by rendering, polling or a timer.

- Disk lists a small set of caches, logs older than 14 days and owned temporary files older than 3 days. Tick the rows you want, then press Clean up.
- Old worktrees and old simulators have separate sections. Select one item, then press its removal button twice to confirm.
- CPU and Mem show up to six app groups. Press Quit, then Sure? within five seconds to send SIGTERM. Refresh reads the list again.
- System apps, other users' processes and this mod's process tree are protected. Each PID's identity is checked again before sending a signal.
- Projects, documents, notes, settings and git data are excluded from cache cleanup. A worktree with changes, unpushed commits, recent activity or an active session is kept. Booted, recent and reserved test simulators are kept.
- Actions recheck their targets and show the measured size change. An error stops the action; there is no automatic retry.

## Develop

    claude plugin validate mods/usage-bars
    claude plugin test mods/usage-bars
