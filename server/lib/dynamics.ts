/**
 * Dynamics 365 / Dataverse Web API client.
 * Auth: Azure AD client_credentials → Bearer token.
 */
import { resolve } from './config.js';

let cachedToken: { token: string; expiresAt: number } | null = null;

export function isConfigured(): boolean {
  return Boolean(
    resolve('DYNAMICS_ORG_URL') && resolve('DYNAMICS_TENANT_ID') &&
    resolve('DYNAMICS_CLIENT_ID') && resolve('DYNAMICS_CLIENT_SECRET')
  );
}

async function getToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt) {
    return cachedToken.token;
  }

  const orgUrl = resolve('DYNAMICS_ORG_URL');
  const tenantId = resolve('DYNAMICS_TENANT_ID');
  const clientId = resolve('DYNAMICS_CLIENT_ID');
  const clientSecret = resolve('DYNAMICS_CLIENT_SECRET');

  if (!orgUrl || !tenantId || !clientId || !clientSecret) {
    throw new Error('Dynamics 365 not configured. Add credentials in Settings.');
  }

  const resp = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      scope: `${orgUrl}/.default`,
      grant_type: 'client_credentials',
    }),
  });

  if (!resp.ok) {
    throw new Error(`Azure AD auth failed: ${resp.status}`);
  }

  const data = await resp.json() as { access_token: string; expires_in: number };
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in - 60) * 1000,
  };
  return data.access_token;
}

async function dataverseGet<T>(path: string): Promise<T> {
  const orgUrl = resolve('DYNAMICS_ORG_URL');
  const token = await getToken();
  const resp = await fetch(`${orgUrl}/api/data/v9.2/${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'OData-MaxVersion': '4.0',
      'OData-Version': '4.0',
      Accept: 'application/json',
      Prefer: 'odata.include-annotations="*"',
    },
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Dataverse API error (${path}): ${resp.status} — ${text.slice(0, 300)}`);
  }

  return resp.json() as Promise<T>;
}

// --- Types ---

export interface DynamicsAccount {
  accountid: string;
  name: string;
  revenue?: number;
  numberofemployees?: number;
  industrycode?: number;
  address1_city?: string;
  address1_stateorprovince?: string;
  address1_country?: string;
  websiteurl?: string;
  description?: string;
  telephone1?: string;
  createdon?: string;
  modifiedon?: string;
}

export interface DynamicsContact {
  contactid: string;
  fullname: string;
  firstname?: string;
  lastname?: string;
  jobtitle?: string;
  emailaddress1?: string;
  telephone1?: string;
  mobilephone?: string;
  _parentcustomerid_value?: string;
}

export interface DynamicsOpportunity {
  opportunityid: string;
  name: string;
  estimatedvalue?: number;
  closeprobability?: number;
  stepname?: string;
  estimatedclosedate?: string;
  _parentaccountid_value?: string;
  createdon?: string;
  modifiedon?: string;
  statecode?: number;
  statuscode?: number;
}

interface ODataResponse<T> {
  value: T[];
  '@odata.count'?: number;
}

// --- API Methods ---

export async function getAccounts(params?: {
  top?: number;
  filter?: string;
  search?: string;
}): Promise<DynamicsAccount[]> {
  const parts: string[] = [];
  parts.push('$select=accountid,name,revenue,numberofemployees,industrycode,address1_city,address1_stateorprovince,address1_country,websiteurl,description,telephone1,createdon,modifiedon');
  parts.push(`$top=${params?.top ?? 50}`);
  parts.push('$orderby=modifiedon desc');

  if (params?.filter) parts.push(`$filter=${params.filter}`);
  if (params?.search) parts.push(`$filter=contains(name,'${params.search.replace(/'/g, "''")}')`);

  const result = await dataverseGet<ODataResponse<DynamicsAccount>>(`accounts?${parts.join('&')}`);
  return result.value;
}

export async function getAccountById(id: string): Promise<DynamicsAccount> {
  return dataverseGet<DynamicsAccount>(`accounts(${id})?$select=accountid,name,revenue,numberofemployees,industrycode,address1_city,address1_stateorprovince,address1_country,websiteurl,description,telephone1,createdon,modifiedon`);
}

export async function getContacts(params?: {
  accountId?: string;
  top?: number;
  search?: string;
}): Promise<DynamicsContact[]> {
  const parts: string[] = [];
  parts.push('$select=contactid,fullname,firstname,lastname,jobtitle,emailaddress1,telephone1,mobilephone,_parentcustomerid_value');
  parts.push(`$top=${params?.top ?? 25}`);

  if (params?.accountId) {
    parts.push(`$filter=_parentcustomerid_value eq '${params.accountId}'`);
  }
  if (params?.search) {
    parts.push(`$filter=contains(fullname,'${params.search.replace(/'/g, "''")}')`);
  }

  const result = await dataverseGet<ODataResponse<DynamicsContact>>(`contacts?${parts.join('&')}`);
  return result.value;
}

export async function getOpportunities(params?: {
  accountId?: string;
  top?: number;
  openOnly?: boolean;
}): Promise<DynamicsOpportunity[]> {
  const parts: string[] = [];
  parts.push('$select=opportunityid,name,estimatedvalue,closeprobability,stepname,estimatedclosedate,_parentaccountid_value,createdon,modifiedon,statecode,statuscode');
  parts.push(`$top=${params?.top ?? 25}`);
  parts.push('$orderby=modifiedon desc');

  const filters: string[] = [];
  if (params?.accountId) filters.push(`_parentaccountid_value eq '${params.accountId}'`);
  if (params?.openOnly) filters.push('statecode eq 0');
  if (filters.length) parts.push(`$filter=${filters.join(' and ')}`);

  const result = await dataverseGet<ODataResponse<DynamicsOpportunity>>(`opportunities?${parts.join('&')}`);
  return result.value;
}

export async function searchAccounts(query: string): Promise<DynamicsAccount[]> {
  return getAccounts({ search: query, top: 20 });
}
