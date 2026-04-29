import { Router } from 'express';
import { existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { loadConfig, saveConfig, resolve } from '../lib/config.js';
import { execFile } from 'child_process';
import { askClaude, findClaudeBinary, getEnhancedEnv } from '../lib/claude.js';
import { getStyleSamples, addStyleSample, deleteStyleSample } from '../lib/db.js';

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
// Currently disabled — requires admin consent for non-admin users
settingsRouter.post('/test-dynamics', async (_req, res) => {
  res.json({ ok: false, error: 'Dynamics integration requires admin consent. Contact your IT admin to enable Dataverse MCP for non-admin users.' });
});

// --- Writing Style Samples ---

settingsRouter.get('/style-samples', (_req, res) => {
  try {
    const samples = getStyleSamples();
    res.json({ samples });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

settingsRouter.post('/style-samples', (req, res) => {
  try {
    const { label, body } = req.body;
    if (!label || !body) {
      res.status(400).json({ error: 'label and body are required' });
      return;
    }
    addStyleSample(label, body);
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

settingsRouter.delete('/style-samples/:id', (req, res) => {
  try {
    deleteStyleSample(Number(req.params.id));
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
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
