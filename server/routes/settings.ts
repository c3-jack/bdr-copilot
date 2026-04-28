import { Router } from 'express';
import { existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { loadConfig, saveConfig, resolve } from '../lib/config.js';
import { execFile } from 'child_process';
import { askClaude, findClaudeBinary, getEnhancedEnv } from '../lib/claude.js';

export const settingsRouter = Router();

function mask(value?: string): string {
  if (!value) return '';
  if (value.length <= 8) return '****';
  return value.slice(0, 4) + '****' + value.slice(-4);
}

// GET /api/settings — return current config (masked secrets)
settingsRouter.get('/', (_req, res) => {
  const config = loadConfig();
  const ziConfigured = Boolean(resolve('ZOOMINFO_CLIENT_ID') && resolve('ZOOMINFO_PRIVATE_KEY'));

  res.json({
    zoominfo: {
      configured: ziConfigured,
      clientId: mask(resolve('ZOOMINFO_CLIENT_ID')),
      hasPrivateKey: Boolean(resolve('ZOOMINFO_PRIVATE_KEY')),
    },
    dataverse: {
      installed: existsSync(join(homedir(), 'c3ai-dataverse-mcp', 'c3ai-dataverse-mcp')),
    },
    linkedin: {
      configured: true,
    },
    raw: {
      zoominfo: {
        clientId: config.zoominfo?.clientId ?? '',
        privateKey: config.zoominfo?.privateKey ?? '',
      },
    },
  });
});

// PUT /api/settings — save config
settingsRouter.put('/', (req, res) => {
  const { zoominfo } = req.body;
  const config = loadConfig();

  if (zoominfo) {
    config.zoominfo = {
      clientId: zoominfo.clientId || undefined,
      privateKey: zoominfo.privateKey || undefined,
    };
  }

  saveConfig(config);
  res.json({ ok: true });
});

// POST /api/settings/test-zoominfo — test ZoomInfo connection
settingsRouter.post('/test-zoominfo', async (_req, res) => {
  const clientId = resolve('ZOOMINFO_CLIENT_ID');
  const privateKey = resolve('ZOOMINFO_PRIVATE_KEY');

  if (!clientId || !privateKey) {
    res.json({ ok: false, error: 'Credentials not configured' });
    return;
  }

  try {
    const resp = await fetch('https://api.zoominfo.com/authenticate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId, privateKey }),
    });

    if (resp.ok) {
      res.json({ ok: true });
    } else {
      const text = await resp.text();
      res.json({ ok: false, error: `Auth failed (${resp.status}): ${text.slice(0, 200)}` });
    }
  } catch (err) {
    res.json({ ok: false, error: (err as Error).message });
  }
});

// POST /api/settings/test-dynamics — test Dataverse MCP connection
settingsRouter.post('/test-dynamics', async (_req, res) => {
  try {
    const result = await askClaude(
      'Use the dataverse_whoami tool to check the connection. Reply with just the user display name or "connected" if it works.',
      { systemPrompt: 'Execute the whoami tool and report the result briefly.', useDataverse: true }
    );
    const text = result.text.trim();
    if (text.length > 0) {
      res.json({ ok: true, user: text });
    } else {
      res.json({ ok: false, error: 'No response from Dataverse MCP' });
    }
  } catch (err) {
    res.json({ ok: false, error: (err as Error).message });
  }
});

// GET /api/settings/test-claude — test Claude CLI auth
settingsRouter.get('/test-claude', (_req, res) => {
  const claudeBin = findClaudeBinary();
  const env = getEnhancedEnv();
  execFile(claudeBin, ['--version'], { timeout: 5000, env }, (err, stdout) => {
    if (err) {
      res.json({ installed: false, authenticated: false });
      return;
    }
    const version = stdout.trim();
    execFile(claudeBin, ['--print', 'respond with OK'], { timeout: 15000, env }, (authErr) => {
      res.json({
        installed: true,
        authenticated: !authErr,
        version,
      });
    });
  });
});
