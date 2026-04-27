import { Router } from 'express';
import { askClaudeJSON } from '../lib/claude.js';
import { webSearch } from '../lib/tavily.js';
import { scoreProspect } from '../lib/scoring.js';
import { getWinPatterns, getIcpCriteria, getTargetIndustries, getCaseStudies, upsertProspect, logActivity } from '../lib/db.js';

export const discoverRouter = Router();

interface DiscoverRequest {
  query: string;
  industry?: string;
  minRevenue?: number;
  maxResults?: number;
}

interface DiscoveredCompany {
  company_name: string;
  industry: string;
  revenue_b: number;
  employee_count?: number;
  headquarters?: string;
  why_a_fit: string;
  signals: string[];
  ai_posture: string;
}

discoverRouter.post('/', async (req, res) => {
  try {
    const { query, industry, minRevenue, maxResults = 5 } = req.body as DiscoverRequest;

    if (!query) {
      res.status(400).json({ error: 'query is required' });
      return;
    }

    logActivity('discover', `Query: ${query}`);

    // Build search context from seed data
    const icpCriteria = getIcpCriteria();
    const winPatterns = getWinPatterns();
    const targetIndustries = getTargetIndustries();

    // Search for companies matching the query
    const searchQuery = [
      query,
      industry ? `${industry} industry` : '',
      minRevenue ? `revenue over $${minRevenue}B` : 'Fortune 500 large enterprise',
      'AI digital transformation 2025 2026',
    ].filter(Boolean).join(' ');

    const searchResults = await webSearch(searchQuery, {
      maxResults: 10,
      searchDepth: 'advanced',
      includeAnswer: true,
    });

    // Have Claude analyze search results against ICP
    const companies = await askClaudeJSON<DiscoveredCompany[]>(`
You are a B2B sales intelligence analyst for C3 AI, an enterprise AI software company.

Given these web search results about potential target companies, identify up to ${maxResults} companies that match our Ideal Customer Profile.

## ICP Criteria
${JSON.stringify(icpCriteria, null, 2)}

## Our Win Patterns (industries + use cases where we've won before)
${JSON.stringify(winPatterns.slice(0, 10), null, 2)}

## Target Industries
${JSON.stringify(targetIndustries.map((t: Record<string, unknown>) => ({ name: t.name, key_use_cases: t.key_use_cases })), null, 2)}

## Search Results
${searchResults.results.map(r => `### ${r.title}\n${r.content}\n(${r.url})`).join('\n\n')}

${searchResults.answer ? `## Search Summary\n${searchResults.answer}` : ''}

${industry ? `Filter to: ${industry} industry` : ''}
${minRevenue ? `Minimum revenue: $${minRevenue}B` : ''}

For each company, return:
- company_name: official company name
- industry: their primary industry (match to our target industries if possible)
- revenue_b: estimated annual revenue in billions (number)
- employee_count: estimated employee count (number or null)
- headquarters: HQ location
- why_a_fit: 2-3 sentences on why they match our ICP
- signals: array of specific qualifying signals you detected (e.g., "AI job postings active", "Cloud migration announced", "New CTO hire")
- ai_posture: brief assessment of their AI maturity and initiatives

Return a JSON array of company objects. Only include companies that genuinely fit — quality over quantity.
`, { systemPrompt: 'You are a precise B2B sales intelligence analyst. Return valid JSON arrays only.' });

    // Score each discovered company
    const scoredCompanies = companies.map(company => {
      const scoring = scoreProspect({
        industry: company.industry,
        revenue_b: company.revenue_b,
        hasAiInitiatives: company.signals.some(s => /ai|artificial intelligence|ml|machine learning/i.test(s)),
        hasCloudMigration: company.signals.some(s => /cloud/i.test(s)),
        hasNewCxoHire: company.signals.some(s => /cxo|cto|cio|hire/i.test(s)),
        hasEarningsAiMention: company.signals.some(s => /earnings|annual report/i.test(s)),
        hasAiJobPostings: company.signals.some(s => /job post/i.test(s)),
        hasRegulatoryPressure: company.signals.some(s => /regulat/i.test(s)),
      });

      // Save to prospects table
      upsertProspect({
        company_name: company.company_name,
        industry: company.industry,
        revenue_b: company.revenue_b,
        employee_count: company.employee_count,
        headquarters: company.headquarters,
        signals_json: JSON.stringify(company.signals),
        similarity_score: scoring.score,
        recommended_use_case: scoring.recommendedUseCase,
        recommended_title: scoring.recommendedTitle,
        status: 'new',
      });

      return {
        ...company,
        score: scoring.score,
        matchedPatterns: scoring.matchedPatterns,
        recommendedUseCase: scoring.recommendedUseCase,
        recommendedTitle: scoring.recommendedTitle,
        reasoning: scoring.reasoning,
      };
    });

    // Sort by score descending
    scoredCompanies.sort((a, b) => b.score - a.score);

    logActivity('discover', `Found ${scoredCompanies.length} companies`, scoredCompanies.length * 500);

    res.json({ companies: scoredCompanies, searchAnswer: searchResults.answer });
  } catch (error) {
    const err = error as Error;
    res.status(500).json({ error: err.message });
  }
});

// Find companies similar to a given company
discoverRouter.post('/similar', async (req, res) => {
  try {
    const { companyName } = req.body as { companyName: string };

    if (!companyName) {
      res.status(400).json({ error: 'companyName is required' });
      return;
    }

    logActivity('discover_similar', `Similar to: ${companyName}`);

    const searchResults = await webSearch(
      `companies similar to ${companyName} enterprise AI digital transformation large revenue`,
      { maxResults: 8, searchDepth: 'advanced' }
    );

    const winPatterns = getWinPatterns();
    const icpCriteria = getIcpCriteria();

    const companies = await askClaudeJSON<DiscoveredCompany[]>(`
You are a B2B sales intelligence analyst for C3 AI.

Find companies SIMILAR to ${companyName} that would be good prospects for enterprise AI software. Similar means: same or adjacent industry, comparable size, similar operational challenges.

## Our ICP
${JSON.stringify(icpCriteria, null, 2)}

## Search Results
${searchResults.results.map(r => `### ${r.title}\n${r.content}`).join('\n\n')}

Return up to 5 companies as a JSON array. Each object needs: company_name, industry, revenue_b, employee_count, headquarters, why_a_fit, signals, ai_posture.
Do NOT include ${companyName} itself.
`, { systemPrompt: 'You are a precise B2B sales intelligence analyst. Return valid JSON arrays only.' });

    const scoredCompanies = companies.map(company => {
      const scoring = scoreProspect({
        industry: company.industry,
        revenue_b: company.revenue_b,
        hasAiInitiatives: company.signals.some(s => /ai|artificial intelligence/i.test(s)),
        hasCloudMigration: company.signals.some(s => /cloud/i.test(s)),
        hasNewCxoHire: company.signals.some(s => /cxo|cto|cio|hire/i.test(s)),
      });

      return { ...company, score: scoring.score, recommendedUseCase: scoring.recommendedUseCase, recommendedTitle: scoring.recommendedTitle };
    });

    scoredCompanies.sort((a, b) => b.score - a.score);
    res.json({ companies: scoredCompanies });
  } catch (error) {
    const err = error as Error;
    res.status(500).json({ error: err.message });
  }
});
