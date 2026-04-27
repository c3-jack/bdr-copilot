import { Router } from 'express';
import { getProspects, getProspectById, getTargetIndustries, getWinPatterns, logActivity, updateProspectStatusDb } from '../lib/db.js';
import { scoreProspect } from '../lib/scoring.js';
import * as zoominfo from '../lib/zoominfo.js';
import { generateLinkedInLinks } from '../lib/linkedin.js';

export const pipelineRouter = Router();

// Get all prospects with scoring
pipelineRouter.get('/', (req, res) => {
  try {
    const status = req.query.status as string | undefined;
    const prospects = getProspects(status) as Array<Record<string, unknown>>;

    logActivity('view_pipeline');

    const enriched = prospects.map(p => {
      const signals = p.signals_json ? JSON.parse(p.signals_json as string) : [];
      const scoring = scoreProspect({
        industry: p.industry as string,
        revenue_b: p.revenue_b as number,
        hasAiInitiatives: signals.some((s: string) => /ai|artificial intelligence/i.test(s)),
        hasCloudMigration: signals.some((s: string) => /cloud/i.test(s)),
        hasNewCxoHire: signals.some((s: string) => /cxo|cto|cio|hire/i.test(s)),
      });

      // Calculate days since last update
      const updatedAt = p.updated_at ? new Date(p.updated_at as string) : new Date(p.created_at as string);
      const daysSinceUpdate = Math.floor((Date.now() - updatedAt.getTime()) / (1000 * 60 * 60 * 24));

      return {
        ...p,
        signals,
        score: p.similarity_score ?? scoring.score,
        recommendedUseCase: p.recommended_use_case ?? scoring.recommendedUseCase,
        recommendedTitle: p.recommended_title ?? scoring.recommendedTitle,
        reasoning: scoring.reasoning,
        daysSinceUpdate,
        isStale: daysSinceUpdate > 14,
      };
    });

    res.json({ prospects: enriched });
  } catch (error) {
    const err = error as Error;
    res.status(500).json({ error: err.message });
  }
});

// Get single prospect detail
pipelineRouter.get('/:id', (req, res) => {
  try {
    const prospect = getProspectById(Number(req.params.id));
    if (!prospect) {
      res.status(404).json({ error: 'Prospect not found' });
      return;
    }
    res.json({ prospect });
  } catch (error) {
    const err = error as Error;
    res.status(500).json({ error: err.message });
  }
});

// Update prospect status
pipelineRouter.patch('/:id/status', (req, res) => {
  try {
    const { status } = req.body as { status: string };
    const validStatuses = ['new', 'researched', 'contacted', 'qualified', 'disqualified'];
    if (!validStatuses.includes(status)) {
      res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
      return;
    }

    updateProspectStatusDb(Number(req.params.id), status);

    const prospect = getProspectById(Number(req.params.id));
    res.json({ prospect });
  } catch (error) {
    const err = error as Error;
    res.status(500).json({ error: err.message });
  }
});

// ZoomInfo contacts for a prospect
pipelineRouter.get('/:id/contacts', async (req, res) => {
  try {
    const prospect = getProspectById(Number(req.params.id)) as Record<string, unknown> | undefined;
    if (!prospect) {
      res.status(404).json({ error: 'Prospect not found' });
      return;
    }

    if (!zoominfo.isConfigured()) {
      res.json({ contacts: [], configured: false });
      return;
    }

    const companyName = prospect.company_name as string;
    const title = req.query.title as string | undefined;
    const managementLevel = req.query.level as string | undefined;

    const result = await zoominfo.searchContacts({
      companyName,
      jobTitle: title,
      managementLevel,
      pageSize: 15,
    });

    const contacts = result.data.map(c => ({
      ...c,
      linkedIn: generateLinkedInLinks({
        contactName: c.fullName,
        contactTitle: c.jobTitle,
        companyName,
      }),
    }));

    res.json({ contacts, totalResults: result.totalResults });
  } catch (error) {
    const err = error as Error;
    res.status(500).json({ error: err.message });
  }
});

// ZoomInfo company enrichment
pipelineRouter.get('/:id/enrich', async (req, res) => {
  try {
    const prospect = getProspectById(Number(req.params.id)) as Record<string, unknown> | undefined;
    if (!prospect) {
      res.status(404).json({ error: 'Prospect not found' });
      return;
    }

    if (!zoominfo.isConfigured()) {
      res.json({ company: null, intent: [], configured: false });
      return;
    }

    const companyName = prospect.company_name as string;
    const searchResult = await zoominfo.searchCompanies({ companyName, pageSize: 1 });
    const company = searchResult.data[0] ?? null;

    let intent: zoominfo.ZiIntent[] = [];
    if (company) {
      intent = await zoominfo.getCompanyIntent(company.id).catch(() => []);
    }

    const linkedIn = generateLinkedInLinks({ companyName });

    res.json({ company, intent, linkedIn });
  } catch (error) {
    const err = error as Error;
    res.status(500).json({ error: err.message });
  }
});

// Seed data endpoints (for reference data)
pipelineRouter.get('/ref/industries', (_req, res) => {
  try {
    res.json({ industries: getTargetIndustries() });
  } catch (error) {
    const err = error as Error;
    res.status(500).json({ error: err.message });
  }
});

pipelineRouter.get('/ref/patterns', (_req, res) => {
  try {
    res.json({ patterns: getWinPatterns() });
  } catch (error) {
    const err = error as Error;
    res.status(500).json({ error: err.message });
  }
});
