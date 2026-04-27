/**
 * BDR Copilot first-run setup script.
 * Checks prerequisites, installs MCP servers, and initializes the local database.
 *
 * Usage: npx tsx scripts/setup.ts
 */
import { execFileSync, execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';

const CONFIG_DIR = path.join(os.homedir(), '.bdr-copilot');
const DB_DIR = path.join(process.cwd(), 'db');

// ── Helpers ──

function log(msg: string) {
  process.stdout.write(`  ${msg}\n`);
}

function heading(msg: string) {
  process.stdout.write(`\n▸ ${msg}\n`);
}

function ok(msg: string) {
  process.stdout.write(`  ✓ ${msg}\n`);
}

function warn(msg: string) {
  process.stdout.write(`  ⚠ ${msg}\n`);
}

function fail(msg: string) {
  process.stdout.write(`  ✗ ${msg}\n`);
}

function commandExists(cmd: string): boolean {
  try {
    execFileSync('which', [cmd], { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

function getClaudeVersion(): string | null {
  try {
    return execFileSync('claude', ['--version'], { encoding: 'utf-8', timeout: 5000 }).trim();
  } catch {
    return null;
  }
}

function getConfiguredMcps(): string[] {
  try {
    const output = execFileSync('claude', ['mcp', 'list'], {
      encoding: 'utf-8',
      timeout: 30000,
    });
    // Parse MCP names from the list output (each line starts with the name)
    return output.split('\n')
      .filter(line => line.match(/^\S/) && line.includes(':'))
      .map(line => line.split(':')[0].trim().toLowerCase());
  } catch {
    return [];
  }
}

function addMcp(name: string, args: string[]): boolean {
  try {
    execFileSync('claude', ['mcp', 'add', ...args], {
      encoding: 'utf-8',
      timeout: 30000,
      stdio: 'pipe',
    });
    return true;
  } catch (err) {
    const error = err as Error & { stderr?: string };
    // Already exists is fine
    if (error.stderr?.includes('already exists') || error.message?.includes('already exists')) {
      return true;
    }
    fail(`Failed to add ${name}: ${error.stderr || error.message}`);
    return false;
  }
}

// ── Setup Steps ──

function checkClaude(): boolean {
  heading('Claude Code CLI');

  const version = getClaudeVersion();
  if (!version) {
    fail('Claude Code CLI not found');
    log('Install from: https://claude.ai/download');
    log('Or run: brew install claude-code');
    return false;
  }

  ok(`Installed (${version})`);

  // Check auth
  try {
    execFileSync('claude', ['--print', 'respond with OK'], {
      encoding: 'utf-8',
      timeout: 15000,
      stdio: 'pipe',
    });
    ok('Authenticated');
  } catch {
    warn('Not signed in — run "claude" in Terminal to authenticate');
    return false;
  }

  return true;
}

function setupMcps(): void {
  heading('MCP Servers');

  const existing = getConfiguredMcps();

  // Microsoft 365 MCP (first-party HTTP integration)
  const hasMs365 = existing.some(n =>
    n.includes('microsoft 365') || n.includes('microsoft365') || n.includes('ms-365') || n.includes('ms365')
  );
  if (hasMs365) {
    ok('Microsoft 365 MCP already configured');
  } else {
    log('Adding Microsoft 365 MCP...');
    const added = addMcp('microsoft365', [
      '--transport', 'http',
      '-s', 'user',
      'microsoft365',
      'https://microsoft365.mcp.claude.com/mcp',
    ]);
    if (added) ok('Microsoft 365 MCP added');
  }

  // Atlassian MCP (for Confluence + Jira)
  const hasAtlassian = existing.some(n =>
    n.includes('atlassian')
  );
  if (hasAtlassian) {
    ok('Atlassian MCP already configured');
  } else {
    log('Adding Atlassian MCP...');
    const added = addMcp('atlassian', [
      '--transport', 'http',
      '-s', 'user',
      'atlassian',
      'https://mcp.atlassian.com/v1/mcp',
    ]);
    if (added) ok('Atlassian MCP added');
  }

  // GitHub MCP
  const hasGithub = existing.some(n => n.includes('github'));
  if (hasGithub) {
    ok('GitHub MCP already configured');
  } else {
    log('Adding GitHub MCP...');
    const added = addMcp('github', [
      '-s', 'user',
      'github',
      '--',
      'npx', '-y', '@modelcontextprotocol/server-github',
    ]);
    if (added) {
      ok('GitHub MCP added');
      warn('Set GITHUB_PERSONAL_ACCESS_TOKEN env var for full access');
    }
  }

  // Playwright MCP (for web research)
  const hasPlaywright = existing.some(n => n.includes('playwright'));
  if (hasPlaywright) {
    ok('Playwright MCP already configured');
  } else {
    log('Adding Playwright MCP...');
    const added = addMcp('playwright', [
      '-s', 'user',
      'playwright',
      '--',
      'npx', '-y', '@playwright/mcp@latest',
    ]);
    if (added) ok('Playwright MCP added');
  }
}

function setupConfigDir(): void {
  heading('Local Config');

  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
    ok(`Created ${CONFIG_DIR}`);
  } else {
    ok(`${CONFIG_DIR} exists`);
  }

  const configPath = path.join(CONFIG_DIR, 'config.json');
  if (!fs.existsSync(configPath)) {
    fs.writeFileSync(configPath, JSON.stringify({}, null, 2));
    ok('Initialized config.json');
  } else {
    ok('config.json exists');
  }
}

function setupDatabase(): void {
  heading('Database');

  const dbPath = path.join(DB_DIR, 'bdr-copilot.db');
  if (fs.existsSync(dbPath)) {
    ok('Database already exists');
    return;
  }

  const schemaPath = path.join(DB_DIR, 'schema.sql');
  if (!fs.existsSync(schemaPath)) {
    warn('No schema.sql found — database will be created on first run');
    return;
  }

  ok('Database will be initialized on first server start');
}

function checkNode(): boolean {
  heading('Node.js');
  try {
    const version = execFileSync('node', ['--version'], { encoding: 'utf-8' }).trim();
    const major = parseInt(version.replace('v', ''));
    if (major < 18) {
      fail(`Node ${version} — need v18+`);
      return false;
    }
    ok(`${version}`);
    return true;
  } catch {
    fail('Node.js not found');
    return false;
  }
}

function installDeps(): void {
  heading('Dependencies');
  if (fs.existsSync(path.join(process.cwd(), 'node_modules'))) {
    ok('node_modules exists');
  } else {
    log('Running npm install...');
    execSync('npm install', { stdio: 'inherit' });
    ok('Dependencies installed');
  }
}

// ── Main ──

async function main() {
  console.log('\nBDR Copilot Setup\n' + '─'.repeat(40));

  const nodeOk = checkNode();
  if (!nodeOk) {
    process.exit(1);
  }

  const claudeOk = checkClaude();

  setupMcps();
  setupConfigDir();
  installDeps();
  setupDatabase();

  console.log('\n' + '─'.repeat(40));

  if (claudeOk) {
    console.log('\n  Ready. Run: npm run dev\n');
  } else {
    console.log('\n  Setup complete but Claude CLI needs authentication.');
    console.log('  Run "claude" in Terminal, sign in, then: npm run dev\n');
  }
}

main().catch(err => {
  console.error('\nSetup failed:', err.message);
  process.exit(1);
});
