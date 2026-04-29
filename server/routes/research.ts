import { Router } from 'express';
import { askClaude, askClaudeJSON } from '../lib/claude.js';
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
import * as zoominfo from '../lib/zoominfo.js';
import { searchEngagementDocs, findSimilarEngagements } from '../lib/sharepoint.js';
import { generateLinkedInLinks } from '../lib/linkedin.js';

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

    // Run research sources in parallel
    const [researchText, ziCompanyResult, engagementDocs, pastEngagements] = await Promise.all([
      askClaude(`Research ${companyName} (${industry} industry).

Search SharePoint and Confluence for any internal documents, account plans, or past engagement notes about ${companyName}. Also search for general intelligence.

Provide:
1) Any internal C3 AI context on this company (past deals, meetings, proposals)
2) Recent news and strategic moves
3) AI and digital transformation initiatives
4) Financial performance and outlook

Be specific and factual. Clearly label which information came from internal sources vs general knowledge.`,
        { systemPrompt: 'You are a business intelligence researcher with access to SharePoint and Confluence via MCP tools. Use them to find internal documents. Be concise and factual.', useMcp: true }
      ).then(r => r.text),
      zoominfo.isConfigured()
        ? zoominfo.searchCompanies({ companyName }).catch(() => ({ data: [], totalResults: 0 }))
        : Promise.resolve({ data: [], totalResults: 0 }),
      searchEngagementDocs({ companyName, industry }).catch(() => []),
      findSimilarEngagements({ targetCompany: companyName, industry }).catch(() => []),
    ]);

    // If we found the company in ZoomInfo, get contacts and intent
    const ziCompany = ziCompanyResult.data[0] ?? null;
    let ziContacts: zoominfo.ZiContact[] = [];
    let ziIntent: zoominfo.ZiIntent[] = [];
    if (ziCompany && zoominfo.isConfigured()) {
      const [contactsResult, intentResult] = await Promise.all([
        zoominfo.searchContacts({ companyId: ziCompany.id, managementLevel: 'C-Level' }).catch(() => ({ data: [], totalResults: 0 })),
        zoominfo.getCompanyIntent(ziCompany.id).catch(() => []),
      ]);
      ziContacts = contactsResult.data;
      ziIntent = intentResult;
    }

    // Generate LinkedIn links for each stakeholder contact
    const linkedInLinks = ziContacts.slice(0, 5).map(c => ({
      contact: { name: c.fullName, title: c.jobTitle, email: c.email },
      links: generateLinkedInLinks({
        contactName: c.fullName,
        contactTitle: c.jobTitle,
        companyName,
      }),
    }));

    // Also generate a general company LinkedIn link
    const companyLinkedIn = generateLinkedInLinks({ companyName });

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

## Company Research
${researchText}

## Our Win Patterns in ${industry}
${JSON.stringify(relevantPatterns, null, 2)}

## Relevant Case Studies
${JSON.stringify(caseStudies, null, 2)}

## Best Personas to Target
${JSON.stringify(relevantPersonas, null, 2)}

${ziCompany ? `## ZoomInfo Company Data
- Revenue: $${ziCompany.revenue?.toLocaleString() ?? 'N/A'}
- Employees: ${ziCompany.employeeCount ?? 'N/A'}
- Sub-Industry: ${ziCompany.subIndustry ?? 'N/A'}
- SIC: ${ziCompany.sicCode ?? 'N/A'} | NAICS: ${ziCompany.naicsCode ?? 'N/A'}
- HQ: ${ziCompany.city}, ${ziCompany.state}, ${ziCompany.country}
- Description: ${ziCompany.description ?? 'N/A'}
- Parent: ${ziCompany.parentCompany ?? 'N/A'} | Ultimate Parent: ${ziCompany.ultimateParent ?? 'N/A'}` : ''}

