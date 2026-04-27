import { Router } from 'express';
import { askClaudeJSON } from '../lib/claude.js';
import { researchCompany } from '../lib/tavily.js';
import { scoreProspect } from '../lib/scoring.js';
import {
  getProspectById,
  getCachedResearch,
  cacheResearch,
  getWinPatterns,
  getCaseStudies,
  getPersonas,
  logActivity,
} from '../lib/db.js';

export const researchRouter = Router();

interface ResearchReport {
  companyOverview: string;
  strategicPriorities: string[];
  aiPosture: {
    maturity: 'early' | 'developing' | 'advanced';
    initiatives: string[];
    budget_signals: string[];
  };
  keyStakeholders: Array<{
    title: string;
    why_target: string;
    messaging_angle: string;
  }>;
  recommendedApproach: {
    use_case: string;
    entry_point: string;
    champion_title: string;
    value_prop: string;
    relevant_case_study: string;
    competitive_landscape: string;
  };
  talkingPoints: string[];
  risks: string[];
}

researchRouter.post('/:prospectId', async (req, res) => {
  try {
    const prospectId = Number(req.params.prospectId);
    const prospect = getProspectById(prospectId) as Record<string, unknown> | undefined;

    if (!prospect) {
      res.status(404).json({ error: 'Prospect not found' });
      return;
    }

    // Check cache first
    const cached = getCachedResearch(prospectId) as Record<string, unknown> | undefined;
    if (cached) {
      logActivity('research_cached', prospect.company_name as string);
      res.json(JSON.parse(cached.research_json as string));
      return;
    }

    logActivity('research', prospect.company_name as string);

    const companyName = prospect.company_name as string;
    const industry = prospect.industry as string;

    // Research the company via Tavily
    const research = await researchCompany(companyName);

    // Get relevant context from seed data
    const winPatterns = getWinPatterns() as Array<Record<string, unknown>>;
    const caseStudies = getCaseStudies(industry) as Array<Record<string, unknown>>;
    const personas = getPersonas() as Array<Record<string, unknown>>;

    const relevantPatterns = winPatterns.filter(p => p.industry === industry).slice(0, 5);
    const relevantPersonas = personas.filter(p => {
      const matchingPattern = relevantPatterns.find(wp => wp.use_case === p.use_case);
      return matchingPattern;
    }).slice(0, 5);

    // Generate deep research report via Claude
    const report = await askClaudeJSON<ResearchReport>(`
You are an enterprise sales strategist at C3 AI. Generate a deep research report for prospecting ${companyName}.

## Company Context
- Industry: ${industry}
- Revenue: $${prospect.revenue_b}B
- Detected Signals: ${prospect.signals_json}

## Recent News
${research.news.map(r => `- ${r.title}: ${r.content.slice(0, 300)}`).join('\n')}

## AI-Related Intelligence
${research.aiSignals.map(r => `- ${r.title}: ${r.content.slice(0, 300)}`).join('\n')}

## Financial Intelligence
${research.financials.map(r => `- ${r.title}: ${r.content.slice(0, 300)}`).join('\n')}

## Our Win Patterns in ${industry}
${JSON.stringify(relevantPatterns, null, 2)}

## Relevant Case Studies
${JSON.stringify(caseStudies, null, 2)}

## Best Personas to Target
${JSON.stringify(relevantPersonas, null, 2)}

Generate a JSON research report with these fields:
- companyOverview: 2-3 sentence overview of the company and what they do
- strategicPriorities: array of their current strategic priorities
- aiPosture: object with maturity ("early"|"developing"|"advanced"), initiatives (array), budget_signals (array)
- keyStakeholders: array of objects with title, why_target, messaging_angle (suggest 3-4 titles to target)
- recommendedApproach: object with use_case, entry_point (C3 product), champion_title, value_prop (tailored to them), relevant_case_study (from our case studies), competitive_landscape
- talkingPoints: array of 4-5 specific talking points for the first meeting
- risks: array of potential objections or risks

Be specific to ${companyName} — no generic advice.
`, { systemPrompt: 'You are an enterprise sales strategist. Return valid JSON only.' });

    // Cache the research
    const result = { report, research, prospect };
    cacheResearch(prospectId, 'deep', JSON.stringify(result));

    logActivity('research', `Completed for ${companyName}`, 2000);
    res.json(result);
  } catch (error) {
    const err = error as Error;
    res.status(500).json({ error: err.message });
  }
});

// Quick research (lighter weight, no Claude)
researchRouter.get('/quick/:prospectId', async (req, res) => {
  try {
    const prospectId = Number(req.params.prospectId);
    const prospect = getProspectById(prospectId) as Record<string, unknown> | undefined;

    if (!prospect) {
      res.status(404).json({ error: 'Prospect not found' });
      return;
    }

    const companyName = prospect.company_name as string;
    const research = await researchCompany(companyName);

    const scoring = scoreProspect({
      industry: prospect.industry as string,
      revenue_b: prospect.revenue_b as number,
    });

    res.json({
      prospect,
      research,
      scoring,
    });
  } catch (error) {
    const err = error as Error;
    res.status(500).json({ error: err.message });
  }
});
