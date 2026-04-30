import { Router } from 'express';
import { askClaude, askClaudeJSON } from '../lib/claude.js';
import { saveDraft, logActivity, getStyleSamplesForPrompt, getCaseStudies } from '../lib/db.js';

export const batchRouter = Router();

interface CsvContact {
  firstName: string;
  lastName: string;
  fullName: string;
  jobTitle: string;
  jobFunction: string;
  managementLevel: string;
  companyName: string;
  email: string;
  phone: string;
  industry: string;
  subIndustry: string;
  revenue: string;
  employeeCount: string;
  city: string;
  state: string;
  country: string;
  linkedinUrl: string;
  companyUrl: string;
  // catch-all for extra ZoomInfo fields
  [key: string]: string;
}

interface BatchEmail {
  subject: string;
  body: string;
}

// Parse CSV text into array of objects (handles quoted fields with commas)
function parseCsv(text: string): Record<string, string>[] {
  const lines = text.split('\n').filter(l => l.trim());
  if (lines.length < 2) return [];

  // Parse header — normalize to camelCase
  const rawHeaders = parseCsvLine(lines[0]);
  const headers = rawHeaders.map(h => normalizeCsvHeader(h));

  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i]);
    const row: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = (values[j] ?? '').trim();
    }
    rows.push(row);
  }
  return rows;
}

function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      fields.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  fields.push(current);
  return fields;
}

// Normalize ZoomInfo CSV headers to camelCase field names
function normalizeCsvHeader(header: string): string {
  const map: Record<string, string> = {
    'first name': 'firstName', 'last name': 'lastName', 'full name': 'fullName',
    'job title': 'jobTitle', 'job function': 'jobFunction', 'management level': 'managementLevel',
    'company name': 'companyName', 'email address': 'email', 'email': 'email',
    'direct phone number': 'phone', 'phone': 'phone', 'mobile phone': 'phone',
    'industry': 'industry', 'sub industry': 'subIndustry',
    'revenue': 'revenue', 'revenue (in 000s)': 'revenue', 'revenue range': 'revenue',
    'employee count': 'employeeCount', 'number of employees': 'employeeCount',
    'city': 'city', 'state': 'state', 'state/province': 'state',
    'country': 'country', 'country/region': 'country',
    'linkedin url': 'linkedinUrl', 'person linkedin url': 'linkedinUrl',
    'website': 'companyUrl', 'company url': 'companyUrl',
    'contact linkedin url': 'linkedinUrl',
    'company linkedin url': 'companyLinkedinUrl',
    'zi contact id': 'ziContactId', 'zi company id': 'ziCompanyId',
  };
  const normalized = header.trim().toLowerCase().replace(/[_\-]/g, ' ');
  return map[normalized] ?? normalized.replace(/\s+(.)/g, (_, c) => c.toUpperCase());
}

// Map raw CSV row to typed contact
function mapContact(row: Record<string, string>): CsvContact {
  return {
    firstName: row.firstName ?? '',
    lastName: row.lastName ?? '',
    fullName: row.fullName ?? `${row.firstName ?? ''} ${row.lastName ?? ''}`.trim(),
    jobTitle: row.jobTitle ?? '',
    jobFunction: row.jobFunction ?? '',
    managementLevel: row.managementLevel ?? '',
    companyName: row.companyName ?? '',
    email: row.email ?? '',
    phone: row.phone ?? '',
    industry: row.industry ?? '',
    subIndustry: row.subIndustry ?? '',
    revenue: row.revenue ?? '',
    employeeCount: row.employeeCount ?? '',
    city: row.city ?? '',
    state: row.state ?? '',
    country: row.country ?? '',
    linkedinUrl: row.linkedinUrl ?? '',
    companyUrl: row.companyUrl ?? '',
    ...row,
  };
}

