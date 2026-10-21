# Party guide

Party shows Claude Code's agents as small pixel animals in a side panel. The animals are the same species as the team avatars.

## Open the panel

Type `/party` to open or close it. Opening it also pins the panel open for every session you have open on this Mac. Closing it unpins it for those sessions.

A session only shows up if the Party mod is loaded in it. A session that was already open when you installed Party does not have it: open a new session. (After the first install, later updates only need `/reload-plugins` in an open session.) Sessions are labeled by repo or folder name.

Your current session's agents are shown first. Other sessions start folded into a row of tiny animals. Press a session's name to show or hide its agents. In the terminal, Party uses plain text instead of pictures.

The status line under the prompt gives a quick count, such as `party: 2 working, 1 needs you`. With two blocked agents it says `party: 2 working, 2 need you`. It clears when no agents are working or blocked.

## What a row shows

Each row has an animal, a status, and a short line about its work. The line comes from its current to-do step, its task description, or a phrase such as "Reading".

When an agent writes a to-do list, the thin bar shows how many steps are done. For example, `3/5` means 3 of 5 steps are done. Without a to-do list, a working row has a steady sweep, tools used, and elapsed time. Party never guesses a percentage or a finish time. With motion off, the sweep stops and the bar stays still.

Agents keep their animals and their place in the list as their status changes. Finished agents stay for five minutes. Party shows up to 12 rows per session, with a count when there are more.

## Meet the animals

| Animal | Job | Who gets it |
| --- | --- | --- |
| Ember the fox | Lead | Your session's main loop |
| Hop the rabbit | Scout | Explore agents |
| Sage the owl | Planner | Plan agents |
| Bruno the bear | Builder | General-purpose agents |
| Pan the panda | Reviewer | Agent types with "review" in their name |
| Pip the frog | Little helper | Other agent types |
| Mochi the cat | Spare | The second agent of a job |
| Biscuit the dog | Spare | The third agent of a job |
| Waddle the penguin | Spare | The fourth agent of a job |

More agents of the same job use the spare animals again with their other coats. An agent keeps its assigned animal for the life of the session.

## What the animations mean

| Status | What you see | What it means |
| --- | --- | --- |
| Idle | A slow breath and blink | Ready, with no turn in progress |
| Working | Looking around and bobbing, with a tool badge | Claude Code reports it is running |
| Blocked | A wiggle and pulsing red exclamation mark | Claude Code reports it is waiting |
| Pending | Closed eyes, a nod, and drifting Zs | It has not started yet |
| Done | A happy hop, twinkles, and a green check | Claude Code reports it completed |
| Failed | Red eyes, a tilt, and a red exclamation mark | Claude Code reports it failed |
| Stopped | A grey animal with a stop badge | Claude Code reports it was stopped |

"Blocked" does not always mean you need to act. It can mean background work, plan approval, or another agent call. The amber "needs you" count is a shortcut for this waiting status, not proof that Claude Code is asking you a question.

## Badge icons

- Magnifying glass: reading or searching, including web tools.
- Pencil: editing or writing.
- Command prompt: running a command.
- Three dots: thinking or another tool, including agent calls and to-do updates.
- Green check: done.
- Red exclamation mark: blocked or failed; read the status to tell which.
- Grey square: stopped.

## Commands

- `/party`: open or close the panel across sessions.
- `/party motion on`: turn animations on. This is the default.
- `/party motion off`: make animals, folded animals, and progress bars still.
- `/party size tiny`: 24 px animals and 16 px folded animals.
- `/party size small`: 36 px animals and 24 px folded animals. This is the default.
- `/party size medium`: 48 px animals and 32 px folded animals.
- `/party help`: list the commands.

Unknown commands show the same help. Motion and size apply immediately in the current panel and are saved for every session on this Mac. Other loaded sessions pick them up on their next refresh, usually within 3 seconds when shown or 10 seconds when hidden. Help and settings commands leave the panel open or closed as it was.

## Privacy

- Nothing leaves your Mac. Party sends no network requests.
- No prompts or replies are read or stored.
- Party uses agent IDs, types, status, task descriptions, tool kinds and counts, elapsed time, and to-do status and active step names.
- It uses session IDs and repo or folder names to group agents.
- It saves local session summaries, the panel pin, motion, and size in Claude Code's shared plugin store.
- It does not read file contents, command text, search text, or other tool arguments. From a to-do update it keeps only step status and the active step name.

## If something looks wrong

- **Agent missing:** workflow agents and teammates running in other panes are not visible in this activity feed. If Claude Code lists a teammate without activity, Party says "Reported running, activity unavailable".
- **Session missing:** that session started before Party was installed. Open a new session (or restart it). Closed sessions stop appearing after their last update becomes stale.
- **Panel empty:** no agents yet. They show up here when Claude Code starts one.
- **Stuck at Working:** the status is the engine's. Party does not guess that an agent is stuck from how long it has been quiet.
- **No progress count:** the agent has not written a to-do list. Tools and time still show activity.
- **Panel not visible:** type `/party` to open it.

## Install

From a copy of this repo, run `bash mods/party/install.sh`. It clones or updates the repo and adds Party to the plugin list in your Claude Code settings. It keeps other settings and plugin paths, and makes a backup before adding a new path to an existing settings file.

To choose another install folder, set `MURROR_PARTY_DEST` to that folder when running the installer.

Done. Open a NEW Claude Code session (an already open one will not see Party yet), then type /party.
