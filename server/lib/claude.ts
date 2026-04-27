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
 */
export async function askClaude(prompt: string, options?: {
  systemPrompt?: string;
  outputFormat?: 'text' | 'json';
}): Promise<ClaudeResponse> {
  const args = ['--print'];

  if (options?.systemPrompt) {
    args.push('--system-prompt', options.systemPrompt);
  }

  if (options?.outputFormat) {
    args.push('--output-format', options.outputFormat);
  }

  args.push(prompt);

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
}): Promise<T> {
  const response = await askClaude(
    prompt + '\n\nRespond with valid JSON only, no markdown fencing.',
    { ...options }
  );

  try {
    return JSON.parse(response.text) as T;
  } catch {
    // Sometimes Claude wraps in ```json ... ```, strip it
    const cleaned = response.text.replace(/^```json?\n?/, '').replace(/\n?```$/, '');
    return JSON.parse(cleaned) as T;
  }
}
