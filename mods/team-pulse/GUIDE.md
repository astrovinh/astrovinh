# Murror team mod

See who on the team is working in Claude Code, what they are working on, and their limits. You can also leave an away note.

## What's new (Oct 6)

Already installed? Update in two steps: run the install command below again, then type `/reload-plugins` in each Claude Code session you have open (or open a new session).

- **The team in your browser:** type `/team web` for your team's page link, open it, and type the code it shows as `/team web <code>`. That browser can see the team for 30 days, read-only, even with Claude Code closed. `/team web revoke` signs out every browser you connected.
- **The panel follows you:** type `/team` in one session and every Claude Code session you have open shows it within about 30 seconds. Close it by hand and it closes everywhere.
- **A calmer panel:** everyone keeps the same place (you first, then the order people joined), so nobody jumps around. Each row shows the 12h strip; press **More** for branch, limits and Claude activity.
- **Local clocks:** `/team clock on` shows your local time next to your name, like "VN 10:40 PM". It is off until you turn it on; `/team clock off` hides it.
- **One you across Macs:** run `/team device code` on a Mac that is already on the team, then `/team device join <code>` on the other one. Both Macs show as one row. Already joined twice? See "Using more than one Mac" below.
- **Handoffs:** `/team handoff Brian Ready for review, check step 2` leaves Brian a card with Take and Dismiss. Only you and Brian see it.
- **Waves and wins:** `/team wave Khanh` puts a small hand on your animal for 12 hours. `/team win Release notes are done` shares a small win with the team for 48 hours. `/team signals off` hides both on your Mac.
- **Work lines for every role:** the "working on" line now fits design, research, planning and ops work, not only code.

## What's new (Oct 5)

- **Animal avatars:** every teammate gets their own pixel animal in the panel, with a small dot for working, idle or offline. It stays the same if they change their name.
- **"With you right now":** the top of the panel tells you who else is working at this moment.
- **Longer away notes:** `/team status` notes can be up to 280 characters and show on several lines.
- **Your repo folder name is no longer shared.** Teammates see your git branch and what you are working on, not the folder.
- **No more duplicate names:** joining a team you are already on now tells you so instead of adding you a second time, and your open sessions keep showing up even if you rejoin. Joined twice already? Ask Astro to remove the extra name.

## What's new (Oct 4)

- **Change your name:** type `/team name` followed by the name you want, for example `/team name Brian`. Handy if you joined with a typo or with the `< >` from the old example.
- **Split view works:** type `/team` in the half where you want the panel. Use the right-hand half to keep it at the edge of the window.
- **Real activity, not just open time:** in the 12h strip, blue is active time (you sent a request or Claude was working on it) and yellow is a session left open but idle. The hours number counts active time only.
- **No more `< >` mix-ups:** joining with `<Linh>` now joins you as Linh.

## Install (2 minutes)

1. Paste this in your terminal:

```
curl -fsSL https://raw.githubusercontent.com/astrovinh/astrovinh/claude/usage-bars-mod/mods/team-pulse/install.sh | bash
```

2. Type `/reload-plugins` in a Claude Code session you have open, or open a new session. If you don't see the team line under your prompt, quit Claude Code and open it again.
3. Type `/team join` followed by the code and your name, without the `< >`. For example:

```
/team join abcd234xyz.k2m3n4p5 Linh
```

   That code is only an example. Ask Astro for the real one. Use the name your teammates know you by.

## Using more than one Mac

On a Mac that is already on the team, run `/team device code`. On the other Mac, run `/team device join <code>` with the code from that reply. It works once, for 10 minutes. Both Macs share your name, animal, away note and clock, with one row for you on the team.

Already joined twice? On the extra Mac, run `/team leave`, then `/team device join <code>` using a fresh code from the Mac you are keeping. Its old history goes away.

## Every day

