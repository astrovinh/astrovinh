# team-pulse

A side panel showing which teammates are running Claude Code, what each session is working on, and their 5-hour and weekly limits. Open it with `/team`.

## What you share

Every 60 seconds while a session is open: the project folder name, the git branch, a one-line summary of what you are working on, whether you are working or idle, and your 5-hour and weekly limit percentages. Never your prompts, Claude's replies, code, file paths or cost. The summary is written on your Mac by a small Claude model from your latest prompt; you see each new line in a toast before teammates do.

## Install

Clone the repo, then add `mods/team-pulse` to Claude Code's plugin folders (the same way `mods/usage-bars/install.sh` does) and reopen the app.

## Commands

- `/team create <team> <your name>`: start a team; you get a join code to share
- `/team`: open or close the panel
- `/team join <code> <your name>`: join with the code your admin shares
- `/team pause` and `/team resume`: stop and restart sharing on this Mac
- `/team say <text>`: set your line yourself; `/team say` alone goes back to automatic lines
- `/team leave`: leave the team and delete your shared data
