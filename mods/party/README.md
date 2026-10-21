# Party

A local Claude Code panel that shows your agents as small pixel animals, using the same species as the team avatars. It groups sessions by repo or folder and shows the engine's status, tool counts, elapsed time, and real to-do progress.

Run `bash mods/party/install.sh` from this repo. Then type `/reload-plugins` in each open session, or start a new one, and type `/party`. The mod must be loaded in each session you want to see. `/party` also pins the panel open across your open sessions.

Use `/party motion on|off` for animated or still pictures and bars, `/party size tiny|small|medium` for 24/36/48 px animals, and `/party help` for commands. Folded animals scale with the chosen size. Motion is on and size is small by default; settings are saved across sessions.

Nothing leaves your Mac. No prompts or replies are read or stored. A to-do list supplies the step count. Without one, Party shows activity without guessing a percentage.

See [GUIDE.md](GUIDE.md) for the animals, seven states, badge icons, privacy details, and help when something looks wrong.