// POST /api/batch/preview — parse CSV and return contacts for review
batchRouter.post('/preview', (req, res) => {
  try {
    const { csv } = req.body as { csv: string };
    if (!csv) {
      res.status(400).json({ error: 'csv text is required' });
      return;
    }
    const rows = parseCsv(csv);
    const contacts = rows.map(mapContact).filter(c => c.companyName && (c.firstName || c.fullName));
    res.json({ contacts, total: rows.length, valid: contacts.length });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// POST /api/batch/generate — generate personalized emails for selected contacts
batchRouter.post('/generate', async (req, res) => {
  res.setTimeout(600_000); // 10 min for batch

  try {
    const { contacts, tone = 'professional', senderName } = req.body as {
      contacts: CsvContact[];
      tone?: string;
      senderName?: string;
    };

    if (!contacts?.length) {
      res.status(400).json({ error: 'contacts array is required' });
      return;
    }

    logActivity('batch_outreach', `Batch of ${contacts.length} contacts`);

    const styleSamples = getStyleSamplesForPrompt();
    const results: Array<{ contact: CsvContact; email: BatchEmail; error?: string }> = [];

    // Process in batches of 5 to avoid overwhelming Claude
    const BATCH_SIZE = 5;
    for (let i = 0; i < contacts.length; i += BATCH_SIZE) {
      const batch = contacts.slice(i, i + BATCH_SIZE);

      const batchResults = await Promise.all(batch.map(async (contact) => {
        try {
          // Get case studies for this contact's industry
          const caseStudies = getCaseStudies(contact.industry) as Array<Record<string, unknown>>;
          const publicStudies = caseStudies.filter(cs => cs.is_public);

          // Quick web research for the company (lightweight — no MCP, just Claude's knowledge)
          const companyContext = await askClaude(
            `In 2-3 sentences, what does ${contact.companyName} do and what are their current strategic priorities? Industry: ${contact.industry}. Be specific and factual.`,
            { systemPrompt: 'Be concise. 2-3 sentences only.' }
          ).then(r => r.text).catch(() => '');

          const contactContext = `
## Contact Details
- Name: ${contact.fullName || contact.firstName}
- Title: ${contact.jobTitle}
- Function: ${contact.jobFunction}
- Level: ${contact.managementLevel}
- Company: ${contact.companyName}
- Industry: ${contact.industry}${contact.subIndustry ? ` (${contact.subIndustry})` : ''}
- Revenue: ${contact.revenue || 'unknown'}
- Employees: ${contact.employeeCount || 'unknown'}
- Location: ${[contact.city, contact.state, contact.country].filter(Boolean).join(', ')}

## Company Context
${companyContext}

## Reference Case Studies (cite naturally if relevant)
${publicStudies.length > 0 ? publicStudies.map(cs => `- ${cs.customer_name}: ${cs.value_delivered} (${cs.summary})`).join('\n') : 'No matching case studies.'}`;

          const styleContext = styleSamples.length > 0
            ? `\n## Writing Style (match this voice)\n${styleSamples.map((s, j) => `Example ${j + 1}:\n${s}`).join('\n\n')}\n`
            : '';

          // ── PASS 1: Generate draft ──
          const draft = await askClaudeJSON<BatchEmail>(`
Write a personalized cold outreach email to ${contact.fullName || contact.firstName + ' ' + contact.lastName}, ${contact.jobTitle} at ${contact.companyName}.
${contactContext}
${styleContext}
## Rules
- Tone: ${tone}
- Under 120 words
- Reference something specific about THEIR company or role
- If you reference a case study stat, it must come from the list above
- No buzzwords, no "leverage/synergy/paradigm"
- Use ${senderName ?? '{{sender_name}}'} as the sender
- Write like a human, not a bot
${styleSamples.length > 0 ? '- CRITICAL: This email must sound like the BDR wrote it. Study the writing style examples above — match their sentence structure, word choice, sign-off style, and personality exactly. If they write short punchy sentences, you do too. If they use em dashes, you do too.' : ''}

Return JSON: {"subject": "string", "body": "string"}
`, { systemPrompt: 'Expert B2B sales copywriter. Return valid JSON only.' });

          // ── PASS 2: Critic reviews and rewrites ──
          const email = await askClaudeJSON<BatchEmail>(`
You are a senior sales writing coach. Review this cold outreach email draft and rewrite it to be significantly better.

## The Draft
Subject: ${draft.subject}
Body:
${draft.body}

## Who This Is For
${contactContext}
${styleContext}
## Critique Checklist — fix ALL of these:
1. PERSONALIZATION: Does it reference something specific about ${contact.companyName} or this person's role? Generic intros like "I noticed your company is a leader in..." are lazy. Find a real angle.
2. OPENING LINE: Would you actually read past the first sentence? If it starts with "I'm reaching out because" or "My name is" — rewrite it. Start with THEM, not you.
3. VOICE: This email must read like the BDR wrote it themselves — not like AI. ${styleSamples.length > 0 ? 'Study the writing style examples carefully. Match their exact sentence length, punctuation habits, how they open and close emails, their level of formality, and their personality. If they use sentence fragments, you use sentence fragments. If they sign off with just their first name, you do too.' : 'Write like a real human — casual, direct, slightly cheeky.'}
4. LENGTH: Must be under 120 words. Cut ruthlessly. Every sentence must earn its place.
5. ASK: Is there a clear, low-friction ask? Not "I'd love to schedule a call" (too much commitment). Better: "Worth a 15-min look?" or a question that provokes a reply.
6. SUBJECT LINE: Under 50 chars, no clickbait, makes them curious enough to open.
7. CASE STUDIES: If a stat is referenced, does it come from the provided case studies? Remove any fabricated claims.
8. BUZZWORDS: Remove "leverage", "synergy", "paradigm", "best-in-class", "innovative", "cutting-edge", "revolutionize", "transform". Use plain language.

Rewrite the email applying your critique. Return JSON: {"subject": "string", "body": "string"}
`, { systemPrompt: 'Senior sales writing coach. Critique then rewrite. Return valid JSON only — the improved email.' });

          // Save final version as draft
          saveDraft({
            prospect_id: 0,
            subject: email.subject,
            body: email.body.replace(/\{\{sender_name\}\}/g, senderName ?? '{{sender_name}}'),
            tone,
          });

          return { contact, email };
        } catch (err) {
          return { contact, email: { subject: '', body: '' }, error: (err as Error).message };
        }
      }));

      results.push(...batchResults);
    }

    const successful = results.filter(r => !r.error).length;
    logActivity('batch_outreach', `Generated ${successful}/${contacts.length} emails`, successful * 500);

    res.json({ results, successful, failed: contacts.length - successful });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});
