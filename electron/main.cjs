const { app, BrowserWindow, dialog, shell } = require('electron');
const { execFile, spawn } = require('child_process');
const path = require('path');
const net = require('net');

let mainWindow = null;
let serverProcess = null;

function getFreePorts() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, () => {
      const port = srv.address().port;
      srv.close(() => resolve(port));
    });
    srv.on('error', reject);
  });
}

function findClaudeBinary() {
  const { execFileSync } = require('child_process');
  const fs = require('fs');
  try {
    return execFileSync('/usr/bin/env', ['which', 'claude'], {
      encoding: 'utf-8',
      env: { ...process.env, PATH: getShellPath() },
    }).trim();
  } catch {
    const candidates = [
      '/usr/local/bin/claude',
      '/opt/homebrew/bin/claude',
      path.join(process.env.HOME || '', '.npm-global/bin/claude'),
      path.join(process.env.HOME || '', '.claude/local/claude'),
    ];
    for (const c of candidates) {
      if (fs.existsSync(c)) return c;
    }
    return 'claude';
  }
}

function getShellPath() {
  // Electron doesn't inherit the user's shell PATH. Reconstruct it.
  const base = process.env.PATH || '';
  const extras = [
    '/usr/local/bin',
    '/opt/homebrew/bin',
    path.join(process.env.HOME || '', '.local/bin'),
    path.join(process.env.HOME || '', '.npm-global/bin'),
    path.join(process.env.HOME || '', '.claude/local'),
  ];
  const parts = new Set(base.split(':').concat(extras));
  return [...parts].join(':');
}

// Check if Claude CLI is installed and authenticated
function checkClaude() {
  const claudePath = findClaudeBinary();
  const envWithPath = { ...process.env, PATH: getShellPath() };
  return new Promise((resolve) => {
    execFile(claudePath, ['--version'], { timeout: 5000, env: envWithPath }, (err, stdout) => {
      if (err) {
        resolve({ installed: false, authenticated: false });
        return;
      }
      const version = stdout.trim();

      execFile(claudePath, ['--print', 'respond with OK'], { timeout: 15000, env: envWithPath }, (authErr) => {
        if (authErr) {
          resolve({ installed: true, authenticated: false, version });
          return;
        }
        resolve({ installed: true, authenticated: true, version });
      });
    });
  });
}

function createAuthWindow() {
  const win = new BrowserWindow({
    width: 520,
    height: 420,
    resizable: false,
    titleBarStyle: 'hiddenInset',
    webPreferences: { nodeIntegration: false, contextIsolation: true },
  });

  const html = `<!DOCTYPE html>
<html>
<head>
  <style>
    body {
      margin: 0; padding: 40px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #0a0a0f; color: #e2e8f0;
      -webkit-app-region: drag;
    }
    h1 { font-size: 22px; margin-bottom: 8px; }
    .subtitle { color: #94a3b8; font-size: 14px; margin-bottom: 32px; }
    .step {
      background: #1e293b; border-radius: 8px; padding: 16px;
      margin-bottom: 12px; font-size: 14px;
    }
    .step-num {
      display: inline-block; width: 24px; height: 24px;
      background: #3b82f6; border-radius: 50%; text-align: center;
      line-height: 24px; font-size: 12px; font-weight: bold;
      margin-right: 10px; -webkit-app-region: no-drag;
    }
    code {
      background: #0f172a; padding: 2px 6px; border-radius: 4px;
      font-family: 'SF Mono', Monaco, monospace; font-size: 13px;
      color: #60a5fa;
    }
    .retry {
      margin-top: 24px; padding: 10px 20px;
      background: #3b82f6; color: white; border: none;
      border-radius: 6px; font-size: 14px; cursor: pointer;
      -webkit-app-region: no-drag;
    }
    .retry:hover { background: #2563eb; }
    .status { margin-top: 16px; font-size: 13px; color: #94a3b8; }
    .error { color: #f87171; }
  </style>
</head>
<body>
  <h1>Claude Setup Required</h1>
  <p class="subtitle">BDR Copilot uses your Claude Code subscription. Let's get it connected.</p>
  <div class="step"><span class="step-num">1</span> Open Terminal and run: <code>claude</code></div>
  <div class="step"><span class="step-num">2</span> Follow the prompts to sign in with your Anthropic account</div>
  <div class="step"><span class="step-num">3</span> Once signed in, click Retry below</div>
  <button class="retry" id="retry">Retry Connection</button>
  <div class="status" id="status"></div>
  <script>
    document.getElementById('retry').addEventListener('click', () => {
      document.getElementById('status').textContent = 'Checking...';
      document.getElementById('status').className = 'status';
      window.location.hash = 'retry-' + Date.now();
    });
  </script>
</body>
</html>`;

  win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
  return win;
}

function showAuthFlow() {
  return new Promise((resolve) => {
    const authWin = createAuthWindow();

    authWin.webContents.on('did-navigate-in-page', async () => {
      const url = authWin.webContents.getURL();
      if (url.includes('retry')) {
        const result = await checkClaude();
        if (result.authenticated) {
          authWin.close();
          resolve(true);
        } else if (!result.installed) {
          authWin.webContents.executeJavaScript(
            `document.getElementById('status').textContent = 'Claude CLI not found. Install from claude.ai/download';
             document.getElementById('status').className = 'status error';`
          );
        } else {
          authWin.webContents.executeJavaScript(
            `document.getElementById('status').textContent = 'Claude installed but not signed in. Run "claude" in Terminal first.';
             document.getElementById('status').className = 'status error';`
          );
        }
      }
    });

    authWin.on('closed', () => resolve(false));
  });
}

