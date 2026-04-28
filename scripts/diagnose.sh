#!/bin/bash
# BDR Copilot — tell Jack what's broken
# Open Terminal (Cmd+Space, type Terminal, hit Enter)
# Then paste this and hit Enter:
#   curl -sL https://raw.githubusercontent.com/c3-jack/bdr-copilot/main/scripts/diagnose.sh | bash
# Copy everything it prints and Slack it to Jack.

echo ""
echo "=== BDR Copilot Health Check ==="
echo ""

# System
echo "Mac: $(sw_vers -productVersion) ($(uname -m))"

# App installed?
if [ -d "/Applications/BDR Copilot.app" ]; then
  echo "App: installed"
else
  echo "App: NOT INSTALLED — download from GitHub release"
fi

# Node
if command -v node &>/dev/null; then
  echo "Node: $(node --version) ($(which node))"
else
  echo "Node: MISSING"
fi

# Homebrew
if command -v brew &>/dev/null || [ -f /opt/homebrew/bin/brew ] || [ -f /usr/local/bin/brew ]; then
  echo "Brew: installed"
else
  echo "Brew: MISSING"
fi

# Claude CLI
if command -v claude &>/dev/null; then
  CLAUDE_VER=$(claude --version 2>&1 | head -1)
  echo "Claude CLI: $CLAUDE_VER"

  # Auth check
  AUTH_OUT=$(claude --print "say OK" 2>&1)
  if echo "$AUTH_OUT" | grep -qi "ok"; then
    echo "Claude auth: signed in"
  else
    echo "Claude auth: NOT SIGNED IN — run 'claude' in Terminal and log in"
  fi
else
  # Check common locations the shell might miss
  for p in /usr/local/bin/claude /opt/homebrew/bin/claude "$HOME/.claude/local/claude"; do
    if [ -f "$p" ]; then
      echo "Claude CLI: found at $p but not in PATH"
      break
    fi
  done
  if ! [ -f /usr/local/bin/claude ] && ! [ -f /opt/homebrew/bin/claude ] && ! [ -f "$HOME/.claude/local/claude" ]; then
    echo "Claude CLI: MISSING — install from claude.ai/download"
  fi
fi

# Dataverse MCP
if [ -f "$HOME/c3ai-dataverse-mcp/c3ai-dataverse-mcp" ]; then
  echo "Dataverse MCP: installed"
else
  echo "Dataverse MCP: not installed (will auto-install on app launch)"
fi

# MCP config
if [ -f "$HOME/.claude.json" ]; then
  if grep -q "c3ai-dataverse" "$HOME/.claude.json" 2>/dev/null; then
    echo "MCP config: dataverse registered"
  else
    echo "MCP config: dataverse NOT registered"
  fi
else
  echo "MCP config: no ~/.claude.json"
fi

# Check if server can start
if [ -f "/Applications/BDR Copilot.app/Contents/Resources/app/dist/server/index.js" ]; then
  echo "Server bundle: present"
else
  echo "Server bundle: MISSING — app may be corrupted, re-download"
fi

# Quarantine flag
if [ -d "/Applications/BDR Copilot.app" ]; then
  QFLAG=$(xattr "/Applications/BDR Copilot.app" 2>/dev/null | grep -c quarantine)
  if [ "$QFLAG" -gt 0 ]; then
    echo "Gatekeeper: QUARANTINED — run: xattr -cr /Applications/BDR\\ Copilot.app"
  else
    echo "Gatekeeper: clear"
  fi
fi

echo ""
echo "=== Copy everything above and send to Jack ==="
echo ""
