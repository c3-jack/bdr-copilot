/**
 * SharePoint integration — search past engagement docs via Claude CLI + M365 MCP.
 * Uses the user's Claude Code subscription which has M365 MCP configured.
 * Searches for account plans, proposals, engagement summaries, and similar deals.
 */

import { askClaudeJSON } from './claude.js';

// All calls in this module use MCP tools for real SharePoint/Confluence access
const MCP_OPTS = { useMcp: true } as const;

export interface EngagementDoc {
  title: string;
  type: 'account_plan' | 'proposal' | 'case_study' | 'presentation' | 'meeting_notes' | 'other';
  url?: string;
  summary: string;
  relevance: string;
  customer?: string;
  industry?: string;
}

export interface PastEngagement {
  customerName: string;
  industry: string;
  useCase: string;
  championTitle: string;
  outcome: string;
  lessons: string;
  similarity: string;
}

/**
 * Search SharePoint for documents related to a company or industry.
 * Uses Claude CLI which has access to the M365 MCP tools.
 */
export async function searchEngagementDocs(params: {
  companyName?: string;
  industry?: string;
  useCase?: string;
}): Promise<EngagementDoc[]> {
  const searchTerms: string[] = [];
  if (params.companyName) searchTerms.push(params.companyName);
  if (params.industry) searchTerms.push(params.industry);
  if (params.useCase) searchTerms.push(params.useCase);
  searchTerms.push('C3 AI');

  try {
    const docs = await askClaudeJSON<EngagementDoc[]>(`
Search SharePoint for documents related to past C3 AI engagements with these criteria:
${params.companyName ? `- Company: ${params.companyName}` : ''}
${params.industry ? `- Industry: ${params.industry}` : ''}
${params.useCase ? `- Use Case: ${params.useCase}` : ''}

Use the Microsoft 365 MCP tools to search SharePoint for:
1. Account plans for ${params.companyName ?? 'similar companies in ' + (params.industry ?? 'target industries')}
2. Proposals or SOWs for ${params.useCase ?? 'enterprise AI'} engagements
3. Case studies or success stories in ${params.industry ?? 'similar industries'}
4. Meeting notes or engagement summaries

For each document found, return:
- title: document title
- type: one of "account_plan", "proposal", "case_study", "presentation", "meeting_notes", "other"
- url: SharePoint URL if available
- summary: brief summary of what the document contains
- relevance: why this document is relevant to the current prospect
- customer: customer name if identifiable
- industry: industry

Return a JSON array. If no documents are found, return an empty array [].
`, {
      systemPrompt: 'You are a sales research assistant with access to SharePoint and Confluence via MCP tools. Use them to search for relevant engagement documents. Return structured results as JSON.',
      ...MCP_OPTS,
    });

    return docs;
  } catch {
    return [];
  }
}

/**
 * Find similar past engagements to inform approach for a new prospect.
 */
export async function findSimilarEngagements(params: {
  targetCompany: string;
  industry: string;
  useCase?: string;
  championTitle?: string;
}): Promise<PastEngagement[]> {
  try {
    const engagements = await askClaudeJSON<PastEngagement[]>(`
Search SharePoint and any available internal documents for past C3 AI engagements similar to this prospect:
- Target Company: ${params.targetCompany}
- Industry: ${params.industry}
${params.useCase ? `- Use Case: ${params.useCase}` : ''}
${params.championTitle ? `- Champion Title: ${params.championTitle}` : ''}

Use Microsoft 365 MCP tools to search for:
1. Past deals in ${params.industry}
2. Engagements involving ${params.championTitle ?? 'similar executive titles'}
3. ${params.useCase ?? 'Similar use case'} deployments

For each similar engagement found, return:
- customerName: the customer
- industry: their industry
- useCase: what C3 product/solution was deployed
- championTitle: who was the internal champion
- outcome: deal outcome (won/lost/in-progress) and value if known
- lessons: key takeaways applicable to ${params.targetCompany}
- similarity: why this engagement is similar

Return a JSON array. If no engagements are found, return an empty array [].
`, {
      systemPrompt: 'You are a sales research assistant with access to SharePoint and Confluence via MCP tools. Use them to search for past engagement data. Return structured JSON results.',
      ...MCP_OPTS,
    });

    return engagements;
  } catch {
    return [];
  }
}
