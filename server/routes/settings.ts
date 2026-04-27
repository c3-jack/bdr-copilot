import { Router } from 'express';
import { loadConfig, saveConfig, resolve } from '../lib/config.js';
import { execFile } from 'child_process';

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
  const dynamicsConfigured = Boolean(
    resolve('DYNAMICS_ORG_URL') && resolve('DYNAMICS_TENANT_ID') &&
    resolve('DYNAMICS_CLIENT_ID') && resolve('DYNAMICS_CLIENT_SECRET')
  );

  res.json({
    zoominfo: {
      configured: ziConfigured,
      clientId: mask(resolve('ZOOMINFO_CLIENT_ID')),
      hasPrivateKey: Boolean(resolve('ZOOMINFO_PRIVATE_KEY')),
    },
    dynamics: {
      configured: dynamicsConfigured,
      orgUrl: resolve('DYNAMICS_ORG_URL') ?? '',
    },
    linkedin: {
      configured: true,
    },
    raw: {
      zoominfo: {
        clientId: config.zoominfo?.clientId ?? '',
        privateKey: config.zoominfo?.privateKey ?? '',
      },
      dynamics: {
        orgUrl: config.dynamics?.orgUrl ?? '',
        tenantId: config.dynamics?.tenantId ?? '',
        clientId: config.dynamics?.clientId ?? '',
        clientSecret: config.dynamics?.clientSecret ?? '',
      },
    },
  });
});

// PUT /api/settings — save config
settingsRouter.put('/', (req, res) => {
  const { zoominfo, dynamics } = req.body;
  const config = loadConfig();

  if (zoominfo) {
    config.zoominfo = {
      clientId: zoominfo.clientId || undefined,
      privateKey: zoominfo.privateKey || undefined,
    };
  }
  if (dynamics) {
    config.dynamics = {
      orgUrl: dynamics.orgUrl || undefined,
      tenantId: dynamics.tenantId || undefined,
      clientId: dynamics.clientId || undefined,
      clientSecret: dynamics.clientSecret || undefined,
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

// POST /api/settings/test-dynamics — test Dynamics 365 connection
settingsRouter.post('/test-dynamics', async (_req, res) => {
  const orgUrl = resolve('DYNAMICS_ORG_URL');
  const tenantId = resolve('DYNAMICS_TENANT_ID');
  const clientId = resolve('DYNAMICS_CLIENT_ID');
  const clientSecret = resolve('DYNAMICS_CLIENT_SECRET');

  if (!orgUrl || !tenantId || !clientId || !clientSecret) {
    res.json({ ok: false, error: 'Not all credentials configured' });
    return;
  }

  try {
    // Get OAuth2 token from Azure AD
    const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
    const tokenResp = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        scope: `${orgUrl}/.default`,
        grant_type: 'client_credentials',
      }),
    });

    if (!tokenResp.ok) {
      const text = await tokenResp.text();
      res.json({ ok: false, error: `Azure AD auth failed (${tokenResp.status}): ${text.slice(0, 200)}` });
      return;
    }

    const tokenData = await tokenResp.json() as { access_token: string };

    // Test the token by hitting WhoAmI
    const whoAmI = await fetch(`${orgUrl}/api/data/v9.2/WhoAmI`, {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    if (whoAmI.ok) {
      res.json({ ok: true });
    } else {
      res.json({ ok: false, error: `Connected to Azure AD but Dataverse returned ${whoAmI.status}` });
    }
  } catch (err) {
    res.json({ ok: false, error: (err as Error).message });
  }
});

// GET /api/settings/test-claude — test Claude CLI auth
settingsRouter.get('/test-claude', (_req, res) => {
  execFile('claude', ['--version'], { timeout: 5000 }, (err, stdout) => {
    if (err) {
      res.json({ installed: false, authenticated: false });
      return;
    }
    const version = stdout.trim();
    execFile('claude', ['--print', 'respond with OK'], { timeout: 15000 }, (authErr) => {
      res.json({
        installed: true,
        authenticated: !authErr,
        version,
      });
    });
  });
});
