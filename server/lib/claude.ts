import { execFile } from 'child_process';
import { promisify } from 'util';
import { existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const exec = promisify(execFile);

/** Resolve full PATH so Claude CLI is found even inside Electron. */
export function getEnhancedEnv(): NodeJS.ProcessEnv {
  const home = homedir();
  const extras = [
    '/usr/local/bin',
    '/opt/homebrew/bin',
    join(home, '.local/bin'),
    join(home, '.npm-global/bin'),
    join(home, '.claude/local'),
    join(home, '.volta/bin'),
  ];
  const base = process.env.PATH || '';
  const parts = new Set([...base.split(':').filter(Boolean), ...extras]);
  return { ...process.env, PATH: [...parts].join(':') };
}

/** Find the claude binary path. */
export function findClaudeBinary(): string {
  const home = homedir();
  const candidates = [
    '/usr/local/bin/claude',
    '/opt/homebrew/bin/claude',
    join(home, '.npm-global/bin/claude'),
    join(home, '.claude/local/claude'),
  ];
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  return 'claude'; // hope it's in PATH
}

interface ClaudeResponse {
  text: string;
  usage?: { input_tokens: number; output_tokens: number };
}

/**
 * Call Claude via the local Claude Code CLI.
 * BDRs already have Claude Code subscriptions — no API key needed.
 * Uses `claude --print` for non-interactive single-shot prompts.
 *
 * When `useMcp` is true, allows MCP tools (SharePoint, Confluence, etc.)
 * so Claude can search internal systems during research.
 */
export async function askClaude(prompt: string, options?: {
  systemPrompt?: string;
  outputFormat?: 'text' | 'json';
  useMcp?: boolean;
  useDataverse?: boolean;
}): Promise<ClaudeResponse> {
  const args = ['--print'];

  if (options?.systemPrompt) {
    args.push('--system-prompt', options.systemPrompt);
  }

  if (options?.outputFormat) {
    args.push('--output-format', options.outputFormat);
  }

  if (options?.useMcp || options?.useDataverse) {
    // When --allowedTools is used, prompt must be passed via -p flag
    const tools: string[] = [];

    if (options?.useMcp) {
      // Internal data access (SharePoint, Confluence, etc.)
      tools.push(
        'mcp__claude_ai_Microsoft_365__sharepoint_search',
        'mcp__claude_ai_Microsoft_365__sharepoint_folder_search',
        'mcp__claude_ai_Microsoft_365__outlook_email_search',
        'mcp__claude_ai_Microsoft_365__read_resource',
        'mcp__mcp-atlassian__searchConfluenceUsingCql',
        'mcp__mcp-atlassian__getConfluencePage',
        'mcp__mcp-atlassian__getConfluenceSpaces',
        'mcp__mcp-atlassian__searchJiraIssuesUsingJql',
        'mcp__mcp-atlassian__search',
        'WebFetch',
        'WebSearch',
      );
    }

    if (options?.useDataverse) {
      // Dynamics 365 / Dataverse access via Ryan's MCP (browser auth, no credentials needed)
      tools.push(
        'mcp__c3ai-dataverse__dataverse_sql',
        'mcp__c3ai-dataverse__dataverse_whoami',
      );
    }

    args.push('--allowedTools', ...tools);
    args.push('-p', prompt);
  } else {
    args.push(prompt);
  }

  // Longer timeout for MCP calls (browser auth popup can be slow)
  const timeout = (options?.useMcp || options?.useDataverse) ? 180_000 : 120_000;

  try {
    const claudeBin = findClaudeBinary();
    const { stdout } = await exec(claudeBin, args, {
      timeout,
      maxBuffer: 1024 * 1024, // 1MB output buffer
      env: getEnhancedEnv(),
    });

    let text = stdout.trim();

    // --output-format json wraps response in an envelope: {"type":"result","result":"..."}
    if (options?.outputFormat === 'json') {
      try {
        const envelope = JSON.parse(text) as { result?: string };
        if (envelope.result !== undefined) {
          text = typeof envelope.result === 'string' ? envelope.result : JSON.stringify(envelope.result);
        }
      } catch {
        // Not an envelope — use raw text
      }
    }

    return { text };
  } catch (error: unknown) {
    const err = error as Error & { stderr?: string; code?: string };
    if (err.code === 'ENOENT') {
      throw new Error('Claude CLI not found. Make sure Claude Code is installed.');
    }
    const stderr = err.stderr || '';
    if (stderr.includes('browser') || stderr.includes('login') || stderr.includes('auth')) {
      throw new Error('Authentication needed — check your browser for a login popup.');
    }
    if (err.message?.includes('ETIMEDOUT') || err.message?.includes('timed out')) {
      throw new Error('Request timed out. If a browser login opened, complete it and try again.');
    }
    throw new Error(`Claude CLI error: ${stderr || err.message}`);
  }
}

/**
 * Ask Claude to return structured JSON. Parses the response automatically.
 */
export async function askClaudeJSON<T>(prompt: string, options?: {
  systemPrompt?: string;
  useMcp?: boolean;
  useDataverse?: boolean;
}): Promise<T> {
  const response = await askClaude(
    prompt + '\n\nRespond with valid JSON only, no markdown fencing.',
    { ...options, outputFormat: 'json' }
  );

  const text = response.text;

  // Try direct parse first
  try { return JSON.parse(text) as T; } catch { /* continue */ }

  // Strip markdown fencing
  const stripped = text.replace(/^```json?\n?/, '').replace(/\n?```$/, '').trim();
  try { return JSON.parse(stripped) as T; } catch { /* continue */ }

  // Extract first JSON array or object from the response
  const arrayStart = text.indexOf('[');
  const objStart = text.indexOf('{');
  const start = arrayStart >= 0 && (objStart < 0 || arrayStart < objStart) ? arrayStart : objStart;
  if (start >= 0) {
    const closer = text[start] === '[' ? ']' : '}';
    const end = text.lastIndexOf(closer);
    if (end > start) {
      try { return JSON.parse(text.slice(start, end + 1)) as T; } catch { /* continue */ }
    }
  }

  throw new Error(`Failed to parse JSON from Claude response: ${text.slice(0, 200)}`)
}
