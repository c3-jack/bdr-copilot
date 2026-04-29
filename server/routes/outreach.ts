import { Router } from 'express';
import { askClaudeJSON } from '../lib/claude.js';
import {
  getProspectById,
  getCachedResearch,
  getOutreachTemplates,
  getCaseStudies,
  getPersonas,
  getWinPatterns,
  saveDraft,
  getDrafts,
  getDraftsGrouped,
  logActivity,
  getStyleSamplesForPrompt,
} from '../lib/db.js';

export const outreachRouter = Router();

interface OutreachRequest {
  prospectId: number;
  targetTitle?: string;
  tone?: 'executive' | 'professional' | 'technical';
  sequenceLength?: number;
  customContext?: string;
}

interface Citation {
  claim: string;
  source: string;
  sourceType: 'case_study' | 'sharepoint' | 'web' | 'seed_data';
  url?: string;
}

interface GeneratedEmail {
  subject: string;
  body: string;
  sequencePosition: number;
  tone: string;
  personaType: string;
  templateBasis: string;
  citations: Citation[];
}

outreachRouter.post('/generate', async (req, res) => {
  try {
    const {
      prospectId,
      targetTitle,
      tone = 'executive',
      sequenceLength = 3,
      customContext,
    } = req.body as OutreachRequest;

    const prospect = getProspectById(prospectId) as Record<string, unknown> | undefined;
    if (!prospect) {
      res.status(404).json({ error: 'Prospect not found' });
      return;
    }

    const companyName = prospect.company_name as string;
    const industry = prospect.industry as string;
    const useCase = prospect.recommended_use_case as string;
    const title = targetTitle ?? prospect.recommended_title as string;

    logActivity('draft_outreach', `${companyName} - ${title}`);

    // Gather context
    const cached = getCachedResearch(prospectId) as Record<string, unknown> | undefined;
    const templates = getOutreachTemplates(tone, useCase) as Array<Record<string, unknown>>;
    const caseStudies = getCaseStudies(industry) as Array<Record<string, unknown>>;
    const personas = getPersonas(useCase) as Array<Record<string, unknown>>;
    const winPatterns = (getWinPatterns() as Array<Record<string, unknown>>)
      .filter(p => p.industry === industry);

    // Find best case study (prefer public ones)
    const bestCaseStudy = caseStudies.find(cs => cs.is_public) ?? caseStudies[0];

    // Find matching persona (fuzzy — check if title contains the pattern or vice versa)
    const titleLower = (title ?? '').toLowerCase();
    const matchingPersona = personas.find(p => {
      const pattern = (p.title_pattern as string).toLowerCase();
      return pattern === titleLower || titleLower.includes(pattern) || pattern.includes(titleLower);
    });

    const personaType = matchingPersona
      ? (matchingPersona.seniority === 'C-Suite' ? 'executive' : matchingPersona.seniority === 'VP' ? 'executive' : 'practitioner')
      : 'executive';

    // Gather writing style samples
    const styleSamples = getStyleSamplesForPrompt();

    const emails = await askClaudeJSON<GeneratedEmail[]>(`
You are a world-class B2B sales copywriter at C3 AI, writing outreach emails to enterprise executives.

Generate a ${sequenceLength}-email sequence for reaching out to the ${title} at ${companyName}.

## Company Context
- Company: ${companyName}
- Industry: ${industry}
- Revenue: $${prospect.revenue_b}B
- Signals: ${prospect.signals_json ?? '[]'}
- Recommended Use Case: ${useCase}

${cached ? `## Research Intelligence\n${(cached.research_json as string).slice(0, 2000)}` : ''}

${customContext ? `## Additional Context from BDR\n${customContext}` : ''}

## Available Case Studies (CITE these when making claims)
${caseStudies.length > 0 ? caseStudies.map(cs => `- ${cs.customer_name} (${cs.industry}, ${cs.is_public ? 'PUBLIC' : 'CONFIDENTIAL'}): ${cs.summary}. Value: ${cs.value_delivered}${cs.collateral_url ? `. URL: ${cs.collateral_url}` : ''}`).join('\n') : 'No case studies loaded for this industry.'}

## Win Patterns in ${industry}
${JSON.stringify(winPatterns.slice(0, 3), null, 2)}

## Template Examples (use as inspiration, not copy-paste)
${JSON.stringify(templates.slice(0, 3).map(t => ({ subject: t.subject_line, tone: t.tone, position: t.sequence_position })), null, 2)}

## Persona Notes
${matchingPersona ? JSON.stringify(matchingPersona) : `Target: ${title} (${personaType})`}
${styleSamples.length > 0 ? `
## Your Writing Style (match this voice closely)
${styleSamples.map((s, i) => `Example ${i + 1}:\n${s}`).join('\n\n')}
` : ''}
## Rules
- Tone: ${tone}
- Emails should be SHORT (under 150 words each)
- First email: create curiosity with a specific signal or data point about THEIR company
- Reference case studies naturally (not "we did X for Y" — make it feel organic)
- CITATIONS: For EVERY statistical claim, ROI figure, or customer reference, you MUST include a citation. Cite from the case studies above.
- Only cite PUBLIC case studies by name. For CONFIDENTIAL ones, say "a major ${industry} company"
- Each subsequent email should add new value, not just "following up"
- Last email should be a graceful close (not desperate)
- Use {{sender_name}} as placeholder for the BDR's name
- Subject lines should be under 50 characters, no clickbait
- No buzzwords: no "leverage", "synergy", "paradigm", "best-in-class"
- Write like a human, not a marketing automation tool
${styleSamples.length > 0 ? '- Match the writing style examples above — same sentence length, formality, and personality' : ''}

Return a JSON array of email objects, each with:
- subject: string
- body: string (the email body, can include line breaks)
- sequencePosition: number (1, 2, 3...)
- tone: "${tone}"
- personaType: "${personaType}"
- templateBasis: which template style this is based on
- citations: array of {claim: string, source: string, sourceType: "case_study" or "seed_data", url: string or null}
`, { systemPrompt: 'You are an expert B2B sales copywriter. Return valid JSON arrays only.' });

    // Save drafts to DB
    for (const email of emails) {
      saveDraft({
        prospect_id: prospectId,
        subject: email.subject,
        body: email.body,
        sequence_position: email.sequencePosition,
        tone: email.tone,
        citations_json: email.citations ? JSON.stringify(email.citations) : undefined,
      });
    }

    logActivity('draft_outreach', `Generated ${emails.length} emails for ${companyName}`, emails.length * 500);

    res.json({
      emails,
      context: {
        companyName,
        industry,
        useCase,
        targetTitle: title,
        caseStudy: bestCaseStudy ? bestCaseStudy.customer_name : null,
      },
    });
  } catch (error) {
    const err = error as Error;
    res.status(500).json({ error: err.message });
  }
});

// Get saved drafts (with company info when no filter)
outreachRouter.get('/drafts', (_req, res) => {
  try {
    const drafts = getDraftsGrouped();
    res.json({ drafts });
  } catch (error) {
    const err = error as Error;
    res.status(500).json({ error: err.message });
  }
});

outreachRouter.get('/drafts/:prospectId', (req, res) => {
  try {
    const drafts = getDrafts(Number(req.params.prospectId));
    res.json({ drafts });
  } catch (error) {
    const err = error as Error;
    res.status(500).json({ error: err.message });
  }
});