${ziContacts.length > 0 ? `## ZoomInfo Key Contacts (C-Level)
${ziContacts.slice(0, 8).map(c => `- ${c.fullName} — ${c.jobTitle} (${c.jobFunction})`).join('\n')}` : ''}

${ziIntent.length > 0 ? `## ZoomInfo Intent Signals
${ziIntent.slice(0, 5).map(i => `- ${i.topicName}: score ${i.signalScore} (${i.audienceStrength})`).join('\n')}` : ''}

${engagementDocs.length > 0 ? `## Past SharePoint Engagement Docs
${engagementDocs.slice(0, 5).map(d => `- [${d.type}] ${d.title}: ${d.summary}`).join('\n')}` : ''}

${pastEngagements.length > 0 ? `## Similar Past Engagements
${pastEngagements.slice(0, 5).map(e => `- ${e.customerName} (${e.industry}): ${e.useCase} — ${e.outcome}`).join('\n')}` : ''}

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
    const result = {
      report,
      prospect,
      zoominfo: ziCompany ? {
        company: ziCompany,
        contacts: ziContacts,
        intent: ziIntent,
      } : null,
      sharepoint: {
        docs: engagementDocs,
        pastEngagements,
      },
      linkedin: {
        companyLinks: companyLinkedIn,
        contactLinks: linkedInLinks,
      },
    };
    cacheResearch(prospectId, 'deep', JSON.stringify(result));

    logActivity('research', `Completed for ${companyName}`, 2000);
    res.json(result);
  } catch (error) {
    const err = error as Error;
    res.status(500).json({ error: err.message });
  }
});

