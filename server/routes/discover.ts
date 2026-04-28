import { Router } from 'express';
import { askClaudeJSON } from '../lib/claude.js';
import { scoreProspect } from '../lib/scoring.js';
import { getWinPatterns, getIcpCriteria, getTargetIndustries, getCaseStudies, upsertProspect, getActiveProspectNames, logActivity } from '../lib/db.js';
import * as dynamics from '../lib/dynamics.js';

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

    // Build search context from seed data (with fallbacks)
    const icpCriteria = getIcpCriteria();
    const winPatterns = getWinPatterns();
    const targetIndustries = getTargetIndustries();

    const icpContext = JSON.stringify(icpCriteria, null, 2);
    const winContext = JSON.stringify(winPatterns.slice(0, 10), null, 2);
    const industryContext = JSON.stringify(
      targetIndustries.map((t: Record<string, unknown>) => ({ name: t.name, key_use_cases: t.key_use_cases })),
      null, 2
    );

    // Build exclusion list: companies already contacted or with active deals
    const activeNames = getActiveProspectNames();
    let dynamicsNames = new Set<string>();
    if (dynamics.isConfigured()) {
      try {
        const opps = await dynamics.getOpportunities({ openOnly: true, top: 100 });
        const accts = await dynamics.getAccounts({ top: 100 });
        const oppAccountIds = new Set(opps.map(o => o._parentaccountid_value).filter(Boolean));
        for (const acct of accts) {
          if (oppAccountIds.has(acct.accountid)) {
            dynamicsNames.add(acct.name.toLowerCase());
          }
        }
      } catch {
        // Dynamics unavailable — skip filter
      }
    }

    const excludeList = [...new Set([...activeNames, ...dynamicsNames])];
    const excludePrompt = excludeList.length > 0
      ? `\nIMPORTANT: Do NOT include any of these companies (we already have active deals or have contacted them):\n${excludeList.map(n => `- ${n}`).join('\n')}\n`
      : '';

    // Have Claude identify companies matching ICP using its knowledge
    const companies = await askClaudeJSON<DiscoveredCompany[]>(`
You are a B2B sales intelligence analyst for C3 AI, an enterprise AI software company.

A BDR is searching for: "${query}"
${industry ? `Industry filter: ${industry}` : ''}
${minRevenue ? `Minimum revenue: $${minRevenue}B` : 'Target: Fortune 500 / large enterprise'}

Using your knowledge of the business landscape, identify up to ${maxResults} real companies that match our Ideal Customer Profile.

## ICP Criteria
${icpContext}

## Our Win Patterns (industries + use cases where we've won before)
${winContext}

## Target Industries
${industryContext}

${excludePrompt}
For each company, return:
- company_name: official company name
- industry: their primary industry (match to our target industries if possible)
- revenue_b: estimated annual revenue in billions (number)
- employee_count: estimated employee count (number or null)
- headquarters: HQ location
- why_a_fit: 2-3 sentences on why they match our ICP, referencing specific business challenges they face
- signals: array of specific qualifying signals (e.g., "AI job postings active", "Cloud migration announced", "New CTO hire", "Digital transformation initiative")
- ai_posture: brief assessment of their AI maturity and initiatives

Return a JSON array of company objects. Only include real companies that genuinely fit — quality over quantity. Be specific about why each company is a good target.
`, { systemPrompt: 'You are a precise B2B sales intelligence analyst. Return valid JSON arrays only.' });

    // Post-filter: double-check Claude respected exclusion list
    const filtered = companies.filter(company => {
      const nameLower = company.company_name.toLowerCase();
      if (activeNames.has(nameLower)) return false;
      if (dynamicsNames.has(nameLower)) return false;
      return true;
    });

    const excludedCount = companies.length - filtered.length;

    // Score each discovered company
    const scoredCompanies = filtered.map(company => {
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

    logActivity('discover', `Found ${scoredCompanies.length} companies (${excludedCount} excluded — already contacted or in deals)`, scoredCompanies.length * 500);

    res.json({
      companies: scoredCompanies,
      excluded: excludedCount,
      excludedReason: excludedCount > 0 ? `${excludedCount} companies filtered out (already contacted or have active deals)` : undefined,
    });
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

    const winPatterns = getWinPatterns();
    const icpCriteria = getIcpCriteria();

    const icpCtx = JSON.stringify(icpCriteria, null, 2);
    const winCtx = `\n## Our Win Patterns\n${JSON.stringify(winPatterns.slice(0, 8), null, 2)}`;

    const companies = await askClaudeJSON<DiscoveredCompany[]>(`
You are a B2B sales intelligence analyst for C3 AI.

Find companies SIMILAR to ${companyName} that would be good prospects for enterprise AI software. Similar means: same or adjacent industry, comparable size, similar operational challenges.

## Our ICP
${icpCtx}
${winCtx}

Using your knowledge of the business landscape, identify up to 5 real companies similar to ${companyName} that match our ICP.

Return a JSON array. Each object needs: company_name, industry, revenue_b, employee_count, headquarters, why_a_fit, signals, ai_posture.
Do NOT include ${companyName} itself. Only include real companies.
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
