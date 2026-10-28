# Party

A local Claude Code panel that shows your agents as small pixel animals, using the same species as the team avatars. It groups sessions by repo or folder and shows the engine's status, tool counts, elapsed time, and real to-do progress.

Quiet means no activity for 10 minutes. Party folds these agents into one quiet line in their session; they come back by themselves when the agent does something. Waiting agents stay visible, and your current session's main agent always stays visible.

Run `bash mods/party/install.sh` from this repo. Then open a new Claude Code session and type `/party` (an already open session will not see a newly installed mod; later updates only need `/reload-plugins`). The mod must be loaded in each session you want to see. `/party` also pins the panel open across your open sessions.

Use `/party motion on|off` for animated or still pictures and bars, `/party size tiny|small|medium` for 24/36/48 px animals, and `/party help` for commands. Folded animals scale with the chosen size. Motion is on and size is small by default; settings are saved across sessions.

Nothing leaves your Mac. No prompts or replies are stored. A to-do list supplies the step count. Without one, Party shows activity without guessing a percentage.

See [GUIDE.md](GUIDE.md) for the animals, seven states, badge icons, privacy details, and help when something looks wrong.

## Codex runs

Party shows local Codex runs under a Codex header, with a small `>_` badge. Helpers nest below their run. Rows show commands and elapsed time, with no guessed percentage. A completed run adds a "ready for review" notice until your next message in this session. Slash commands leave the notice in place. Finished rows stay for five minutes.

The scanner reads local Codex session logs and keeps only counts, times, IDs, roles, nicknames, and a brief label. It checks the first user message only for a brief filename. Messages, command text, code, and log paths are never displayed or saved. Nothing leaves your Mac. The local cache contains only these run facts and numeric or hashed file markers.

Codex is on by default. Use `/party codex off` to hide it, or `/party codex on` to show it again. This setting applies to all Party sessions.