// Deep timing intelligence — two-pass: (1) search web+SharePoint, (2) synthesize JSON
researchRouter.post('/:prospectId/timing', async (req, res) => {
  // Extend Express response timeout for this long-running endpoint
  res.setTimeout(360_000);

  try {
    const prospectId = Number(req.params.prospectId);
    const force = req.query.force === 'true';
    const prospect = getProspectById(prospectId) as Record<string, unknown> | undefined;

    if (!prospect) {
      res.status(404).json({ error: 'Prospect not found' });
      return;
    }

    // Check 24h cache (timing data is more perishable than deep research)
    if (!force) {
      const cached = getCachedResearch(prospectId, 'timing');
      if (cached) {
        logActivity('timing_cached', prospect.company_name as string);
        res.json(JSON.parse(cached.research_json as string));
        return;
      }
    }

    const companyName = prospect.company_name as string;
    const industry = prospect.industry as string;
    const useCase = (prospect.recommended_use_case as string) ?? 'enterprise AI';

    logActivity('timing_research', companyName);

    // ── PASS 1: Raw research (search-heavy, returns text) ──
    // Run web research and SharePoint research in parallel
    const [webResearch, internalResearch] = await Promise.all([
      // Web search for public signals
      askClaude(`Research timing signals for selling enterprise AI software to ${companyName} (${industry}).

Search the web for:
1. Fiscal year end date (check 10-K filings or investor relations page)
2. Recent earnings calls mentioning AI, ML, predictive analytics, digital transformation (last 2 quarters)
3. Leadership changes: new CIO, CTO, CDO, VP Operations, VP Supply Chain hires (last 12 months)
4. Cloud migration announcements (AWS, Azure, GCP partnerships)
5. AI/ML job postings — search for "${companyName} AI engineer" or "${companyName} data scientist" on job boards
6. Existing AI/ML vendor relationships (Palantir, DataRobot, Dataiku, SAS, or in-house platforms)
7. M&A activity, restructuring, or major strategic initiatives
8. Any RFPs, RFIs, or procurement notices related to AI or analytics
9. Conference presentations by ${companyName} employees about AI strategy
10. Major operational incidents (downtime, safety, supply chain disruption) creating urgency

For EVERY finding, include the source URL where you found it. If you cannot provide a real URL, skip that finding entirely.

Return your findings as a plain text report organized by category. Include dates and URLs inline.`,
        { systemPrompt: 'You are a web researcher. Use web search tools to find factual, current information. Only report findings you can link to a real source URL. Skip anything you cannot verify.', useMcp: true }
      ).then(r => r.text),

      // SharePoint/Confluence for internal engagement history
      askClaude(`Search SharePoint and Confluence for internal C3 AI documents about ${companyName} or similar ${industry} companies.

Find:
1. Past engagement docs, meeting notes, or account plans for ${companyName}
2. Who was the economic buyer (the person who signed the deal) in past ${industry} deals — not just the POC or technical contact
3. Any proposals, SOWs, or pricing discussions
4. Past deal outcomes — won, lost, stalled, and why

For each document found, include its SharePoint/Confluence URL.

Return findings as plain text with URLs.`,
        { systemPrompt: 'You are a sales research assistant. Search SharePoint and Confluence using MCP tools. Report only what you actually find in documents. If nothing exists, say so.', useMcp: true }
      ).then(r => r.text).catch(() => 'No internal documents found.'),
    ]);

    // ── PASS 2: Synthesize into structured JSON (no tool use, just analysis) ──
    const timing = await askClaudeJSON<TimingIntelligence>(`
Analyze the following research about ${companyName} and produce a structured timing intelligence report for a BDR selling C3 AI (enterprise AI platform for ${useCase}).

## Web Research Findings
${webResearch}

## Internal Engagement History (from SharePoint/Confluence)
${internalResearch}

## Instructions
Synthesize the research above into the JSON schema below. CRITICAL RULES:
- Only include information that appears in the research findings above
- Every triggerEvent and championSignal MUST have a url field copied from the research. If a finding had no URL, DO NOT include it.
- Do NOT invent, guess, or construct URLs
- If a section has no verified data, return an empty array
- Distinguish between the economic buyer (signs the check, VP+ level) and coaches/POCs (technical contacts who influence but don't decide)

Return JSON with these fields:
{
  "fiscalYearEnd": "month name or 'unknown'",
  "budgetPhase": "planning | allocated | frozen | new-fy | unknown",
  "triggerEvents": [{"event": "string", "date": "string", "significance": "high|medium|low", "source": "string", "url": "string", "confidence": "verified|inferred"}],
  "competitiveLandscape": {
    "currentTools": ["string"],
    "contractRenewals": [{"vendor": "string", "estimatedDate": "string", "source": "string"}],
    "vulnerability": "string"
  },
  "buyerMap": [{"name": "string", "title": "string", "role": "economic-buyer|champion|evaluator|coach|blocker", "signal": "string", "source": "string", "url": "string"}],
  "priorEngagement": {"lastContactDate": "string or null", "stage": "string or null", "outcome": "string or null", "keyContacts": ["string"]},
  "jobPostings": [{"title": "string", "relevance": "string", "url": "string"}],
  "recommendedTimingWindow": {
    "window": "specific month/quarter",
    "reasoning": "string",
    "urgency": "strike-now|warming|early-stage|not-ready",
    "confidence": "high|medium|low",
    "revisitDate": "string — when to re-check if not ready now"
  },
  "outreachStrategy": {
    "channel": "email|linkedin|warm-intro|event",
    "hook": "the specific trigger event to reference",
    "timing": "specific week or month",
    "opener": "one sentence opening line"
  },
  "nextEarningsDate": "string or null"
}
`, { systemPrompt: 'You are a sales analyst. Return valid JSON only. Only use data from the research provided — do not add information not present in the findings.' });

    // ── PASS 3: Validate URLs ──
    const validated = await validateTimingUrls(timing);

    // Cache and return
    const result = { timing: validated, prospect };
    cacheResearch(prospectId, 'timing', JSON.stringify(result));
    logActivity('timing_research', `Completed for ${companyName}`, 3000);

    res.json(result);
  } catch (error) {
    const err = error as Error;
    const isTimeout = err.message?.includes('timed out') || err.message?.includes('ETIMEDOUT');
    const isAuth = err.message?.includes('auth') || err.message?.includes('login') || err.message?.includes('browser');
    res.status(isTimeout ? 504 : isAuth ? 401 : 500).json({
      error: err.message,
      code: isTimeout ? 'TIMEOUT' : isAuth ? 'AUTH_REQUIRED' : 'INTERNAL',
      retryable: isTimeout,
    });
  }
});

