import { app, BrowserWindow, dialog, shell } from 'electron';
import { execFile } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let mainWindow: BrowserWindow | null = null;
let serverPort = 3001;

// Check if Claude CLI is installed and authenticated
function checkClaude(): Promise<{ installed: boolean; authenticated: boolean; version?: string }> {
  return new Promise((resolve) => {
    execFile('claude', ['--version'], { timeout: 5000 }, (err, stdout) => {
      if (err) {
        resolve({ installed: false, authenticated: false });
        return;
      }
      const version = stdout.trim();

      // Try a minimal call to see if auth works
      execFile('claude', ['--print', 'respond with OK'], { timeout: 15000 }, (authErr) => {
        if (authErr) {
          resolve({ installed: true, authenticated: false, version });
          return;
        }
        resolve({ installed: true, authenticated: true, version });
      });
    });
  });
}

function createAuthWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 520,
    height: 420,
    resizable: false,
    titleBarStyle: 'hiddenInset',
    webPreferences: { nodeIntegration: false, contextIsolation: true },
  });

  const html = `
    <!DOCTYPE html>
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

      <div class="step">
        <span class="step-num">1</span>
        Open Terminal and run: <code>claude</code>
      </div>
      <div class="step">
        <span class="step-num">2</span>
        Follow the prompts to sign in with your Anthropic account
      </div>
      <div class="step">
        <span class="step-num">3</span>
        Once signed in, click Retry below
      </div>

      <button class="retry" id="retry">Retry Connection</button>
      <div class="status" id="status"></div>

      <script>
        document.getElementById('retry').addEventListener('click', () => {
          document.getElementById('status').textContent = 'Checking...';
          document.getElementById('status').className = 'status';
          // Signal to main process
          window.location.hash = 'retry-' + Date.now();
        });
      </script>
    </body>
    </html>
  `;

  win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
  return win;
}

async function showAuthFlow(): Promise<boolean> {
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
          authWin.webContents.executeJavaScript(`
            document.getElementById('status').textContent = 'Claude CLI not found. Install it from claude.ai/download';
            document.getElementById('status').className = 'status error';
          `);
        } else {
          authWin.webContents.executeJavaScript(`
            document.getElementById('status').textContent = 'Claude is installed but not signed in. Run "claude" in Terminal to authenticate.';
            document.getElementById('status').className = 'status error';
          `);
        }
      }
    });

    authWin.on('closed', () => resolve(false));
  });
}

async function startBackendServer(): Promise<number> {
  // Dynamic import of the compiled server
  const serverPath = path.join(__dirname, '../dist/server/index.js');
  process.env.BDR_ELECTRON = '1';

  const serverMod = await import(serverPath);
  const port = await serverMod.startServer(0); // port 0 = random available port
  return port;
}

function createMainWindow(port: number): BrowserWindow {
  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 900,
    minHeight: 600,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 16 },
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  win.loadURL(`http://localhost:${port}`);

  win.webContents.setWindowOpenHandler(({ url }) => {
    // Open LinkedIn/external links in default browser
    shell.openExternal(url);
    return { action: 'deny' };
  });

  return win;
}

app.whenReady().then(async () => {
  // Step 1: Check Claude auth
  const claude = await checkClaude();

  if (!claude.installed) {
    const proceed = await showAuthFlow();
    if (!proceed) {
      app.quit();
      return;
    }
  } else if (!claude.authenticated) {
    const proceed = await showAuthFlow();
    if (!proceed) {
      app.quit();
      return;
    }
  }

  // Step 2: Start Express backend
  try {
    serverPort = await startBackendServer();
  } catch (err) {
    dialog.showErrorBox('Server Error', `Failed to start BDR Copilot server:\n${(err as Error).message}`);
    app.quit();
    return;
  }

  // Step 3: Open main window
  mainWindow = createMainWindow(serverPort);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
});

app.on('window-all-closed', () => {
  app.quit();
});

app.on('activate', () => {
  if (!mainWindow) {
    mainWindow = createMainWindow(serverPort);
  }
});
