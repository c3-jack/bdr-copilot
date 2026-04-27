/**
 * ZoomInfo API integration — company search, contact search, enrichment.
 * Auth: PKI (client_id + private_key) → JWT token (60min expiry).
 * API base: https://api.zoominfo.com
 */

const API_BASE = 'https://api.zoominfo.com';

let cachedToken: { jwt: string; expiresAt: number } | null = null;

async function getToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt) {
    return cachedToken.jwt;
  }

  const clientId = process.env.ZOOMINFO_CLIENT_ID;
  const privateKey = process.env.ZOOMINFO_PRIVATE_KEY;

  if (!clientId || !privateKey) {
    throw new Error('ZoomInfo not configured. Set ZOOMINFO_CLIENT_ID and ZOOMINFO_PRIVATE_KEY in .env');
  }

  const res = await fetch(`${API_BASE}/authenticate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clientId, privateKey }),
  });

  if (!res.ok) {
    throw new Error(`ZoomInfo auth failed: ${res.status} ${res.statusText}`);
  }

  const data = await res.json() as { jwt: string };
  cachedToken = { jwt: data.jwt, expiresAt: Date.now() + 55 * 60 * 1000 }; // refresh 5min before expiry
  return data.jwt;
}

async function ziRequest<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const token = await getToken();
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`ZoomInfo API error (${path}): ${res.status} — ${err}`);
  }

  return res.json() as Promise<T>;
}

export function isConfigured(): boolean {
  return Boolean(process.env.ZOOMINFO_CLIENT_ID && process.env.ZOOMINFO_PRIVATE_KEY);
}

// --- Company Search ---

export interface ZiCompany {
  id: number;
  name: string;
  website: string;
  revenue: number;
  revenueRange: string;
  employeeCount: number;
  industry: string;
  subIndustry: string;
  sicCode: string;
  naicsCode: string;
  city: string;
  state: string;
  country: string;
  description: string;
  ticker: string;
  parentCompany: string;
  ultimateParent: string;
  techCategories: string[];
}

export async function searchCompanies(params: {
  companyName?: string;
  domain?: string;
  industry?: string;
  revenueMin?: number;
  revenueMax?: number;
  employeeMin?: number;
  employeeMax?: number;
  page?: number;
  pageSize?: number;
}): Promise<{ data: ZiCompany[]; totalResults: number }> {
  const body: Record<string, unknown> = {
    rpiPageSize: params.pageSize ?? 10,
    rpiPage: params.page ?? 1,
    outputFields: [
      'id', 'name', 'website', 'revenue', 'revenueRange', 'employeeCount',
      'industry', 'subIndustry', 'sicCode', 'naicsCode',
      'city', 'state', 'country', 'description',
      'ticker', 'parentCompany', 'ultimateParent',
    ],
  };

  if (params.companyName) body.companyName = params.companyName;
  if (params.domain) body.websiteUrl = params.domain;
  if (params.industry) body.industryKeywords = params.industry;
  if (params.revenueMin) body.revenueMin = params.revenueMin;
  if (params.revenueMax) body.revenueMax = params.revenueMax;
  if (params.employeeMin) body.employeeMin = params.employeeMin;
  if (params.employeeMax) body.employeeMax = params.employeeMax;

  const result = await ziRequest<{ data: ZiCompany[]; maxResults: number }>('/search/company', body);
  return { data: result.data ?? [], totalResults: result.maxResults ?? 0 };
}

// --- Contact Search ---

export interface ZiContact {
  id: number;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  phone: string;
  directPhoneNumber: string;
  mobilePhoneNumber: string;
  jobTitle: string;
  jobFunction: string;
  managementLevel: string;
  companyId: number;
  companyName: string;
  companyWebsite: string;
  linkedinUrl: string;
  city: string;
  state: string;
  country: string;
  lastUpdated: string;
}

export async function searchContacts(params: {
  companyId?: number;
  companyName?: string;
  jobTitle?: string;
  managementLevel?: string;
  jobFunction?: string;
  page?: number;
  pageSize?: number;
}): Promise<{ data: ZiContact[]; totalResults: number }> {
  const body: Record<string, unknown> = {
    rpiPageSize: params.pageSize ?? 25,
    rpiPage: params.page ?? 1,
    outputFields: [
      'id', 'firstName', 'lastName', 'fullName',
      'email', 'phone', 'directPhoneNumber', 'mobilePhoneNumber',
      'jobTitle', 'jobFunction', 'managementLevel',
      'companyId', 'companyName', 'companyWebsite',
      'linkedinUrl', 'city', 'state', 'country', 'lastUpdated',
    ],
  };

  if (params.companyId) body.companyId = [params.companyId];
  if (params.companyName) body.companyName = params.companyName;
  if (params.jobTitle) body.jobTitleKeywords = params.jobTitle;
  if (params.managementLevel) body.managementLevel = [params.managementLevel];
  if (params.jobFunction) body.jobFunction = [params.jobFunction];

  const result = await ziRequest<{ data: ZiContact[]; maxResults: number }>('/search/contact', body);
  return { data: result.data ?? [], totalResults: result.maxResults ?? 0 };
}

// --- Company Enrichment (single company, all data) ---

export async function enrichCompany(companyId: number): Promise<ZiCompany | null> {
  const result = await ziRequest<{ data: ZiCompany[] }>('/enrich/company', {
    matchCompanyInput: [{ companyId }],
    outputFields: [
      'id', 'name', 'website', 'revenue', 'revenueRange', 'employeeCount',
      'industry', 'subIndustry', 'sicCode', 'naicsCode',
      'city', 'state', 'country', 'description',
      'ticker', 'parentCompany', 'ultimateParent',
    ],
  });
  return result.data?.[0] ?? null;
}

// --- Contact Enrichment ---

export async function enrichContact(contactId: number): Promise<ZiContact | null> {
  const result = await ziRequest<{ data: ZiContact[] }>('/enrich/contact', {
    matchPersonInput: [{ personId: contactId }],
    outputFields: [
      'id', 'firstName', 'lastName', 'fullName',
      'email', 'phone', 'directPhoneNumber', 'mobilePhoneNumber',
      'jobTitle', 'jobFunction', 'managementLevel',
      'companyId', 'companyName', 'companyWebsite',
      'linkedinUrl', 'city', 'state', 'country', 'lastUpdated',
    ],
  });
  return result.data?.[0] ?? null;
}

// --- Intent Data ---

export interface ZiIntent {
  companyId: number;
  companyName: string;
  topicName: string;
  signalScore: number;
  signalStartDate: string;
  audienceStrength: string;
}

export async function getCompanyIntent(companyId: number): Promise<ZiIntent[]> {
  try {
    const result = await ziRequest<{ data: ZiIntent[] }>('/intent', {
      companyId: [companyId],
    });
    return result.data ?? [];
  } catch {
    return [];
  }
}
