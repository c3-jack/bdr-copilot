/**
 * Local config file manager.
 * Stores credentials in ~/.bdr-copilot/config.json so they persist
 * across app restarts and aren't tied to the project directory.
 */
import fs from 'fs';
import path from 'path';
import os from 'os';

const CONFIG_DIR = path.join(os.homedir(), '.bdr-copilot');
const CONFIG_PATH = path.join(CONFIG_DIR, 'config.json');

export interface AppConfig {
  zoominfo?: {
    clientId?: string;
    privateKey?: string;
  };
  dynamics?: {
    orgUrl?: string;
    tenantId?: string;
    clientId?: string;
    clientSecret?: string;
  };
}

function ensureDir(): void {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
}

export function loadConfig(): AppConfig {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
    }
  } catch {
    // corrupted config, start fresh
  }
  return {};
}

export function saveConfig(config: AppConfig): void {
  ensureDir();
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');
}

export function getConfigValue(key: string): string | undefined {
  const config = loadConfig();
  switch (key) {
    case 'ZOOMINFO_CLIENT_ID': return config.zoominfo?.clientId;
    case 'ZOOMINFO_PRIVATE_KEY': return config.zoominfo?.privateKey;
    case 'DYNAMICS_ORG_URL': return config.dynamics?.orgUrl;
    case 'DYNAMICS_TENANT_ID': return config.dynamics?.tenantId;
    case 'DYNAMICS_CLIENT_ID': return config.dynamics?.clientId;
    case 'DYNAMICS_CLIENT_SECRET': return config.dynamics?.clientSecret;
    default: return undefined;
  }
}

/**
 * Get a config value, falling back to env var.
 * Config file takes priority over env vars.
 */
export function resolve(envKey: string): string | undefined {
  return getConfigValue(envKey) || process.env[envKey];
}
