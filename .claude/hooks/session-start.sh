#!/bin/bash
set -euo pipefail

# Only run in Claude Code remote (web) sessions
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

echo "==> Setting up vibe coding environment..."

# ── Node.js ──────────────────────────────────────────────────────────────────
if command -v node &>/dev/null; then
  echo "✓ Node.js $(node --version) already installed"
else
  echo "==> Installing Node.js..."
  curl -fsSL https://deb.nodesource.com/setup_lts.x | bash -
  apt-get install -y nodejs
fi

# ── Git ───────────────────────────────────────────────────────────────────────
if command -v git &>/dev/null; then
  echo "✓ Git $(git --version) already installed"
else
  echo "==> Installing Git..."
  apt-get install -y git
fi

# ── Watchman ──────────────────────────────────────────────────────────────────
if command -v watchman &>/dev/null; then
  echo "✓ Watchman $(watchman --version) already installed"
else
  echo "==> Installing Watchman..."
  apt-get install -y watchman
fi

echo "==> Vibe coding environment ready!"
