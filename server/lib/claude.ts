import { execFile } from 'child_process';
import { promisify } from 'util';

const exec = promisify(execFile);

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
}): Promise<ClaudeResponse> {
  const args = ['--print'];

  if (options?.systemPrompt) {
    args.push('--system-prompt', options.systemPrompt);
  }

  if (options?.outputFormat) {
    args.push('--output-format', options.outputFormat);
  }

  if (options?.useMcp) {
    // Allow Claude to use MCP tools for internal data access
    // When --allowedTools is used, prompt must be passed via -p flag
    args.push('--allowedTools',
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
    args.push('-p', prompt);
  } else {
    args.push(prompt);
  }

  try {
    const { stdout } = await exec('claude', args, {
      timeout: 120_000, // 2 min timeout for research-heavy prompts
      maxBuffer: 1024 * 1024, // 1MB output buffer
    });

    return { text: stdout.trim() };
  } catch (error: unknown) {
    const err = error as Error & { stderr?: string };
    throw new Error(`Claude CLI error: ${err.stderr || err.message}`);
  }
}

/**
 * Ask Claude to return structured JSON. Parses the response automatically.
 */
export async function askClaudeJSON<T>(prompt: string, options?: {
  systemPrompt?: string;
  useMcp?: boolean;
}): Promise<T> {
  const response = await askClaude(
    prompt + '\n\nRespond with valid JSON only, no markdown fencing.',
    { ...options, outputFormat: 'json' }
  );

  try {
    return JSON.parse(response.text) as T;
  } catch {
    // Sometimes Claude wraps in ```json ... ```, strip it
    const cleaned = response.text.replace(/^```json?\n?/, '').replace(/\n?```$/, '');
    return JSON.parse(cleaned) as T;
  }
}
