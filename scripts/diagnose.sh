#!/bin/bash
# BDR Copilot — tell Jack what's broken
# Open Terminal (Cmd+Space, type Terminal, hit Enter)
# Paste this and hit Enter:
#   curl -sL https://raw.githubusercontent.com/c3-jack/bdr-copilot/main/scripts/diagnose.sh | bash
# Copy everything it prints and Slack it to Jack.

echo ""
echo "=== BDR Copilot Health Check ==="
echo ""
echo "Mac: $(sw_vers -productVersion) ($(uname -m))"
echo "User: $(whoami)"

# App
if [ -d "/Applications/BDR Copilot.app" ]; then
  echo "App: installed"
  # Check asar vs unpacked
  if [ -f "/Applications/BDR Copilot.app/Contents/Resources/app.asar" ]; then
    echo "Packaging: asar (OLD BUILD — needs update)"
  elif [ -d "/Applications/BDR Copilot.app/Contents/Resources/app" ]; then
    echo "Packaging: unpacked (good)"
  fi
  if [ -f "/Applications/BDR Copilot.app/Contents/Resources/app/dist/server/index.js" ]; then
    echo "Server bundle: OK"
  else
    echo "Server bundle: MISSING"
  fi
  QFLAG=$(xattr "/Applications/BDR Copilot.app" 2>/dev/null | grep -c quarantine)
  [ "$QFLAG" -gt 0 ] && echo "Gatekeeper: QUARANTINED" || echo "Gatekeeper: clear"
else
  echo "App: NOT INSTALLED"
fi

# Node
if command -v node &>/dev/null; then
  echo "Node: $(node --version) ($(which node))"
else
  echo "Node: MISSING"
fi
for p in /usr/local/bin/node /opt/homebrew/bin/node; do
  [ -f "$p" ] && echo "  found: $p"
done
[ -d "$HOME/.nvm" ] && echo "  nvm: installed ($(ls $HOME/.nvm/versions/node/ 2>/dev/null | tail -1))"
[ -d "$HOME/.fnm" ] && echo "  fnm: installed"

# Brew
if [ -f /opt/homebrew/bin/brew ] || [ -f /usr/local/bin/brew ]; then
  echo "Brew: installed"
else
  echo "Brew: MISSING"
fi

# Claude
if command -v claude &>/dev/null; then
  echo "Claude CLI: $(claude --version 2>&1 | head -1)"
  AUTH=$(claude --print "say OK" 2>&1 | head -1)
  echo "$AUTH" | grep -qi "ok" && echo "Claude auth: signed in" || echo "Claude auth: NOT SIGNED IN"
else
  echo "Claude CLI: MISSING"
fi

# Dataverse MCP
[ -f "$HOME/c3ai-dataverse-mcp/c3ai-dataverse-mcp" ] && echo "Dataverse MCP: installed" || echo "Dataverse MCP: not installed"
[ -f "$HOME/.claude.json" ] && grep -q "c3ai-dataverse" "$HOME/.claude.json" 2>/dev/null && echo "MCP config: registered" || echo "MCP config: not registered"

# Launch log — the money shot
echo ""
echo "=== LAUNCH LOG ==="
if [ -f "$HOME/.bdr-copilot/launch.log" ]; then
  cat "$HOME/.bdr-copilot/launch.log"
else
  echo "(no launch.log — app hasn't been opened with the new build yet)"
fi

echo ""
echo "=== Copy EVERYTHING above and send to Jack ==="
echo ""
