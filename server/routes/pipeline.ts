import { Router } from 'express';
import { getProspects, getProspectById, getTargetIndustries, getWinPatterns, upsertProspect, logActivity, updateProspectStatusDb } from '../lib/db.js';
import { scoreProspect } from '../lib/scoring.js';
import * as zoominfo from '../lib/zoominfo.js';
import { generateLinkedInLinks } from '../lib/linkedin.js';
import { askClaudeJSON } from '../lib/claude.js';

export const pipelineRouter = Router();

// Reference data endpoints — MUST be before /:id to avoid route shadowing
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

// Sync accounts from Dynamics 365 via Dataverse MCP (browser auth, no credentials needed)
pipelineRouter.post('/sync-dynamics', async (_req, res) => {
  try {
    interface DataverseAccount {
      accountid: string;
      name: string;
      revenue: number | null;
      numberofemployees: number | null;
      industrycode: number | null;
      address1_city: string | null;
      address1_stateorprovince: string | null;
      address1_country: string | null;
    }

    const accounts = await askClaudeJSON<DataverseAccount[]>(`
Use the dataverse_sql tool to run this SQL query against Dynamics 365:

SELECT TOP 50 accountid, name, revenue, numberofemployees, industrycode, address1_city, address1_stateorprovince, address1_country
FROM account
ORDER BY modifiedon DESC

Return the results as a JSON array of objects. Each object should have these exact fields:
accountid, name, revenue, numberofemployees, industrycode, address1_city, address1_stateorprovince, address1_country

If the query returns no results, return an empty array [].
`, {
      systemPrompt: 'You are a data extraction tool. Execute the SQL query using the dataverse_sql tool, then return the raw results as a JSON array. No commentary.',
      useDataverse: true,
    });

    // Dynamics industrycode mapping (Dynamics 365 OptionSet values)
    const INDUSTRY_MAP: Record<number, string> = {
      1: 'Accounting', 2: 'Agriculture', 3: 'Broadcasting & Entertainment',
      4: 'Brokers', 5: 'Building Supply & Retail', 6: 'Business Services',
      7: 'Consulting', 8: 'Consumer Services', 9: 'Design & Creative',
      10: 'Distributors & Dispatchers', 11: 'Insurance', 12: 'Financial Services',
      13: 'Food & Tobacco', 14: 'IT Services', 15: 'Healthcare',
      16: 'Legal', 17: 'Manufacturing', 18: 'Media & Entertainment',
      19: 'Mining', 20: 'Non-Profit', 21: 'Recreation',
      22: 'Retail', 23: 'Government', 24: 'Telecommunications',
      25: 'Transportation', 26: 'Utilities', 27: 'Vehicle Retail',
      28: 'Wholesale', 29: 'Chemicals', 30: 'Construction',
      31: 'Education', 32: 'Engineering', 33: 'Energy',
      // Additional codes used by C3's Dynamics instance
      100000: 'Defense', 100001: 'Aerospace', 100002: 'Pharma',
    };

    let synced = 0;
    for (const account of accounts) {
      const revenue_b = account.revenue ? account.revenue / 1e9 : undefined;
      const industry = account.industrycode ? INDUSTRY_MAP[account.industrycode] : undefined;

      upsertProspect({
        company_name: account.name,
        industry: industry ?? undefined,
        revenue_b: revenue_b && revenue_b > 0 ? revenue_b : undefined,
        employee_count: account.numberofemployees ?? undefined,
        headquarters: [account.address1_city, account.address1_stateorprovince, account.address1_country]
          .filter(Boolean).join(', ') || undefined,
        dynamics_account_id: account.accountid,
        status: 'new',
      });
      synced++;
    }

    logActivity('sync_dynamics', `Synced ${synced} accounts from Dynamics 365`);
    res.json({ synced, total: accounts.length });
  } catch (error) {
    const err = error as Error;
    res.status(500).json({ error: err.message });
  }
});

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

