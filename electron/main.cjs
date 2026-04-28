const { app, BrowserWindow, dialog, shell } = require('electron');
const { execFile, spawn } = require('child_process');
const path = require('path');
const net = require('net');
const fs = require('fs');
const os = require('os');

let mainWindow = null;
let serverProcess = null;
let serverPort = null;

// Log everything to ~/.bdr-copilot/launch.log so we can debug remote installs
const LOG_DIR = path.join(os.homedir(), '.bdr-copilot');
const LOG_PATH = path.join(LOG_DIR, 'launch.log');
try { fs.mkdirSync(LOG_DIR, { recursive: true }); } catch {}
// Truncate on each launch — only care about the latest run
try { fs.writeFileSync(LOG_PATH, `=== BDR Copilot launch ${new Date().toISOString()} ===\n`); } catch {}

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  try { fs.appendFileSync(LOG_PATH, line + '\n'); } catch {}
}

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
  // Electron doesn't inherit the user's shell PATH.
  // Get the real PATH by asking the user's login shell.
  const { execFileSync } = require('child_process');
  const fs = require('fs');
  const home = process.env.HOME || '';

  let shellPath = '';
  try {
    const shell = process.env.SHELL || '/bin/zsh';
    shellPath = execFileSync(shell, ['-lc', 'echo $PATH'], {
      encoding: 'utf-8',
      timeout: 5000,
      env: { ...process.env, HOME: home },
    }).trim();
  } catch {}

  // Merge with Electron's PATH and common extras as fallback
  const base = process.env.PATH || '';
  const extras = [
    '/usr/local/bin',
    '/opt/homebrew/bin',
    path.join(home, '.local/bin'),
    path.join(home, '.npm-global/bin'),
    path.join(home, '.claude/local'),
    path.join(home, '.volta/bin'),
  ];

  // NVM: add the latest installed version's bin to PATH
  const nvmDir = path.join(home, '.nvm/versions/node');
  if (fs.existsSync(nvmDir)) {
    try {
      const versions = fs.readdirSync(nvmDir).filter(v => v.startsWith('v')).sort().reverse();
      if (versions.length > 0) extras.push(path.join(nvmDir, versions[0], 'bin'));
    } catch {}
  }
  // fnm
  const fnmCurrent = path.join(home, '.fnm/current/bin');
  if (fs.existsSync(fnmCurrent)) extras.push(fnmCurrent);

  const parts = new Set([
    ...shellPath.split(':').filter(Boolean),
    ...base.split(':').filter(Boolean),
    ...extras,
  ]);
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
  const resolvedPath = getShellPath();
  const cwd = path.join(__dirname, '..');

  log(`__dirname: ${__dirname}`);
  log(`serverScript: ${serverScript}`);
  log(`serverScript exists: ${fs.existsSync(serverScript)}`);
  log(`nodePath: ${nodePath}`);
  log(`nodePath exists: ${fs.existsSync(nodePath)}`);
  log(`cwd: ${cwd}`);
  log(`cwd exists: ${fs.existsSync(cwd)}`);
  log(`cwd isDir: ${fs.existsSync(cwd) && fs.statSync(cwd).isDirectory()}`);
  log(`port: ${port}`);

  // Validate the node binary before trying to spawn
  if (!fs.existsSync(nodePath)) {
    const msg = `Node binary not found at: ${nodePath}\nFix: open Terminal and run: brew install node`;
    log(`FATAL: ${msg}`);
    throw new Error(msg);
  }

  return new Promise((resolve, reject) => {
    log(`spawning: ${nodePath} ${serverScript}`);
    serverProcess = spawn(nodePath, [serverScript], {
      env: { ...process.env, PORT: String(port), BDR_ELECTRON: '1', PATH: resolvedPath },
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd,
    });

    let started = false;

    serverProcess.stdout.on('data', (data) => {
      const msg = data.toString();
      log(`stdout: ${msg.trim()}`);
      if (msg.includes('running on') && !started) {
        started = true;
        resolve(port);
      }
    });

    serverProcess.stderr.on('data', (data) => {
      const msg = data.toString();
      log(`stderr: ${msg.trim()}`);
      if (!started && msg.includes('Error')) {
        reject(new Error(msg));
      }
    });

    serverProcess.on('error', (err) => {
      log(`spawn error: ${err.message} (code: ${err.code})`);
      if (!started) reject(new Error(
        `spawn error: ${err.message}\n` +
        `Node path: ${nodePath}\n` +
        `Server script: ${serverScript}\n` +
        `cwd: ${cwd}\n` +
        `Fix: open Terminal and run: brew install node`
      ));
    });

    serverProcess.on('exit', (code, signal) => {
      log(`server exited: code=${code} signal=${signal}`);
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
  // Try common locations using the reconstructed shell PATH.
  const { execFileSync } = require('child_process');
  const fs = require('fs');
  const envWithPath = { ...process.env, PATH: getShellPath() };
  try {
    return execFileSync('/usr/bin/env', ['which', 'node'], {
      encoding: 'utf-8',
      env: envWithPath,
    }).trim();
  } catch {
    // Fallback: check common paths + NVM/fnm version dirs
    const home = process.env.HOME || '';
    const candidates = [
      '/usr/local/bin/node',
      '/opt/homebrew/bin/node',
    ];

    // NVM: find the default or latest installed version
    const nvmDir = path.join(home, '.nvm/versions/node');
    if (fs.existsSync(nvmDir)) {
      try {
        const versions = fs.readdirSync(nvmDir).filter(v => v.startsWith('v')).sort().reverse();
        if (versions.length > 0) {
          candidates.unshift(path.join(nvmDir, versions[0], 'bin', 'node'));
        }
      } catch {}
    }

    // fnm
    candidates.push(path.join(home, '.fnm/current/bin/node'));
    // Volta
    candidates.push(path.join(home, '.volta/bin/node'));

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

function hasBrew() {
  const fs = require('fs');
  const candidates = ['/opt/homebrew/bin/brew', '/usr/local/bin/brew'];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return null;
}

function hasNode() {
  const nodePath = findNodeBinary();
  if (nodePath === 'node') return false; // fallback means not found
  const fs = require('fs');
  return fs.existsSync(nodePath);
}

function createSetupWindow() {
  const win = new BrowserWindow({
    width: 560,
    height: 520,
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
    .subtitle { color: #94a3b8; font-size: 14px; margin-bottom: 24px; }
    .step {
      background: #1e293b; border-radius: 8px; padding: 16px;
      margin-bottom: 12px; font-size: 14px;
      display: flex; align-items: center; gap: 12px;
    }
    .step-icon { font-size: 20px; flex-shrink: 0; }
    .step-text { flex: 1; }
    .step-label { font-weight: 600; margin-bottom: 2px; }
    .step-detail { color: #94a3b8; font-size: 12px; }
    .pending .step-icon::after { content: '⏳'; }
    .running .step-icon::after { content: '⏳'; }
    .done .step-icon::after { content: '✅'; }
    .failed .step-icon::after { content: '❌'; }
    .status { margin-top: 16px; font-size: 13px; color: #94a3b8; min-height: 20px; }
    .error { color: #f87171; }
  </style>
</head>
<body>
  <h1>Setting up BDR Copilot</h1>
  <p class="subtitle">Installing prerequisites. This only happens once.</p>
  <div class="step pending" id="step-brew">
    <span class="step-icon"></span>
    <div class="step-text">
      <div class="step-label">Homebrew</div>
      <div class="step-detail">Package manager for macOS</div>
    </div>
  </div>
  <div class="step pending" id="step-node">
    <span class="step-icon"></span>
    <div class="step-text">
      <div class="step-label">Node.js</div>
      <div class="step-detail">JavaScript runtime for the backend</div>
    </div>
  </div>
  <div class="step pending" id="step-claude">
    <span class="step-icon"></span>
    <div class="step-text">
      <div class="step-label">Claude Code CLI</div>
      <div class="step-detail">AI engine for research and outreach</div>
    </div>
  </div>
  <div class="status" id="status"></div>
</body>
</html>`;

  win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
  return win;
}

function setStepState(win, stepId, state, detail) {
  win.webContents.executeJavaScript(`
    const el = document.getElementById('${stepId}');
    el.className = 'step ${state}';
    ${detail ? `el.querySelector('.step-detail').textContent = '${detail}';` : ''}
  `).catch(() => {});
}

function setStatus(win, msg, isError) {
  win.webContents.executeJavaScript(`
    const el = document.getElementById('status');
    el.textContent = ${JSON.stringify(msg)};
    el.className = 'status${isError ? ' error' : ''}';
  `).catch(() => {});
}

function runBrewInstall() {
  // Homebrew install needs Terminal for the password prompt
  return new Promise((resolve, reject) => {
    const { execFile: ef } = require('child_process');
    // Use osascript to open Terminal and run the install, then touch a sentinel file when done
    const sentinel = path.join(require('os').tmpdir(), '.bdr-brew-done');
    const fs = require('fs');
    try { fs.unlinkSync(sentinel); } catch {}

    const script = `
      tell application "Terminal"
        activate
        do script "/bin/bash -c \\"$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)\\" && touch ${sentinel}"
      end tell
    `;
    ef('/usr/bin/osascript', ['-e', script], { timeout: 10000 }, (err) => {
      if (err) return reject(err);
      // Poll for the sentinel file (brew install can take a few minutes)
      let attempts = 0;
      const check = setInterval(() => {
        attempts++;
        if (fs.existsSync(sentinel)) {
          clearInterval(check);
          try { fs.unlinkSync(sentinel); } catch {}
          resolve();
        } else if (hasBrew()) {
          // Brew appeared even without sentinel (user may have had it partially installed)
          clearInterval(check);
          resolve();
        } else if (attempts > 360) { // 6 minutes
          clearInterval(check);
          reject(new Error('Homebrew install timed out'));
        }
      }, 1000);
    });
  });
}

function runCommand(cmd, args, timeoutMs = 120000) {
  return new Promise((resolve, reject) => {
    const { execFile: ef } = require('child_process');
    const envWithPath = { ...process.env, PATH: getShellPath() };
    ef(cmd, args, { timeout: timeoutMs, env: envWithPath }, (err, stdout, stderr) => {
      if (err) return reject(new Error(stderr || err.message));
      resolve(stdout);
    });
  });
}

async function ensurePrerequisites() {
  const brewPath = hasBrew();
  const nodeOk = hasNode();
  const claudeResult = await checkClaude();

  // If everything is installed, skip the setup window
  if (brewPath && nodeOk && claudeResult.installed) {
    return { claudeAuthenticated: claudeResult.authenticated };
  }

  const setupWin = createSetupWindow();
  await new Promise(r => setTimeout(r, 500)); // let window render

  // Step 1: Homebrew
  if (brewPath) {
    setStepState(setupWin, 'step-brew', 'done', 'Already installed');
  } else {
    setStepState(setupWin, 'step-brew', 'running', 'Installing... check Terminal for password prompt');
    setStatus(setupWin, 'Homebrew needs your password — check the Terminal window that just opened.');
    try {
      await runBrewInstall();
      setStepState(setupWin, 'step-brew', 'done', 'Installed');
    } catch (err) {
      setStepState(setupWin, 'step-brew', 'failed', err.message);
      setStatus(setupWin, 'Homebrew install failed. Install manually: brew.sh', true);
      await new Promise(r => setTimeout(r, 5000));
      setupWin.close();
      return { failed: true };
    }
  }

  const brew = hasBrew() || 'brew';

  // Step 2: Node.js
  if (nodeOk) {
    setStepState(setupWin, 'step-node', 'done', 'Already installed');
  } else {
    setStepState(setupWin, 'step-node', 'running', 'Installing via Homebrew...');
    setStatus(setupWin, 'Installing Node.js...');
    try {
      await runCommand(brew, ['install', 'node'], 180000);
      setStepState(setupWin, 'step-node', 'done', 'Installed');
    } catch (err) {
      setStepState(setupWin, 'step-node', 'failed', err.message);
      setStatus(setupWin, 'Node install failed. Run: brew install node', true);
      await new Promise(r => setTimeout(r, 5000));
      setupWin.close();
      return { failed: true };
    }
  }

  // Step 3: Claude Code CLI
  if (claudeResult.installed) {
    setStepState(setupWin, 'step-claude', 'done',
      claudeResult.authenticated ? 'Installed & authenticated' : 'Installed — needs auth');
  } else {
    setStepState(setupWin, 'step-claude', 'running', 'Installing via Homebrew...');
    setStatus(setupWin, 'Installing Claude Code CLI...');
    try {
      await runCommand(brew, ['install', 'claude-code'], 180000);
      setStepState(setupWin, 'step-claude', 'done', 'Installed — needs auth');
    } catch {
      // claude-code might not be on brew yet — try npm
      try {
        await runCommand('npm', ['install', '-g', '@anthropic-ai/claude-code'], 120000);
        setStepState(setupWin, 'step-claude', 'done', 'Installed via npm — needs auth');
      } catch (err2) {
        setStepState(setupWin, 'step-claude', 'failed', 'Install manually: claude.ai/download');
        setStatus(setupWin, 'Claude CLI install failed. Visit claude.ai/download', true);
        await new Promise(r => setTimeout(r, 5000));
        setupWin.close();
        return { failed: true };
      }
    }
  }

  setStatus(setupWin, 'All set! Starting BDR Copilot...');
  await new Promise(r => setTimeout(r, 1500));
  setupWin.close();

  // Re-check Claude auth after potential install
  const finalClaude = await checkClaude();
  return { claudeAuthenticated: finalClaude.authenticated };
}

async function ensureDataverseMcp() {
  // Download and install Ryan's Dataverse MCP binary if not already present
  const fs = require('fs');
  const https = require('https');
  const { execFileSync } = require('child_process');
  const installDir = path.join(process.env.HOME || '', 'c3ai-dataverse-mcp');
  const binaryPath = path.join(installDir, 'c3ai-dataverse-mcp');

  if (fs.existsSync(binaryPath)) return binaryPath; // already installed

  const arch = process.arch === 'arm64' ? 'arm64' : 'x64';
  const assetName = `c3ai-dataverse-mcp-${arch}`;
  const url = `https://github.com/c3-jack/bdr-copilot/releases/download/v0.2.0/${assetName}`;

  return new Promise((resolve) => {
    fs.mkdirSync(installDir, { recursive: true });
    const tmpPath = path.join(installDir, `${assetName}.tmp`);
    const file = fs.createWriteStream(tmpPath);

    // Follow redirects (GitHub releases redirect to S3)
    function download(downloadUrl) {
      https.get(downloadUrl, { headers: { 'User-Agent': 'BDR-Copilot' } }, (res) => {
        if (res.statusCode === 302 || res.statusCode === 301) {
          download(res.headers.location);
          return;
        }
        if (res.statusCode !== 200) {
          resolve(null);
          return;
        }
        res.pipe(file);
        file.on('finish', () => {
          file.close();
          try {
            fs.renameSync(tmpPath, binaryPath);
            fs.chmodSync(binaryPath, 0o755);
            // Remove macOS quarantine flag
            try { execFileSync('xattr', ['-d', 'com.apple.quarantine', binaryPath]); } catch {}
            resolve(binaryPath);
          } catch {
            resolve(null);
          }
        });
      }).on('error', () => {
        try { fs.unlinkSync(tmpPath); } catch {}
        resolve(null);
      });
    }

    download(url);
  });
}

async function ensureMcps() {
  // Auto-install MCP servers on first run (non-blocking, best-effort)
  const claudePath = findClaudeBinary();
  const fs = require('fs');
  const envWithPath = { ...process.env, PATH: getShellPath() };

  const mcps = [
    { name: 'microsoft365', args: ['mcp', 'add', '--transport', 'http', '-s', 'user', 'microsoft365', 'https://microsoft365.mcp.claude.com/mcp'] },
    { name: 'atlassian', args: ['mcp', 'add', '--transport', 'http', '-s', 'user', 'atlassian', 'https://mcp.atlassian.com/v1/mcp'] },
    { name: 'github', args: ['mcp', 'add', '-s', 'user', 'github', '--', 'npx', '-y', '@modelcontextprotocol/server-github'] },
  ];

  // Download + install Dataverse MCP binary, then register it
  const dataverseBinary = await ensureDataverseMcp();
  if (dataverseBinary) {
    mcps.push({
      name: 'c3ai-dataverse',
      args: ['mcp', 'add', '-s', 'user', 'c3ai-dataverse', '--', dataverseBinary, 'https://c3ai.crm.dynamics.com'],
    });
  }

  for (const mcp of mcps) {
    try {
      execFile(claudePath, mcp.args, { timeout: 15000, env: envWithPath }, () => {});
    } catch {
      // Already exists or failed — either way, move on
    }
  }
}

app.whenReady().then(async () => {
  log(`app ready — version ${app.getVersion()}`);
  log(`app path: ${app.getAppPath()}`);
  log(`resourcesPath: ${process.resourcesPath}`);
  log(`execPath: ${process.execPath}`);
  log(`platform: ${process.platform} arch: ${process.arch}`);

  // Step 1: Ensure all prerequisites are installed (brew, node, claude)
  const prereqs = await ensurePrerequisites();
  log(`prereqs: ${JSON.stringify(prereqs)}`);
  if (prereqs.failed) {
    app.quit();
    return;
  }

  // Step 2: If Claude is authenticated, install MCPs. If not, show auth flow.
  if (prereqs.claudeAuthenticated) {
    ensureMcps();
  } else {
    const authed = await showAuthFlow();
    if (authed) {
      ensureMcps();
    }
  }

  // Step 3: Start Express backend
  try {
    serverPort = await getFreePorts();
    await startBackendServer(serverPort);
  } catch (err) {
    log(`FATAL startup error: ${err.message}`);
    dialog.showErrorBox('Server Error',
      `Failed to start BDR Copilot server:\n${err.message}\n\n` +
      `Send Jack this file:\n${LOG_PATH}`
    );
    app.quit();
    return;
  }

  // Step 4: Open main window
  mainWindow = createMainWindow(serverPort);

  // Watch for server crash after startup — show error instead of blank window
  serverProcess.on('exit', (code, signal) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      const reason = signal ? `killed by ${signal}` : `exited with code ${code}`;
      dialog.showErrorBox('Server Crashed', `The backend server ${reason}. The app will restart.`);
      app.relaunch();
      app.quit();
    }
  });

  if (!prereqs.claudeAuthenticated) {
    mainWindow.webContents.once('did-finish-load', () => {
      mainWindow.webContents.executeJavaScript(`
        if (!document.getElementById('claude-warn')) {
          const d = document.createElement('div');
          d.id = 'claude-warn';
          d.style.cssText = 'position:fixed;top:0;left:0;right:0;padding:8px 16px;background:#92400e;color:#fef3c7;font-size:13px;text-align:center;z-index:9999;font-family:system-ui';
          d.textContent = 'Claude CLI not authenticated. Run "claude" in Terminal to sign in, then restart the app.';
          document.body.prepend(d);
        }
      `);
    });
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
});

app.on('window-all-closed', () => {
  if (serverProcess) serverProcess.kill();
  app.quit();
});

app.on('activate', () => {
  if (!mainWindow && serverProcess && serverPort) {
    mainWindow = createMainWindow(serverPort);
  }
});