async function startBackendServer(port) {
  const serverScript = path.join(__dirname, '..', 'dist', 'server', 'index.js');

  // Find the real node binary (not Electron's)
  const nodePath = process.env.NODE_PATH_OVERRIDE || findNodeBinary();

  return new Promise((resolve, reject) => {
    serverProcess = spawn(nodePath, [serverScript], {
      env: { ...process.env, PORT: String(port), BDR_ELECTRON: '1', PATH: getShellPath() },
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: path.join(__dirname, '..'),
    });

    let started = false;

    serverProcess.stdout.on('data', (data) => {
      const msg = data.toString();
      if (msg.includes('running on') && !started) {
        started = true;
        resolve(port);
      }
    });

    serverProcess.stderr.on('data', (data) => {
      const msg = data.toString();
      if (!started && msg.includes('Error')) {
        reject(new Error(msg));
      }
    });

    serverProcess.on('error', (err) => {
      if (!started) reject(err);
    });

    serverProcess.on('exit', (code) => {
      if (!started) reject(new Error(`Server exited with code ${code}`));
    });

    // Timeout — fall back to health check
    setTimeout(() => {
      if (!started) {
        const http = require('http');
        http.get(`http://localhost:${port}/api/health`, (res) => {
          if (res.statusCode === 200 && !started) {
            started = true;
            resolve(port);
          }
        }).on('error', () => {
          if (!started) reject(new Error('Server failed to start within 15 seconds'));
        });
      }
    }, 12000);
  });
}

function findNodeBinary() {
  // Electron's process.execPath points to Electron, not Node.
  // Try common locations.
  const { execFileSync } = require('child_process');
  try {
    return execFileSync('which', ['node'], { encoding: 'utf-8' }).trim();
  } catch {
    // Fallback common paths
    const fs = require('fs');
    const candidates = [
      '/usr/local/bin/node',
      '/opt/homebrew/bin/node',
      path.join(process.env.HOME || '', '.nvm/versions/node', 'current', 'bin', 'node'),
      path.join(process.env.HOME || '', '.fnm/current/bin/node'),
    ];
    for (const c of candidates) {
      if (fs.existsSync(c)) return c;
    }
    return 'node'; // hope it's in PATH
  }
}

function createMainWindow(port) {
  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 900,
    minHeight: 600,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 16 },
    icon: path.join(__dirname, '..', 'assets', 'icon.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  win.loadURL(`http://localhost:${port}`);

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  return win;
}

function ensureMcps() {
  // Auto-install MCP servers on first run (non-blocking, best-effort)
  const claudePath = findClaudeBinary();
  const envWithPath = { ...process.env, PATH: getShellPath() };

  const mcps = [
    { name: 'microsoft365', args: ['mcp', 'add', '--transport', 'http', '-s', 'user', 'microsoft365', 'https://microsoft365.mcp.claude.com/mcp'] },
    { name: 'atlassian', args: ['mcp', 'add', '--transport', 'http', '-s', 'user', 'atlassian', 'https://mcp.atlassian.com/v1/mcp'] },
    { name: 'github', args: ['mcp', 'add', '-s', 'user', 'github', '--', 'npx', '-y', '@modelcontextprotocol/server-github'] },
  ];

  for (const mcp of mcps) {
    try {
      execFile(claudePath, mcp.args, { timeout: 15000, env: envWithPath }, () => {});
    } catch {
      // Already exists or failed — either way, move on
    }
  }
}

app.whenReady().then(async () => {
  // Step 1: Check Claude auth + install MCPs (non-blocking)
  checkClaude().then(result => {
    if (result.authenticated) {
      // MCPs only work if Claude is authenticated
      ensureMcps();
    }
    if (!result.authenticated && mainWindow) {
      mainWindow.webContents.executeJavaScript(`
        if (!document.getElementById('claude-warn')) {
          const d = document.createElement('div');
          d.id = 'claude-warn';
          d.style.cssText = 'position:fixed;top:0;left:0;right:0;padding:8px 16px;background:#92400e;color:#fef3c7;font-size:13px;text-align:center;z-index:9999;font-family:system-ui';
          d.textContent = 'Claude CLI not authenticated. Run "claude" in Terminal to sign in, then restart the app.';
          document.body.prepend(d);
        }
      `);
    }
  });

  // Step 2: Start Express backend
  let port;
  try {
    port = await getFreePorts();
    await startBackendServer(port);
  } catch (err) {
    dialog.showErrorBox('Server Error', `Failed to start BDR Copilot server:\n${err.message}`);
    app.quit();
    return;
  }

  // Step 3: Open main window
  mainWindow = createMainWindow(port);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
});

app.on('window-all-closed', () => {
  if (serverProcess) serverProcess.kill();
  app.quit();
});

app.on('activate', () => {
  if (!mainWindow && serverProcess) {
    mainWindow = createMainWindow(serverProcess.port);
  }
});
