import { useState, useEffect } from 'react';

const API = import.meta.env.DEV ? 'http://localhost:3001' : '';

interface SettingsData {
  zoominfo: { configured: boolean; clientId: string; hasPrivateKey: boolean };
  dataverse: { installed: boolean };
  linkedin: { configured: boolean };
  raw: {
    zoominfo: { clientId: string; privateKey: string };
  };
}

interface ClaudeStatus {
  installed: boolean;
  authenticated: boolean;
  version?: string;
}

interface TestResult {
  ok: boolean;
  error?: string;
}

export default function Settings() {
  const [settings, setSettings] = useState<SettingsData | null>(null);
  const [claude, setClaude] = useState<ClaudeStatus | null>(null);

  // ZoomInfo
  const [ziClientId, setZiClientId] = useState('');
  const [ziPrivateKey, setZiPrivateKey] = useState('');
  const [testingZi, setTestingZi] = useState(false);
  const [ziTestResult, setZiTestResult] = useState<TestResult | null>(null);

  // Dataverse MCP
  const [testingDyn, setTestingDyn] = useState(false);
  const [dynTestResult, setDynTestResult] = useState<TestResult | null>(null);

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [testingClaude, setTestingClaude] = useState(false);
  const [expandedHelp, setExpandedHelp] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API}/api/settings`).then(r => r.json()).then((data: SettingsData) => {
      setSettings(data);
      setZiClientId(data.raw.zoominfo.clientId);
      setZiPrivateKey(data.raw.zoominfo.privateKey);
    }).catch(() => {});

    fetch(`${API}/api/settings/test-claude`).then(r => r.json()).then(setClaude).catch(() => {});
  }, []);

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    setZiTestResult(null);
    try {
      await fetch(`${API}/api/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          zoominfo: { clientId: ziClientId, privateKey: ziPrivateKey },
        }),
      });
      const res = await fetch(`${API}/api/settings`);
      setSettings(await res.json());
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      setZiTestResult({ ok: false, error: 'Failed to save settings' });
    } finally {
      setSaving(false);
    }
  }

  async function testZoomInfo() {
    setTestingZi(true);
    setZiTestResult(null);
    try {
      const res = await fetch(`${API}/api/settings/test-zoominfo`, { method: 'POST' });
      setZiTestResult(await res.json());
    } catch {
      setZiTestResult({ ok: false, error: 'Request failed' });
    } finally {
      setTestingZi(false);
    }
  }

  async function testDynamics() {
    setTestingDyn(true);
    setDynTestResult(null);
    try {
      const res = await fetch(`${API}/api/settings/test-dynamics`, { method: 'POST' });
      setDynTestResult(await res.json());
    } catch {
      setDynTestResult({ ok: false, error: 'Request failed' });
    } finally {
      setTestingDyn(false);
    }
  }

  async function testClaude() {
    setTestingClaude(true);
    try {
      const res = await fetch(`${API}/api/settings/test-claude`);
      setClaude(await res.json());
    } catch {
      setClaude({ installed: false, authenticated: false });
    } finally {
      setTestingClaude(false);
    }
  }

  function toggleHelp(key: string) {
    setExpandedHelp(expandedHelp === key ? null : key);
  }

  return (
    <div className="max-w-xl">
      <h2 className="text-lg font-semibold text-neutral-100 mb-0.5">Settings</h2>
      <p className="text-neutral-500 text-sm mb-6">
        Configure integrations. Click "How to get this" for setup steps.
      </p>

      {/* ── Claude ── */}
      <Section
        title="Claude Code"
        subtitle="Powers AI research and outreach generation"
        ok={claude?.authenticated ?? false}
        loading={testingClaude}
      >
        {claude === null ? (
          <p className="text-xs text-neutral-500">Checking...</p>
        ) : claude.authenticated ? (
          <div className="flex items-center justify-between">
            <p className="text-xs text-neutral-400">Authenticated &middot; {claude.version}</p>
            <button onClick={testClaude} disabled={testingClaude} className="text-xs text-neutral-500 hover:text-neutral-300">
              {testingClaude ? 'Checking...' : 'Re-check'}
            </button>
          </div>
        ) : (
          <div>
            <p className="text-xs text-amber-400 mb-2">{claude.installed ? 'Installed but not signed in' : 'Not installed'}</p>
            <HelpToggle label="How to set up" open={expandedHelp === 'claude'} onClick={() => toggleHelp('claude')} />
            {expandedHelp === 'claude' && (
              <Steps steps={[
                'Download Claude Code from claude.ai/download (or install via brew: brew install claude-code)',
                'Open Terminal and run: claude',
                'Follow the login prompts to sign in with your Anthropic account',
                'Once authenticated, come back here and click Re-check',
              ]} />
            )}
            <button onClick={testClaude} disabled={testingClaude} className="mt-2 text-xs text-neutral-500 hover:text-neutral-300">
              {testingClaude ? 'Checking...' : 'Re-check'}
            </button>
          </div>
        )}
      </Section>

      {/* ── LinkedIn ── */}
      <Section title="LinkedIn Sales Navigator" subtitle="Direct links to company pages and contact profiles" ok={true}>
        <p className="text-xs text-neutral-400 mb-2">
          No API keys needed. Links open directly in your browser.
        </p>
        <HelpToggle label="How it works" open={expandedHelp === 'linkedin'} onClick={() => toggleHelp('linkedin')} />
        {expandedHelp === 'linkedin' && (
          <Steps steps={[
            'Make sure you\'re logged into LinkedIn Sales Navigator in your browser',
            'Every company card shows LI (LinkedIn) and SN (Sales Navigator) links',
            'Clicking them opens a new tab with the company page or people search',
            'If you don\'t have a Sales Navigator license, LI links still work for standard LinkedIn',
          ]} />
        )}
      </Section>

      {/* ── ZoomInfo ── */}
      <Section title="ZoomInfo" subtitle="Company enrichment, contacts, and intent signals" ok={settings?.zoominfo.configured ?? false}>
        <HelpToggle label="How to get credentials" open={expandedHelp === 'zoominfo'} onClick={() => toggleHelp('zoominfo')} />
        {expandedHelp === 'zoominfo' && (
          <Steps steps={[
            'Log into ZoomInfo (app.zoominfo.com) with your C3 account',
            'Click your avatar (top right) → Administration',
            'Go to Integrations → API in the left sidebar',
            'Click "Add API Key" → choose PKI authentication',
            'Copy the Client ID and download the Private Key file',
            'Paste both values below and click Test Connection',
            'If you don\'t have admin access, ask your RevOps team (they manage ZoomInfo licenses)',
          ]} />
        )}
        <div className="space-y-2 mt-2">
          <Field label="Client ID" value={ziClientId} onChange={setZiClientId} placeholder="e.g. a1b2c3d4-e5f6-..." />
          <Field label="Private Key" value={ziPrivateKey} onChange={setZiPrivateKey} placeholder="-----BEGIN PRIVATE KEY-----..." multiline />
        </div>
        <div className="flex items-center gap-2 mt-2">
          <TestButton label="Test Connection" testing={testingZi} disabled={!ziClientId || !ziPrivateKey} onClick={testZoomInfo} />
          <TestResultBadge result={ziTestResult} />
        </div>
      </Section>

      {/* ── Dynamics 365 ── */}
      <Section title="Dynamics 365" subtitle="Pull accounts and opportunities from CRM via Dataverse MCP" ok={settings?.dataverse.installed ?? false}>
        {settings?.dataverse.installed ? (
          <div>
            <p className="text-xs text-neutral-400 mb-2">
              Dataverse MCP is installed. Uses your Microsoft account — no app registration needed.
            </p>
            <p className="text-[11px] text-neutral-500 mb-2">
              First sync will open a browser window for Microsoft login.
            </p>
            <div className="flex items-center gap-2">
              <TestButton label="Test Connection" testing={testingDyn} disabled={false} onClick={testDynamics} />
              <TestResultBadge result={dynTestResult} />
            </div>
          </div>
        ) : (
          <div>
            <p className="text-xs text-amber-400 mb-2">Dataverse MCP not found</p>
            <p className="text-[11px] text-neutral-500">
              Re-run the BDR Copilot installer — it auto-installs the Dataverse MCP.
            </p>
          </div>
        )}
      </Section>

      {/* ── Save ── */}
      <div className="flex items-center gap-3 mt-2">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-2 bg-neutral-100 hover:bg-white disabled:bg-neutral-800 text-neutral-900 text-sm font-medium rounded transition-colors"
        >
          {saving ? 'Saving...' : 'Save All'}
        </button>
        {saved && <span className="text-xs text-emerald-400">Saved</span>}
      </div>

      <p className="text-[11px] text-neutral-600 mt-3 mb-8">
        Credentials stored locally at ~/.bdr-copilot/config.json — never sent to any external server.
      </p>
    </div>
  );
}

