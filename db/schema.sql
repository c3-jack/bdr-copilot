-- BDR Copilot Database Schema
-- SQLite with WAL mode for concurrent read/write

PRAGMA journal_mode=WAL;
PRAGMA foreign_keys=ON;

-- ============================================================
-- SEED TABLES (pre-populated with C3 AI win patterns)
-- ============================================================

CREATE TABLE IF NOT EXISTS win_patterns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  industry TEXT NOT NULL,
  company_size_bucket TEXT NOT NULL, -- 'mid' ($1-10B), 'large' ($10-50B), 'enterprise' ($50B+)
  use_case TEXT NOT NULL,
  champion_title TEXT NOT NULL,
  entry_point TEXT NOT NULL, -- which C3 product opened the door
  partner TEXT, -- AWS, Azure, GCP, McKinsey, etc.
  avg_time_to_close_days INTEGER,
  avg_tcv_bucket TEXT, -- 'pilot' (<$500K), 'mid' ($500K-$2M), 'large' ($2M+)
  deal_count INTEGER DEFAULT 1,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS icp_criteria (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL, -- e.g., 'Core ICP', 'Stretch ICP'
  min_revenue_b REAL NOT NULL, -- in billions
  target_industries TEXT NOT NULL, -- JSON array
  qualifying_signals TEXT NOT NULL, -- JSON array
  disqualifying_signals TEXT NOT NULL, -- JSON array
  priority INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS personas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  use_case TEXT NOT NULL,
  title_pattern TEXT NOT NULL, -- e.g., 'VP Supply Chain', 'Director of Reliability'
  seniority TEXT NOT NULL, -- 'C-Suite', 'VP', 'Director', 'Manager'
  department TEXT NOT NULL,
  conversion_rate REAL, -- historical rate if known
  notes TEXT
);

CREATE TABLE IF NOT EXISTS case_studies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_name TEXT NOT NULL,
  industry TEXT NOT NULL,
  use_case TEXT NOT NULL,
  value_delivered TEXT NOT NULL, -- e.g., '$50M annual savings'
  is_public BOOLEAN DEFAULT 0,
  collateral_url TEXT,
  summary TEXT
);

CREATE TABLE IF NOT EXISTS outreach_templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  persona_type TEXT NOT NULL, -- 'executive', 'practitioner', 'technical'
  use_case TEXT, -- NULL means generic
  subject_line TEXT NOT NULL,
  body_template TEXT NOT NULL,
  sequence_position INTEGER DEFAULT 1, -- 1 = first touch, 2 = follow-up, etc.
  tone TEXT DEFAULT 'professional', -- 'executive', 'casual', 'technical'
  notes TEXT
);

CREATE TABLE IF NOT EXISTS target_industries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  c3_products TEXT NOT NULL, -- JSON array of relevant C3 products
  key_use_cases TEXT NOT NULL, -- JSON array
  typical_champion_titles TEXT NOT NULL, -- JSON array
  market_size_notes TEXT
);

-- ============================================================
-- RUNTIME TABLES (populated as BDR uses the tool)
-- ============================================================

CREATE TABLE IF NOT EXISTS prospects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_name TEXT NOT NULL UNIQUE,
  industry TEXT,
  revenue_b REAL, -- in billions
  employee_count INTEGER,
  headquarters TEXT,
  signals_json TEXT, -- JSON array of detected signals
  similarity_score REAL, -- 0-100 match to win patterns
  recommended_use_case TEXT,
  recommended_title TEXT,
  dynamics_account_id TEXT, -- link to Dynamics if exists
  status TEXT DEFAULT 'new', -- new, researched, contacted, qualified, disqualified
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS contacts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  prospect_id INTEGER REFERENCES prospects(id),
  name TEXT NOT NULL,
  title TEXT,
  email TEXT,
  linkedin_url TEXT,
  source TEXT, -- 'zoominfo', 'linkedin', 'dynamics', 'manual'
  persona_type TEXT, -- 'economic_buyer', 'champion', 'evaluator', 'influencer'
  last_contacted DATETIME,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS research_cache (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  prospect_id INTEGER REFERENCES prospects(id),
  research_type TEXT NOT NULL, -- 'quick', 'deep', 'news'
  research_json TEXT NOT NULL,
  fetched_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS outreach_drafts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  contact_id INTEGER REFERENCES contacts(id),
  prospect_id INTEGER REFERENCES prospects(id),
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  template_id INTEGER REFERENCES outreach_templates(id),
  sequence_position INTEGER DEFAULT 1,
  tone TEXT,
  status TEXT DEFAULT 'draft', -- draft, sent, archived
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS activity_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  action TEXT NOT NULL, -- 'discover', 'research', 'draft_outreach', 'view_pipeline'
  details TEXT,
  token_usage INTEGER, -- rough token count for cost tracking
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_prospects_industry ON prospects(industry);
CREATE INDEX IF NOT EXISTS idx_prospects_status ON prospects(status);
CREATE INDEX IF NOT EXISTS idx_research_cache_prospect ON research_cache(prospect_id);
CREATE INDEX IF NOT EXISTS idx_research_cache_fetched ON research_cache(fetched_at);
CREATE INDEX IF NOT EXISTS idx_outreach_drafts_prospect ON outreach_drafts(prospect_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_created ON activity_log(created_at);
