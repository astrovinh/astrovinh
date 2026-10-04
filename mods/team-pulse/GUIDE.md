# Murror team mod

See who on the team is working in Claude Code, what they are working on, and their limits. You can also leave an away note.

## Install (2 minutes)

1. Paste this in your terminal:

```
curl -fsSL https://raw.githubusercontent.com/astrovinh/astrovinh/claude/usage-bars-mod/mods/team-pulse/install.sh | bash
```

2. Open a new Claude Code session.
3. Type `/team join <code> <your name>`. Ask Astro for the code. Use the name your teammates know you by.

## Every day

| You type or see | What it does |
|---|---|
| `/team` | Opens or closes the team panel. It stays open in new sessions until you close it. |
| The line under your prompt, like "Online members 🟢 Linh 🟡 Mai" | Green means working. Yellow means idle. |
| `/team status <note>` | Sets an away note that shows next to your name. It stays until you clear it. |
| `/team status` | Clears your away note. |
| `/team say <text>` | Writes your own "working on" line. |
| `/team say` | Goes back to the automatic line. |
| `/team pause` | Stops sharing from this Mac. |
| `/team resume` | Starts sharing again. |

## What your teammates see

- Your name.
- Whether you are working or idle.
- Your project folder and git branch.
- A short AI summary of your latest request. It is made through your own Claude login. Your actual prompt is never shared.
- Your 5-hour and weekly limit percent.
- When you were active in the last 12 hours.
- Your away note, if you set one.

Never shared: your prompts, Claude's replies, your code, file paths or cost.

Kept for 7 days. `/team leave` deletes everything about you.

## If something looks wrong

**I don't see the panel or the line.**
Open a new Claude Code session. Mods load when a session starts.

**My line says the project name instead of what I'm doing.**
Send a normal request. Slash commands do not count. A greeting gives no summary.

**It says it can't reach the team server.**
Check your internet. Tell Astro if it lasts.

**I want to stop sharing.**
Type `/team pause`. To leave the team and delete your data, type `/team leave`.