/** Validate URLs in timing data — strip any that 404. */
async function validateTimingUrls(timing: TimingIntelligence): Promise<TimingIntelligence> {
  const checkUrl = async (url: string): Promise<boolean> => {
    try {
      const resp = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(5000) });
      return resp.ok || resp.status === 405 || resp.status === 403; // some sites block HEAD but page exists
    } catch {
      return false;
    }
  };

  // Validate trigger event URLs in parallel
  if (timing.triggerEvents?.length) {
    const results = await Promise.all(
      timing.triggerEvents.map(async t => ({ ...t, urlValid: await checkUrl(t.url) }))
    );
    timing.triggerEvents = results.filter(t => t.urlValid).map(({ urlValid: _, ...t }) => t);
  }

  // Validate buyer map URLs
  if (timing.buyerMap?.length) {
    const results = await Promise.all(
      timing.buyerMap.map(async b => ({ ...b, urlValid: b.url ? await checkUrl(b.url) : true }))
    );
    timing.buyerMap = results.filter(b => b.urlValid).map(({ urlValid: _, ...b }) => b);
  }

  // Validate job posting URLs
  if (timing.jobPostings?.length) {
    const results = await Promise.all(
      timing.jobPostings.map(async j => ({ ...j, urlValid: await checkUrl(j.url) }))
    );
    timing.jobPostings = results.filter(j => j.urlValid).map(({ urlValid: _, ...j }) => j);
  }

  return timing;
}

interface TimingIntelligence {
  fiscalYearEnd: string;
  budgetPhase: 'planning' | 'allocated' | 'frozen' | 'new-fy' | 'unknown';
  triggerEvents: Array<{ event: string; date: string; significance: 'high' | 'medium' | 'low'; source: string; url: string; confidence: 'verified' | 'inferred' }>;
  competitiveLandscape: { currentTools: string[]; contractRenewals: Array<{ vendor: string; estimatedDate: string; source: string }>; vulnerability: string };
  buyerMap: Array<{ name: string; title: string; role: 'economic-buyer' | 'champion' | 'evaluator' | 'coach' | 'blocker'; signal: string; source: string; url: string }>;
  priorEngagement: { lastContactDate: string | null; stage: string | null; outcome: string | null; keyContacts: string[] };
  jobPostings: Array<{ title: string; relevance: string; url: string }>;
  recommendedTimingWindow: { window: string; reasoning: string; urgency: 'strike-now' | 'warming' | 'early-stage' | 'not-ready'; confidence: 'high' | 'medium' | 'low'; revisitDate: string };
  outreachStrategy: { channel: string; hook: string; timing: string; opener: string };
  nextEarningsDate: string | null;
}

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

    const researchText = await askClaude(
      `Quick overview of ${companyName}: check SharePoint/Confluence for any internal notes, then summarize what they do, recent news, any AI/digital transformation activity. 3-4 paragraphs max.`,
      { systemPrompt: 'You are a business intelligence researcher with access to SharePoint and Confluence via MCP tools. Use them for internal context. Be concise and factual.', useMcp: true }
    );

    const scoring = scoreProspect({
      industry: prospect.industry as string,
      revenue_b: prospect.revenue_b as number,
    });

    res.json({
      prospect,
      research: researchText.text,
      scoring,
    });
  } catch (error) {
    const err = error as Error;
    res.status(500).json({ error: err.message });
  }
});
