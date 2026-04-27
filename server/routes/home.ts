import { Router } from 'express';
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
  const wins = getWinPatterns();
  const icp = getIcpCriteria();
  const industries = getTargetIndustries();
  const caseStudies = getCaseStudies();
  const personas = getPersonas();
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
      claude: true, // if we got here the server is running
    },
    industries: industries.map((i: Record<string, unknown>) => i.name),
    topUseCases: [...new Set(wins.map((w: Record<string, unknown>) => w.use_case))].slice(0, 8),
  });
});
