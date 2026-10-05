# Murror team mod

See who on the team is working in Claude Code, what they are working on, and their limits. You can also leave an away note.

## What's new (Oct 4)

Already installed? Update in two steps: run the install command below again, then open a new Claude Code session.

- **Change your name:** type `/team name` followed by the name you want, for example `/team name Brian`. Handy if you joined with a typo or with the `< >` from the old example.
- **Split view works:** type `/team` in the half where you want the panel. Use the right-hand half to keep it at the edge of the window.
- **No more `< >` mix-ups:** joining with `<Linh>` now joins you as Linh.

## Install (2 minutes)

1. Paste this in your terminal:

```
curl -fsSL https://raw.githubusercontent.com/astrovinh/astrovinh/claude/usage-bars-mod/mods/team-pulse/install.sh | bash
```

2. Open a new Claude Code session. If you don't see the team line under your prompt, quit Claude Code and open it again.
3. Type `/team join` followed by the code and your name, without the `< >`. For example:

```
/team join abcd234xyz.k2m3n4p5 Linh
```

   That code is only an example. Ask Astro for the real one. Use the name your teammates know you by.

## Every day

| You type or see | What it does |
|---|---|
| `/team` | Opens or closes the team panel. It stays open in new sessions until you close it. |
| The line under your prompt, like "Online members 🟢 Linh 🟡 Mai" | Green means working. Yellow means idle. |
| `/team name <new name>` | Changes the name your teammates see. |
| `/team status <note>` | Sets an away note that shows under your name. It stays until you clear it. |
| `/team status` | Clears your away note. |
| `/team say <text>` | Writes your own "working on" line. |
| `/team say` | Goes back to the automatic line. |
| `/team pause` | Stops sharing from this Mac. |
| `/team resume` | Starts sharing again. |

## What your teammates see

- Your name.
- Whether you are working or idle.
- Your project folder and git branch, for each open session.
- A short AI summary of your latest request. It is made through your own Claude login. Your actual prompt is never shared.
- Your 5-hour and weekly limit percent.
- How many Claude Code sessions you have open, and how long each has been open.
- When you were active or idle in the last 12 hours (active means you sent a request or Claude was working on it).
- Your away note, if you set one.

This is sent every 60 seconds while a session is open. Your own row in `/team` shows exactly what is shared about you.

Sharing covers every Claude Code session on this Mac, in any folder, including personal ones. Type `/team pause` before private work.

The person who runs the team server (Astro) can read everything it stores.

Never shared: your prompts, Claude's replies, your code, file paths beyond the folder name, or cost.

Kept for 7 days. `/team leave` deletes everything about you.

## If something looks wrong

**I don't see the panel or the line.**
Open a new Claude Code session. Mods load when a session starts.

**My line says the project name instead of what I'm doing.**
Send a normal request. Slash commands do not count. A greeting gives no summary.

**It says it can't reach the team server.**
Try again in a few minutes. Check your internet. Tell Astro if it lasts.

**The panel disappeared when I used split view.**
Split view makes each half narrow, and the panel only reopens by itself when there is room. Type `/team` in the half where you want it.

**I joined with the wrong name.**
Type `/team name` followed by the right name, for example `/team name Brian`.

**I want to stop sharing.**
Type `/team pause`. To leave the team and delete your data, type `/team leave`.

## Update or remove

To update, run the install command again.

To remove: type `/team leave` first if you want your data deleted, then remove the `mods/team-pulse` path from `CLAUDE_CODE_PLUGIN_DIRS` in `~/.claude/settings.json` (a backup was saved next to it when you installed).
