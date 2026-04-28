#!/bin/bash
# BDR Copilot — Diagnostic Script
# Run this in Terminal: bash ~/Downloads/diagnose.sh
# Then paste the output to Jack

echo "=============================="
echo " BDR Copilot Diagnostics"
echo "=============================="
echo ""

echo "--- System ---"
echo "macOS: $(sw_vers -productVersion)"
echo "Arch: $(uname -m)"
echo "User: $(whoami)"
echo "Home: $HOME"
echo ""

echo "--- Node.js ---"
echo "which node: $(which node 2>&1)"
echo "node path type: $(file "$(which node 2>/dev/null)" 2>&1)"
NODE_VERSION=$(node --version 2>&1)
echo "node --version: $NODE_VERSION"
echo ""

echo "--- Node install method ---"
# Check common install locations
for p in /usr/local/bin/node /opt/homebrew/bin/node; do
  [ -f "$p" ] && echo "FOUND: $p ($(file "$p"))" || echo "NOT FOUND: $p"
done

# NVM
if [ -d "$HOME/.nvm" ]; then
  echo "NVM dir: EXISTS"
  NVM_VERSIONS=$(ls "$HOME/.nvm/versions/node/" 2>/dev/null)
  echo "NVM versions: $NVM_VERSIONS"
  [ -f "$HOME/.nvm/versions/node/${NVM_VERSIONS##*$'\n'}/bin/node" ] && echo "NVM node binary: FOUND"
else
  echo "NVM: NOT INSTALLED"
fi

# fnm
if [ -d "$HOME/.fnm" ] || [ -d "$HOME/Library/Application Support/fnm" ]; then
  echo "fnm: EXISTS"
  ls "$HOME/.fnm/current/bin/node" 2>/dev/null && echo "fnm node binary: FOUND"
  ls "$HOME/Library/Application Support/fnm/current/bin/node" 2>/dev/null && echo "fnm node binary (alt): FOUND"
else
  echo "fnm: NOT INSTALLED"
fi

# Volta
if [ -d "$HOME/.volta" ]; then
  echo "Volta: EXISTS"
  [ -f "$HOME/.volta/bin/node" ] && echo "Volta node binary: FOUND"
else
  echo "Volta: NOT INSTALLED"
fi
echo ""

echo "--- Homebrew ---"
BREW_PATH=$(which brew 2>&1)
echo "which brew: $BREW_PATH"
[ -f /opt/homebrew/bin/brew ] && echo "/opt/homebrew/bin/brew: EXISTS" || echo "/opt/homebrew/bin/brew: NOT FOUND"
[ -f /usr/local/bin/brew ] && echo "/usr/local/bin/brew: EXISTS" || echo "/usr/local/bin/brew: NOT FOUND"
echo ""

echo "--- Claude CLI ---"
CLAUDE_PATH=$(which claude 2>&1)
echo "which claude: $CLAUDE_PATH"
for p in /usr/local/bin/claude /opt/homebrew/bin/claude "$HOME/.claude/local/claude" "$HOME/.npm-global/bin/claude"; do
  [ -f "$p" ] && echo "FOUND: $p"
done
echo ""

echo "--- Dataverse MCP ---"
[ -f "$HOME/c3ai-dataverse-mcp/c3ai-dataverse-mcp" ] && echo "Binary: FOUND" || echo "Binary: NOT FOUND"
echo ""

echo "--- PATH ---"
echo "$PATH" | tr ':' '\n'
echo ""

echo "--- BDR Copilot App ---"
APP_PATH="/Applications/BDR Copilot.app"
[ -d "$APP_PATH" ] && echo "App: INSTALLED" || echo "App: NOT INSTALLED"
[ -f "$APP_PATH/Contents/Resources/app/dist/server/index.js" ] && echo "Server bundle: FOUND" || echo "Server bundle: NOT FOUND"
echo ""

echo "=============================="
echo " Done — paste everything above"
echo "=============================="