// ── Shared components ──

function Section({ title, subtitle, ok, loading, children }: {
  title: string; subtitle: string; ok: boolean; loading?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-5">
      <div className="flex items-center justify-between mb-1.5">
        <div>
          <h3 className="text-sm font-medium text-neutral-200">{title}</h3>
          <p className="text-[11px] text-neutral-500">{subtitle}</p>
        </div>
        <StatusDot ok={ok} loading={loading} />
      </div>
      <div className="bg-neutral-900 border border-neutral-800 rounded p-3">
        {children}
      </div>
    </section>
  );
}

function StatusDot({ ok, loading }: { ok: boolean; loading?: boolean }) {
  if (loading) return <div className="w-2 h-2 rounded-full bg-neutral-500 animate-pulse" />;
  return <div className={`w-2 h-2 rounded-full ${ok ? 'bg-emerald-400' : 'bg-neutral-600'}`} />;
}

function HelpToggle({ label, open, onClick }: { label: string; open: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className="text-[11px] text-neutral-500 hover:text-neutral-300 underline underline-offset-2">
      {open ? 'Hide instructions' : label}
    </button>
  );
}

function Steps({ steps }: { steps: string[] }) {
  return (
    <ol className="mt-2 mb-2 space-y-1.5">
      {steps.map((step, i) => (
        <li key={i} className="text-[11px] text-neutral-400 leading-relaxed">
          {step.startsWith('  →') ? (
            <span className="ml-4 block text-neutral-500">{step.trim()}</span>
          ) : (
            <span><span className="text-neutral-500 mr-1.5">{i + 1}.</span>{step}</span>
          )}
        </li>
      ))}
    </ol>
  );
}

