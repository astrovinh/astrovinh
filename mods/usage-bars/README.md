# usage-bars

A Claude Code mod that draws one row above the prompt, always visible:

- **W**: the 7-day rate-limit window (press it for reset times and today's spend)
- **All**: one ring per machine you work on, filled to how busy it is now (the higher of CPU and memory)
- **C, M, D**: this machine's CPU, memory and disk

Bars and rings turn amber at 60% and red at 85%. A dotted ring means that machine has not reported for 90 seconds.

On the desktop, the band shows W, All and C M D only. The terminal band still shows Day, Week and Ctx.

On desktop, click the CPU, Mem or Disk pill to look at cleanup choices. On macOS, a separate button runs the action. Other systems keep the read-only view.
The desktop band stays on one line at any width: the bar shrinks first, then the dollar figure goes, then the machine rings. W and the C, M and D readings always show.

## Use it

Run Claude Code locally (terminal or desktop Code tab) with:

    claude --plugin-dir /path/to/astrovinh/mods/usage-bars

Day and Week need a subscription plan; on an API key they show `n/a`.
The band above the prompt draws on the terminal and desktop surfaces only.

## Machines

Press **All** to see every machine's CPU, memory and disk side by side, and when each last reported. Each machine is set up in its own `machines.local.json` beside the mod. Git ignores that file, so each machine keeps its own copy:

    {
      "name": "21",
      "order": ["26", "21", "PC", "M4", "M2"],
      "outbox": "/path/to/synced/from-this-machine",
      "inbox": "/path/to/synced/folder-with-every-outbox",
      "ssh": [{ "name": "PC", "host": "my-pc" }]
    }

- `name`: this machine's short label in its ring (two characters read best).
- `order`: the rings, left to right. A machine that never reports shows as a dotted ring.
- `outbox`: where this machine posts its reading every 10 seconds, to `<outbox>/machine-load/<name>.json`. Use a folder your sync tool sends to the other machines.
- `inbox`: a folder whose subfolders are the outboxes. The mod reads `*/machine-load/*.json` one level down.
- `ssh`: machines to ask directly every 30 seconds, for example ones that don't run Claude. The mod runs `ssh -o BatchMode=yes <host>` with a fixed read-only command, so it needs key login. The machine can be macOS or Linux.

Without the file, the band shows no machine rings. Readings only travel as numbers: no process names, paths or files.

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
