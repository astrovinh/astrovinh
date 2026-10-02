#!/usr/bin/env bash
# Installs the usage-bars mod for the Claude Code desktop app (Mac/Linux).
set -euo pipefail

REPO="https://github.com/astrovinh/astrovinh"
BRANCH="claude/usage-bars-mod"
DEST="${USAGE_BARS_DEST:-$HOME/astrovinh}"
MOD="$DEST/mods/usage-bars"
SETTINGS="$HOME/.claude/settings.json"

if [ -d "$DEST/.git" ]; then
  git -C "$DEST" fetch origin "$BRANCH"
  git -C "$DEST" checkout "$BRANCH"
  git -C "$DEST" pull --ff-only origin "$BRANCH"
else
  git clone --branch "$BRANCH" "$REPO" "$DEST"
fi

mkdir -p "$HOME/.claude"
[ -f "$SETTINGS" ] && cp "$SETTINGS" "$SETTINGS.bak"

python3 - "$SETTINGS" "$MOD" <<'PY'
import json, os, sys
path, mod = sys.argv[1], sys.argv[2]
data = {}
if os.path.exists(path) and os.path.getsize(path):
    with open(path) as f:
        data = json.load(f)
env = data.setdefault("env", {})
dirs = [d for d in env.get("CLAUDE_CODE_PLUGIN_DIRS", "").split(os.pathsep) if d]
if mod not in dirs:
    dirs.append(mod)
env["CLAUDE_CODE_PLUGIN_DIRS"] = os.pathsep.join(dirs)
with open(path, "w") as f:
    json.dump(data, f, indent=2)
    f.write("\n")
PY

echo "Done. Quit and reopen the Claude Code desktop app, then start a new LOCAL session."
echo "Mod: $MOD"
