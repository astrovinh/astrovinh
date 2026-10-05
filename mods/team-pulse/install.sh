#!/usr/bin/env bash
# Installs the Murror team mod for Claude Code (Mac/Linux).
set -euo pipefail

git --version >/dev/null 2>&1 || { echo "This installer needs git. Install it (on a Mac: xcode-select --install), then run this again." >&2; exit 1; }
python3 --version >/dev/null 2>&1 || { echo "This installer needs python3. Install it (on a Mac: xcode-select --install), then run this again." >&2; exit 1; }

# Everything lives in main so a truncated download (curl | bash) runs nothing.
main() {
  local REPO="https://github.com/astrovinh/astrovinh"
  local BRANCH="claude/usage-bars-mod"
  local DEST="${MURROR_TEAM_DEST:-$HOME/astrovinh}"
  case "$DEST" in /*) ;; *) DEST="$PWD/$DEST" ;; esac
  local MOD="$DEST/mods/team-pulse"
  local SETTINGS="$HOME/.claude/settings.json"

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

  # Back up only when the setting is about to change.
  if [ -f "$SETTINGS" ] && ! python3 - "$SETTINGS" "$MOD" <<'PY'
import json, os, sys
path, mod = sys.argv[1], sys.argv[2]
try:
    with open(path) as f:
        data = json.load(f)
    dirs = data.get("env", {}).get("CLAUDE_CODE_PLUGIN_DIRS", "").split(os.pathsep)
except Exception:
    sys.exit(1)
sys.exit(0 if mod in dirs else 1)
PY
  then
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
  echo "  1. Open a NEW Claude Code session (if the team line does not appear, quit Claude Code and open it again)."
  echo "  2. Type: /team join followed by the code and your name (ask Astro for the code)"
  echo "Guide: $MOD/GUIDE.md"
}

main "$@"