function Field({ label, value, onChange, placeholder, multiline, secret }: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; multiline?: boolean; secret?: boolean;
}) {
  const cls = "w-full px-2.5 py-1.5 bg-neutral-800 border border-neutral-700 rounded text-sm text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-neutral-600";
  return (
    <div>
      <label className="block text-[11px] text-neutral-500 mb-0.5">{label}</label>
      {multiline ? (
        <textarea
          value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
          rows={3} className={`${cls} resize-none font-mono text-xs`}
        />
      ) : (
        <input
          type={secret ? 'password' : 'text'}
          value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
          className={`${cls}${secret ? ' font-mono text-xs' : ''}`}
        />
      )}
    </div>
  );
}

function TestButton({ label, testing, disabled, onClick }: {
  label: string; testing: boolean; disabled: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={testing || disabled}
      className="text-xs px-2.5 py-1 bg-neutral-800 hover:bg-neutral-700 disabled:text-neutral-600 text-neutral-300 rounded transition-colors"
    >
      {testing ? 'Testing...' : label}
    </button>
  );
}

function TestResultBadge({ result }: { result: TestResult | null }) {
  if (!result) return null;
  return (
    <span className={`text-xs ${result.ok ? 'text-emerald-400' : 'text-red-400'}`}>
      {result.ok ? 'Connected' : result.error}
    </span>
  );
}
