# murror (team presence mod)

A side panel showing which teammates are running Claude Code, what each session is working on, and their 5-hour and weekly limits. Open it with `/team`.

## What you share

While a session is open, every 60 seconds, your team pulse mod shares this with everyone on your team (the person who runs the team server can also read everything it stores):

- your name, and whether you are working or idle
- the project folder name and git branch of each open session
- a one-line summary of what you are working on
- your 5-hour and weekly Claude limit percentages
- how many sessions you have open, how long each has been open, and when you were active over the last 12 hours

The summary is made from your latest prompt by a small Claude model, called through your own Claude login, the same way your prompts already reach Claude. The prompt itself is never sent to the team server. Your current summary is always shown under your prompt, after your teammates' names; `/team say <text>` replaces it with your own words, and `/team pause` stops sharing.

Never shared: your prompts, Claude's replies, code, file paths beyond the folder name, or cost.

The team server keeps activity for 7 days. `/team leave` deletes everything about you right away.

## Install

Clone the repo, then add `mods/team-pulse` to Claude Code's plugin folders (the same way `mods/usage-bars/install.sh` does) and reopen the app.

## Commands

- `/team create <team> <your name>`: start a team; you get a join code to share
- `/team`: open or close the panel; it reopens in new sessions until you close it
- `/team join <code> <your name>`: join with the code your admin shares
- `/team pause` and `/team resume`: stop and restart sharing on this Mac
- `/team say <text>`: set your line yourself; `/team say` alone goes back to automatic lines
- `/team leave`: leave the team and delete your shared data
