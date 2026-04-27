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