| You type or see | What it does |
|---|---|
| `/team` | Opens or closes the team panel in every Claude Code session you have open (others follow within about 30 seconds). It stays open in new sessions until you close it. |
| The line under your prompt, like "Online members Ⓛ 🅜" | One circled letter per teammate who is online, the first letter of their name. A filled letter means working. An outlined letter means idle. |
| `/team name <new name>` | Changes the name your teammates see. |
| `/team status <note>` | Sets an away note that shows under your name. It stays until you clear it. |
| `/team status` | Clears your away note. |
| `/team clock` | Shows your current clock setting and how to change it. |
| `/team clock on` | Shares this Mac's time zone so teammates see your local time. |
| `/team clock off` | Hides your local clock. |
| `/team clock <IANA>` | Shares a named time zone, for example `Asia/Ho_Chi_Minh` or `America/Los_Angeles`. |
| `/team say <text>` | Writes your own "working on" line. |
| `/team say` | Goes back to the automatic line. |
| `/team web` | Gives your team page link for a browser. Open it, then type the code it shows as `/team web <code>` (works once, for 10 minutes). |
| `/team web revoke` | Signs out every browser you connected. |
| `/team pause` | Stops sharing from this Mac. |
| `/team resume` | Starts sharing again. |

## Small signals

Use `/team handoff <name> <note>` to leave a teammate something to pick up, for example `/team handoff Linh Their draft is ready for review`. Only you and the receiver see the note. It waits on their team panel until they press Take or Dismiss, or for 7 days. A small hint under their prompt tells them a handoff is waiting.

Use `/team wave <name>` to say hello. A small hand shows on your animal for 12 hours. The whole team sees the hand; the receiver also sees "waved at you" beside your name. You can wave at the same person again after 4 hours.

Use `/team win <note>` to share something that went well, for example `/team win Their research draft is ready`. The whole team sees it for 48 hours.

Use `/team signals off` to hide waves and wins on this Mac, and `/team signals on` to show them again. Handoffs addressed to you always show. There are no read receipts, reminders, counts or streaks.

## What your teammates see

- Your name.
- Whether you are working or idle.
- Your git branch, for each open session. The repo folder name is not shared.
- A short AI summary of your latest request. It is made through your own Claude login. Your actual prompt is never shared.
- Your 5-hour and weekly limit percent.
- How many Claude Code sessions you have open, and how long each has been open.
- When you were active or idle in the last 12 hours (active means you sent a request or Claude was working on it).
- The time of your last activity in each session.
- Your away note, if you set one.
- Your time zone, only if you turn it on.
- If you connect a browser: that it is connected and when its 30 days end. Opening the page never shows you as active.
- Handoff notes (only you and the receiver see them), waves and wins (the whole team sees them).

This is sent every 60 seconds while a session is open. Your own row in `/team` shows exactly what is shared about you.

Sharing covers every Claude Code session on this Mac, in any folder, including personal ones. Type `/team pause` before private work.

The person who runs the team server (Astro) can read everything it stores.

Never shared: your prompts, Claude's replies, your code, file paths, folder names, or cost.

Kept for 7 days. `/team leave` disconnects this Mac. Leaving from your last Mac deletes everything about you.

## If something looks wrong

**I don't see the panel or the line.**
Type `/reload-plugins`, or open a new Claude Code session. Mods load when a session starts or reloads.

**My line shows my branch, or says "Working in Claude Code", instead of what I'm doing.**
Send a normal request. Slash commands do not count. A greeting gives no summary.

**It says it can't reach the team server.**
Try again in a few minutes. Check your internet. Tell Astro if it lasts.

**The panel disappeared when I used split view.**
Split view makes each half narrow, and the panel only reopens by itself when there is room. Type `/team` in the half where you want it.

**I joined with the wrong name.**
Type `/team name` followed by the right name, for example `/team name Brian`.

**I joined twice by mistake.**
Follow "Using more than one Mac" above to pair the extra Mac to the name you are keeping. Use `/team name` to rename instead of joining again.

**I want to stop sharing.**
Type `/team pause`. To disconnect this Mac, type `/team leave`. Leaving from your last Mac deletes your data.

## Update or remove

To update, run the install command again.

To remove: type `/team leave` first to disconnect this Mac, then remove the `mods/team-pulse` path from `CLAUDE_CODE_PLUGIN_DIRS` in `~/.claude/settings.json` (a backup was saved next to it when you installed).
