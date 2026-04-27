const BASE = '/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error ?? `Request failed: ${res.status}`);
  }
  return res.json();
}

// Discover
export function discoverCompanies(query: string, industry?: string, minRevenue?: number) {
  return request<{ companies: ScoredCompany[]; searchAnswer?: string }>('/discover', {
    method: 'POST',
    body: JSON.stringify({ query, industry, minRevenue }),
  });
}

export function findSimilar(companyName: string) {
  return request<{ companies: ScoredCompany[] }>('/discover/similar', {
    method: 'POST',
    body: JSON.stringify({ companyName }),
  });
}

// Research
export function deepResearch(prospectId: number) {
  return request<ResearchResult>(`/research/${prospectId}`, { method: 'POST' });
}

// Outreach
export function generateOutreach(params: {
  prospectId: number;
  targetTitle?: string;
  tone?: string;
  sequenceLength?: number;
  customContext?: string;
}) {
  return request<OutreachResult>('/outreach/generate', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export function getDrafts(prospectId?: number) {
  const path = prospectId ? `/outreach/drafts/${prospectId}` : '/outreach/drafts';
  return request<{ drafts: Draft[] }>(path);
}

// Pipeline
export function getPipeline(status?: string) {
  const params = status ? `?status=${status}` : '';
  return request<{ prospects: Prospect[] }>(`/pipeline${params}`);
}

export function getProspect(id: number) {
  return request<{ prospect: Prospect }>(`/pipeline/${id}`);
}

export function updateProspectStatus(id: number, status: string) {
  return request<{ prospect: Prospect }>(`/pipeline/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}

export function getIndustries() {
  return request<{ industries: Industry[] }>('/pipeline/ref/industries');
}

// Types
export interface ScoredCompany {
  company_name: string;
  industry: string;
  revenue_b: number;
  employee_count?: number;
  headquarters?: string;
  why_a_fit: string;
  signals: string[];
  ai_posture: string;
  score: number;
  matchedPatterns?: Array<{ use_case: string; champion_title: string; entry_point: string; similarity: number }>;
  recommendedUseCase: string;
  recommendedTitle: string;
  reasoning?: string;
}

export interface Prospect {
  id: number;
  company_name: string;
  industry: string;
  revenue_b: number;
  employee_count?: number;
  headquarters?: string;
  signals: string[];
  signals_json?: string;
  score: number;
  similarity_score?: number;
  recommended_use_case: string;
  recommended_title: string;
  recommendedUseCase?: string;
  recommendedTitle?: string;
  reasoning?: string;
  status: string;
  daysSinceUpdate: number;
  isStale: boolean;
  created_at: string;
  updated_at: string;
}

export interface ResearchResult {
  report: {
    companyOverview: string;
    strategicPriorities: string[];
    aiPosture: { maturity: string; initiatives: string[]; budget_signals: string[] };
    keyStakeholders: Array<{ title: string; why_target: string; messaging_angle: string }>;
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
  };
  prospect: Record<string, unknown>;
}

export interface OutreachResult {
  emails: Array<{
    subject: string;
    body: string;
    sequencePosition: number;
    tone: string;
    personaType: string;
    templateBasis: string;
  }>;
  context: {
    companyName: string;
    industry: string;
    useCase: string;
    targetTitle: string;
    caseStudy: string | null;
  };
}

export interface Draft {
  id: number;
  prospect_id: number;
  subject: string;
  body: string;
  sequence_position: number;
  tone: string;
  status: string;
  created_at: string;
}

export interface Industry {
  id: number;
  name: string;
  c3_products: string;
  key_use_cases: string;
  typical_champion_titles: string;
  market_size_notes: string;
}
