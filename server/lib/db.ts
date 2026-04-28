import initSqlJs, { type Database, type SqlValue } from 'sql.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// In dev (server/lib/), go up 2 levels. In dist (dist/server/lib/), go up 3 levels.
const PROJECT_ROOT = __dirname.includes('dist')
  ? path.resolve(__dirname, '../../..')
  : path.resolve(__dirname, '../..');
const DB_PATH = path.join(PROJECT_ROOT, 'db/bdr-copilot.db');
const SCHEMA_PATH = path.join(PROJECT_ROOT, 'db/schema.sql');
const SEED_PATH = path.join(PROJECT_ROOT, 'db/seed.sql');

let db: Database | null = null;

export async function initDatabase(): Promise<Database> {
  if (db) return db;

  const SQL = await initSqlJs();
  const exists = fs.existsSync(DB_PATH);

  if (exists) {
    const buffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
    const schema = fs.readFileSync(SCHEMA_PATH, 'utf-8');
    db.run(schema);
    const seed = fs.readFileSync(SEED_PATH, 'utf-8');
    db.run(seed);
    saveDb();
  }

  return db;
}

export function getDb(): Database {
  if (!db) throw new Error('Database not initialized. Call initDatabase() first.');
  return db;
}

function saveDb(): void {
  if (!db) return;
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const data = db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

/** Run a query that returns rows */
function all(sql: string, params: SqlValue[] = []): Record<string, unknown>[] {
  const stmt = getDb().prepare(sql);
  if (params.length) stmt.bind(params);
  const results: Record<string, unknown>[] = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject() as Record<string, unknown>);
  }
  stmt.free();
  return results;
}

/** Run a query that returns a single row */
function get(sql: string, params: SqlValue[] = []): Record<string, unknown> | undefined {
  const rows = all(sql, params);
  return rows[0];
}

/** Run a query that modifies data */
function run(sql: string, params: SqlValue[] = []): void {
  getDb().run(sql, params);
  saveDb();
}

/** Purge expired research cache entries (older than 7 days) */
export function purgeStaleCache(): void {
  run(`DELETE FROM research_cache WHERE fetched_at < datetime('now', '-7 days')`);
}

/** Log an activity for cost tracking */
export function logActivity(action: string, details?: string, tokenUsage?: number): void {
  run(
    `INSERT INTO activity_log (action, details, token_usage) VALUES (?, ?, ?)`,
    [action, details ?? null, tokenUsage ?? null]
  );
}

/** Get all records from a seed table */
export function getWinPatterns() {
  return all('SELECT * FROM win_patterns');
}

export function getIcpCriteria() {
  return all('SELECT * FROM icp_criteria ORDER BY priority');
}

export function getPersonas(useCase?: string) {
  if (useCase) {
    return all('SELECT * FROM personas WHERE use_case = ? ORDER BY conversion_rate DESC', [useCase]);
  }
  return all('SELECT * FROM personas ORDER BY conversion_rate DESC');
}

export function getCaseStudies(industry?: string) {
  if (industry) {
    return all('SELECT * FROM case_studies WHERE industry = ?', [industry]);
  }
  return all('SELECT * FROM case_studies');
}

export function getOutreachTemplates(personaType?: string, useCase?: string) {
  let query = 'SELECT * FROM outreach_templates WHERE 1=1';
  const params: SqlValue[] = [];

  if (personaType) {
    query += ' AND persona_type = ?';
    params.push(personaType);
  }
  if (useCase) {
    query += ' AND (use_case = ? OR use_case IS NULL)';
    params.push(useCase);
  }

  query += ' ORDER BY sequence_position';
  return all(query, params);
}

export function getTargetIndustries() {
  return all('SELECT * FROM target_industries');
}

/** Check which company names already exist in prospects (any status) */
export function getExistingProspectNames(): Set<string> {
  const rows = all('SELECT LOWER(company_name) as name FROM prospects');
  return new Set(rows.map(r => r.name as string));
}

/** Get prospects that have been contacted or are in active deals */
export function getActiveProspectNames(): Set<string> {
  const rows = all(
    `SELECT LOWER(company_name) as name FROM prospects WHERE status IN ('contacted', 'qualified')`
  );
  return new Set(rows.map(r => r.name as string));
}

// --- Prospect CRUD ---

export function upsertProspect(prospect: {
  company_name: string;
  industry?: string;
  revenue_b?: number;
  employee_count?: number;
  headquarters?: string;
  signals_json?: string;
  similarity_score?: number;
  recommended_use_case?: string;
  recommended_title?: string;
  dynamics_account_id?: string;
  status?: string;
}) {
  run(
    `INSERT INTO prospects (company_name, industry, revenue_b, employee_count, headquarters, signals_json, similarity_score, recommended_use_case, recommended_title, dynamics_account_id, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(company_name) DO UPDATE SET
      industry = excluded.industry,
      revenue_b = excluded.revenue_b,
      signals_json = excluded.signals_json,
      similarity_score = excluded.similarity_score,
      recommended_use_case = excluded.recommended_use_case,
      recommended_title = excluded.recommended_title,
      updated_at = CURRENT_TIMESTAMP`,
    [
      prospect.company_name,
      prospect.industry ?? null,
      prospect.revenue_b ?? null,
      prospect.employee_count ?? null,
      prospect.headquarters ?? null,
      prospect.signals_json ?? null,
      prospect.similarity_score ?? null,
      prospect.recommended_use_case ?? null,
      prospect.recommended_title ?? null,
      prospect.dynamics_account_id ?? null,
      prospect.status ?? 'new',
    ]
  );
}

export function updateProspectStatusDb(id: number, status: string): void {
  run('UPDATE prospects SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [status, id]);
}

export function getProspects(status?: string) {
  if (status) {
    return all('SELECT * FROM prospects WHERE status = ? ORDER BY similarity_score DESC', [status]);
  }
  return all('SELECT * FROM prospects ORDER BY created_at DESC');
}

export function getProspectById(id: number) {
  return get('SELECT * FROM prospects WHERE id = ?', [id]);
}

// --- Research cache ---

export function getCachedResearch(prospectId: number) {
  return get(
    `SELECT * FROM research_cache WHERE prospect_id = ? AND fetched_at > datetime('now', '-7 days') ORDER BY fetched_at DESC LIMIT 1`,
    [prospectId]
  );
}

export function cacheResearch(prospectId: number, researchType: string, researchJson: string) {
  run(
    `INSERT INTO research_cache (prospect_id, research_type, research_json) VALUES (?, ?, ?)`,
    [prospectId, researchType, researchJson]
  );
}

// --- Outreach drafts ---

export function saveDraft(draft: {
  contact_id?: number;
  prospect_id: number;
  subject: string;
  body: string;
  template_id?: number;
  sequence_position?: number;
  tone?: string;
}) {
  run(
    `INSERT INTO outreach_drafts (contact_id, prospect_id, subject, body, template_id, sequence_position, tone)
    VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      draft.contact_id ?? null,
      draft.prospect_id,
      draft.subject,
      draft.body,
      draft.template_id ?? null,
      draft.sequence_position ?? 1,
      draft.tone ?? 'professional',
    ]
  );
}

export function getDrafts(prospectId?: number) {
  if (prospectId) {
    return all('SELECT * FROM outreach_drafts WHERE prospect_id = ? ORDER BY created_at DESC', [prospectId]);
  }
  return all('SELECT * FROM outreach_drafts ORDER BY created_at DESC LIMIT 50');
}
