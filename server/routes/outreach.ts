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
  logActivity,
} from '../lib/db.js';

export const outreachRouter = Router();

interface OutreachRequest {
  prospectId: number;
  targetTitle?: string;
  tone?: 'executive' | 'professional' | 'technical';
  sequenceLength?: number;
  customContext?: string;
}

interface GeneratedEmail {
  subject: string;
  body: string;
  sequencePosition: number;
  tone: string;
  personaType: string;
  templateBasis: string;
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

    // Find matching persona
    const matchingPersona = personas.find(p => (p.title_pattern as string) === title);

    const personaType = matchingPersona
      ? (matchingPersona.seniority === 'C-Suite' ? 'executive' : matchingPersona.seniority === 'VP' ? 'executive' : 'practitioner')
      : 'executive';

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

## Relevant Case Study
${bestCaseStudy ? `${bestCaseStudy.customer_name} (${bestCaseStudy.industry}): ${bestCaseStudy.summary}\nValue: ${bestCaseStudy.value_delivered}` : 'No case study loaded for this industry.'}

## Win Patterns in ${industry}
${JSON.stringify(winPatterns.slice(0, 3), null, 2)}

## Template Examples (use as inspiration, not copy-paste)
${JSON.stringify(templates.slice(0, 3).map(t => ({ subject: t.subject_line, tone: t.tone, position: t.sequence_position })), null, 2)}

## Persona Notes
${matchingPersona ? JSON.stringify(matchingPersona) : `Target: ${title} (${personaType})`}

## Rules
- Tone: ${tone}
- Emails should be SHORT (under 150 words each)
- First email: create curiosity with a specific signal or data point about THEIR company
- Reference the case study naturally (not "we did X for Y" — make it feel organic)
- Each subsequent email should add new value, not just "following up"
- Last email should be a graceful close (not desperate)
- Use {{sender_name}} as placeholder for the BDR's name
- Subject lines should be under 50 characters, no clickbait
- No buzzwords: no "leverage", "synergy", "paradigm", "best-in-class"
- Write like a human, not a marketing automation tool

Return a JSON array of email objects, each with:
- subject: string
- body: string (the email body, can include line breaks)
- sequencePosition: number (1, 2, 3...)
- tone: "${tone}"
- personaType: "${personaType}"
- templateBasis: which template style this is based on
`, { systemPrompt: 'You are an expert B2B sales copywriter. Return valid JSON arrays only.' });

    // Save drafts to DB
    for (const email of emails) {
      saveDraft({
        prospect_id: prospectId,
        subject: email.subject,
        body: email.body,
        sequence_position: email.sequencePosition,
        tone: email.tone,
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

// Get saved drafts
outreachRouter.get('/drafts', (_req, res) => {
  try {
    const drafts = getDrafts();
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
