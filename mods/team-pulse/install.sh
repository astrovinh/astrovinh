#!/usr/bin/env bash
# Installs the Murror team mod for Claude Code (Mac/Linux).
set -euo pipefail

REPO="https://github.com/astrovinh/astrovinh"
BRANCH="claude/usage-bars-mod"
DEST="${MURROR_TEAM_DEST:-$HOME/astrovinh}"
MOD="$DEST/mods/team-pulse"
SETTINGS="$HOME/.claude/settings.json"

if [ -d "$DEST/.git" ]; then
  git -C "$DEST" fetch origin "$BRANCH"
  git -C "$DEST" checkout "$BRANCH"
  git -C "$DEST" pull --ff-only origin "$BRANCH"
elif [ -e "$DEST" ]; then
  echo "$DEST already exists and is not the astrovinh repo. Move it aside or set MURROR_TEAM_DEST=/another/path, then run this again."
  exit 1
else
  git clone --branch "$BRANCH" "$REPO" "$DEST"
fi

mkdir -p "$HOME/.claude"
if [ -f "$SETTINGS" ]; then
  cp "$SETTINGS" "$SETTINGS.before-murror-team-$(date +%Y%m%d-%H%M%S)"
fi

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

echo "Done. The Murror team mod is installed."
echo "Next:"
echo "  1. Open a NEW Claude Code session (sessions that are already open keep running without it)."
echo "  2. Type: /team join <code> <your name>   (ask Astro for the code)"
echo "Guide: $MOD/GUIDE.md"
