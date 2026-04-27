import { Router } from 'express';
import { existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import {
  getWinPatterns,
  getIcpCriteria,
  getTargetIndustries,
  getCaseStudies,
  getPersonas,
  getOutreachTemplates,
  getProspects,
} from '../lib/db.js';
import { isConfigured as ziConfigured } from '../lib/zoominfo.js';
import { isConfigured as dynConfigured } from '../lib/dynamics.js';

export const homeRouter = Router();

homeRouter.get('/stats', (_req, res) => {
  const wins = getWinPatterns() as Array<Record<string, unknown>>;
  const icp = getIcpCriteria();
  const industries = getTargetIndustries() as Array<Record<string, unknown>>;
  const caseStudies = getCaseStudies() as Array<Record<string, unknown>>;
  const personas = getPersonas() as Array<Record<string, unknown>>;
  const templates = getOutreachTemplates();
  const prospects = getProspects();

  res.json({
    seedData: {
      winPatterns: wins.length,
      icpCriteria: icp.length,
      targetIndustries: industries.length,
      caseStudies: caseStudies.length,
      personas: personas.length,
      outreachTemplates: templates.length,
    },
    prospects: prospects.length,
    integrations: {
      zoominfo: ziConfigured(),
      dynamics: dynConfigured(),
      dataverse: existsSync(join(homedir(), 'c3ai-dataverse-mcp', 'c3ai-dataverse-mcp')),
      claude: true,
    },
    industries: industries.map(i => i.name),
    topUseCases: [...new Set(wins.map(w => w.use_case))].slice(0, 8),
    // Preview data so the home page isn't just numbers
    preview: {
      wins: wins.slice(0, 6).map(w => ({
        industry: w.industry,
        useCase: w.use_case,
        champion: w.champion_title,
        entry: w.entry_point,
        deals: w.deal_count,
        tcv: w.avg_tcv_bucket,
      })),
      caseStudies: caseStudies.slice(0, 5).map(c => ({
        customer: c.customer_name,
        industry: c.industry,
        useCase: c.use_case,
        value: c.value_delivered_summary,
        isPublic: c.is_public,
      })),
      personas: personas.slice(0, 6).map(p => ({
        useCase: p.use_case,
        titles: p.title_patterns,
        seniority: p.seniority,
        conversion: p.conversion_rate,
      })),
    },
  });
});
