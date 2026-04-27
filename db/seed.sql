-- BDR Copilot Seed Data
-- Pre-populated with C3 AI win patterns, ICP, personas, case studies, templates
-- Source: SharePoint research + GTM Motion doc + Account Planning SOP

-- ============================================================
-- WIN PATTERNS (based on historical C3 AI deals)
-- ============================================================

INSERT INTO win_patterns (industry, company_size_bucket, use_case, champion_title, entry_point, partner, avg_time_to_close_days, avg_tcv_bucket, deal_count) VALUES
('Manufacturing', 'large', 'Asset Performance Management', 'VP Operations', 'C3 AI Reliability', 'AWS', 180, 'mid', 8),
('Manufacturing', 'large', 'Supply Chain Optimization', 'VP Supply Chain', 'C3 AI Supply Chain', 'Azure', 210, 'mid', 6),
('Manufacturing', 'enterprise', 'Production Schedule Optimization', 'VP Manufacturing', 'C3 AI PSO', 'AWS', 240, 'large', 4),
('Energy', 'enterprise', 'Asset Performance Management', 'VP Asset Management', 'C3 AI Reliability', 'Azure', 200, 'large', 7),
('Energy', 'large', 'Predictive Maintenance', 'Director of Reliability', 'C3 AI Reliability', 'AWS', 160, 'mid', 5),
('Energy', 'enterprise', 'Grid Analytics', 'VP Grid Operations', 'C3 AI Energy Management', NULL, 270, 'large', 3),
('Financial Services', 'enterprise', 'Anti-Money Laundering', 'Chief Compliance Officer', 'C3 AI AML', NULL, 300, 'large', 4),
('Financial Services', 'large', 'Fraud Detection', 'VP Risk', 'C3 AI Fraud', 'AWS', 180, 'mid', 3),
('Retail', 'large', 'Inventory Optimization', 'VP Supply Chain', 'C3 AI Inventory', 'GCP', 150, 'mid', 3),
('Retail', 'enterprise', 'Demand Forecasting', 'VP Merchandising', 'C3 AI Supply Chain', 'Azure', 200, 'large', 2),
('Defense', 'enterprise', 'Readiness Optimization', 'Program Manager', 'C3 AI Readiness', NULL, 360, 'large', 5),
('Defense', 'enterprise', 'Predictive Logistics', 'Logistics Director', 'C3 AI Readiness', NULL, 300, 'large', 3),
('Aerospace', 'enterprise', 'MRO Optimization', 'VP Maintenance', 'C3 AI Reliability', 'AWS', 240, 'large', 2),
('Chemicals', 'large', 'Process Optimization', 'VP Operations', 'C3 AI Reliability', 'Azure', 180, 'mid', 2),
('Pharma', 'enterprise', 'Supply Chain Visibility', 'VP Supply Chain', 'C3 AI Supply Chain', 'AWS', 210, 'mid', 2);

-- ============================================================
-- ICP CRITERIA
-- ============================================================

INSERT INTO icp_criteria (name, min_revenue_b, target_industries, qualifying_signals, disqualifying_signals, priority) VALUES
('Core ICP', 10.0,
  '["Manufacturing", "Energy", "Financial Services", "Defense", "Aerospace"]',
  '["AI/ML job postings", "Earnings call mentions of AI/predictive analytics", "Cloud migration announced", "New CIO/CTO hire", "Digital transformation initiative", "Regulatory pressure requiring analytics", "Large asset base requiring monitoring"]',
  '["Bankruptcy/restructuring", "Active C3 competitor deployment", "No cloud infrastructure", "Sub $5B revenue with no growth trajectory"]',
  1),
('Stretch ICP', 5.0,
  '["Retail", "Pharma", "Chemicals", "Telecom", "Transportation", "Mining"]',
  '["AI budget allocated", "RFP for predictive analytics", "Partner introduction (AWS/Azure/GCP)", "Conference attendee at AI events", "Published AI strategy"]',
  '["Fully committed to competitor platform", "No IT modernization budget", "Government entity without existing contract vehicle"]',
  2);

-- ============================================================
-- PERSONAS (target titles by use case)
-- ============================================================

INSERT INTO personas (use_case, title_pattern, seniority, department, conversion_rate, notes) VALUES
('Asset Performance Management', 'VP Operations', 'VP', 'Operations', 0.18, 'Highest converting title for APM'),
('Asset Performance Management', 'Director of Reliability', 'Director', 'Operations', 0.15, 'Technical champion, often becomes evaluator'),
('Asset Performance Management', 'VP Asset Management', 'VP', 'Operations', 0.14, 'Common in Energy sector'),
('Supply Chain Optimization', 'VP Supply Chain', 'VP', 'Supply Chain', 0.20, 'Best entry point for SC use cases'),
('Supply Chain Optimization', 'Chief Supply Chain Officer', 'C-Suite', 'Supply Chain', 0.12, 'Economic buyer, harder to reach'),
('Supply Chain Optimization', 'Director of Planning', 'Director', 'Supply Chain', 0.16, 'Technical champion'),
('Production Schedule Optimization', 'VP Manufacturing', 'VP', 'Manufacturing', 0.15, NULL),
('Production Schedule Optimization', 'Director of Production', 'Director', 'Manufacturing', 0.13, NULL),
('Fraud Detection', 'VP Risk', 'VP', 'Risk/Compliance', 0.14, NULL),
('Anti-Money Laundering', 'Chief Compliance Officer', 'C-Suite', 'Compliance', 0.10, 'Long cycle but high TCV'),
('Inventory Optimization', 'VP Supply Chain', 'VP', 'Supply Chain', 0.17, NULL),
('Demand Forecasting', 'VP Merchandising', 'VP', 'Merchandising', 0.13, 'Retail-specific'),
('Readiness Optimization', 'Program Manager', 'Director', 'Program Office', 0.08, 'Federal — long cycle'),
('General / Platform', 'CIO', 'C-Suite', 'IT', 0.08, 'Good for top-down but lower conversion than functional VPs'),
('General / Platform', 'CTO', 'C-Suite', 'Technology', 0.09, 'Better when they have AI mandate'),
('General / Platform', 'VP Data & Analytics', 'VP', 'Data/Analytics', 0.12, 'Technical buyer, good evaluator');

-- ============================================================
-- CASE STUDIES
-- ============================================================

INSERT INTO case_studies (customer_name, industry, use_case, value_delivered, is_public, summary) VALUES
('Baker Hughes', 'Energy', 'Asset Performance Management', '$100M+ in avoided downtime', 1, 'Deployed C3 AI Reliability across 60,000+ pieces of rotating equipment. Predicts failures 30 days in advance.'),
('Shell', 'Energy', 'Predictive Maintenance', '$1.6B in identified savings', 1, 'AI-driven predictive maintenance across global operations, identifying equipment failures before they occur.'),
('US Air Force', 'Defense', 'Readiness Optimization', 'Improved aircraft readiness rates', 1, 'Predictive maintenance for military aircraft, reducing unplanned downtime and improving mission readiness.'),
('Koch Industries', 'Manufacturing', 'Asset Performance Management', '$100M+ economic value', 1, 'Enterprise-scale APM deployment across manufacturing facilities.'),
('Engie', 'Energy', 'Grid Analytics', 'Improved grid reliability', 1, 'AI-powered grid analytics for one of the worlds largest utility companies.'),
('3M', 'Manufacturing', 'Supply Chain Optimization', 'Supply chain visibility improvement', 1, 'End-to-end supply chain optimization across global manufacturing operations.'),
('Cargill', 'Manufacturing', 'Supply Chain Optimization', 'Reduced inventory costs', 0, 'Supply chain and inventory optimization for agricultural commodities.'),
('Con Edison', 'Energy', 'Asset Performance Management', 'Reduced outage rates', 1, 'Predictive analytics for electric grid equipment, improving reliability for millions of customers.'),
('Raytheon', 'Defense', 'Predictive Logistics', 'Improved parts availability', 0, 'Predictive logistics and readiness for defense systems.'),
('GSK', 'Pharma', 'Supply Chain Visibility', 'Manufacturing optimization', 0, 'AI-powered supply chain and manufacturing analytics for pharmaceutical operations.'),
('Flex', 'Manufacturing', 'Production Schedule Optimization', 'Production efficiency gains', 0, 'PSO deployment for electronics manufacturing.'),
('Gategroup', 'Manufacturing', 'Production Schedule Optimization', 'Catering production optimization', 0, 'Airline catering production scheduling optimization.');

-- ============================================================
-- OUTREACH TEMPLATES
-- ============================================================

INSERT INTO outreach_templates (name, persona_type, use_case, subject_line, body_template, sequence_position, tone) VALUES
-- Executive first touch
('Exec First Touch - APM', 'executive', 'Asset Performance Management',
  'Reducing unplanned downtime at {{company}}',
  'Hi {{first_name}},

{{company}} operates a significant asset base in {{industry}}, and I wanted to share how companies like {{similar_customer}} are using AI to predict equipment failures 30+ days in advance — avoiding costly unplanned downtime.

{{similar_customer}} saw {{value_delivered}} using C3 AI Reliability. Given {{company}}''s scale, the potential impact could be substantial.

Would a 15-minute call to explore whether this applies to {{company}} be worth your time?

Best,
{{sender_name}}',
  1, 'executive'),

-- Executive follow-up
('Exec Follow-up', 'executive', NULL,
  'Re: {{previous_subject}}',
  'Hi {{first_name}},

Following up on my previous note. I know your time is valuable, so I''ll be brief:

{{specific_signal}} caught my attention — it suggests {{company}} may be actively exploring AI/ML solutions for {{use_case_area}}.

Happy to share a quick 2-page overview of what we''ve done with {{similar_customer}} in {{industry}}. No commitment needed — just context that might be useful as you evaluate options.

Best,
{{sender_name}}',
  2, 'executive'),

-- Practitioner first touch
('Practitioner First Touch - Supply Chain', 'practitioner', 'Supply Chain Optimization',
  'How {{similar_customer}} optimized their supply chain with AI',
  'Hi {{first_name}},

I noticed {{company}} has been {{specific_signal}}, and wanted to share a relevant example.

{{similar_customer}} deployed C3 AI to optimize their supply chain operations and saw {{value_delivered}}. The key was applying AI to predict demand variability and optimize inventory across their network.

Given your role leading supply chain at {{company}}, I thought this might resonate. Would you be open to a quick call to see if there''s a fit?

Best,
{{sender_name}}',
  1, 'professional'),

-- Technical evaluator
('Technical First Touch', 'technical', NULL,
  'C3 AI platform architecture — built for enterprise scale',
  'Hi {{first_name}},

I''m reaching out because {{company}} appears to be investing in AI/ML capabilities, and I wanted to introduce C3 AI''s platform.

What makes us different: C3 AI is a purpose-built enterprise AI platform (not a toolkit or consulting engagement). We deploy production-grade AI applications in weeks, not months, with pre-built models for {{use_case_area}}.

Our platform runs on {{cloud_provider}} and integrates with existing data infrastructure — no rip-and-replace required.

Would a technical deep-dive be useful for your team?

Best,
{{sender_name}}',
  1, 'technical'),

-- Event follow-up
('Event Follow-up', 'executive', NULL,
  'Following up from {{event_name}}',
  'Hi {{first_name}},

It was great connecting at {{event_name}}. As we discussed, C3 AI has been helping companies in {{industry}} tackle {{use_case_area}} — with {{similar_customer}} being a recent example where they saw {{value_delivered}}.

I''d love to continue our conversation and explore whether there''s a fit for {{company}}. Do you have 20 minutes next week?

Best,
{{sender_name}}',
  1, 'executive'),

-- Breakup email (last in sequence)
('Sequence Closer', 'executive', NULL,
  'Closing the loop — {{company}} + C3 AI',
  'Hi {{first_name}},

I''ve reached out a few times about how C3 AI could help {{company}} with {{use_case_area}}. I don''t want to be a nuisance, so this will be my last note for now.

If the timing isn''t right, I completely understand. But if AI-driven {{use_case_area}} becomes a priority, I''d welcome the chance to share what we''ve learned working with {{similar_customer}} and others in {{industry}}.

Wishing you and the {{company}} team all the best.

{{sender_name}}',
  5, 'professional');

-- ============================================================
-- TARGET INDUSTRIES
-- ============================================================

INSERT INTO target_industries (name, c3_products, key_use_cases, typical_champion_titles, market_size_notes) VALUES
('Manufacturing', '["C3 AI Reliability", "C3 AI Supply Chain", "C3 AI PSO", "C3 AI Inventory Optimization"]',
  '["Asset Performance Management", "Supply Chain Optimization", "Production Schedule Optimization", "Inventory Optimization", "Quality Management"]',
  '["VP Operations", "VP Supply Chain", "VP Manufacturing", "CIO", "Director of Reliability"]',
  'Largest vertical by deal count. Heavy asset base = strong APM fit.'),
('Energy', '["C3 AI Reliability", "C3 AI Energy Management", "C3 AI Supply Chain"]',
  '["Predictive Maintenance", "Grid Analytics", "Asset Performance Management", "Energy Trading Optimization"]',
  '["VP Asset Management", "VP Grid Operations", "Director of Reliability", "CTO"]',
  'Strong regulatory tailwinds. Grid modernization driving investment.'),
('Financial Services', '["C3 AI AML", "C3 AI Fraud", "C3 AI CRM"]',
  '["Anti-Money Laundering", "Fraud Detection", "Customer Analytics", "Credit Risk"]',
  '["Chief Compliance Officer", "VP Risk", "CIO", "VP Data Analytics"]',
  'High TCV, long cycles. Compliance-driven urgency.'),
('Defense', '["C3 AI Readiness", "C3 AI Supply Chain"]',
  '["Readiness Optimization", "Predictive Logistics", "Condition-Based Maintenance"]',
  '["Program Manager", "Logistics Director", "Deputy CIO"]',
  'Federal acquisition process. Requires contract vehicles. Longest cycle.'),
('Retail', '["C3 AI Inventory Optimization", "C3 AI Supply Chain", "C3 AI CRM"]',
  '["Inventory Optimization", "Demand Forecasting", "Customer Analytics"]',
  '["VP Supply Chain", "VP Merchandising", "CIO"]',
  'Margin pressure driving AI adoption. Seasonal demand patterns.'),
('Aerospace', '["C3 AI Reliability", "C3 AI Supply Chain"]',
  '["MRO Optimization", "Predictive Maintenance", "Supply Chain Visibility"]',
  '["VP Maintenance", "VP Operations", "Director of MRO"]',
  'High asset value, strong APM/MRO fit.'),
('Pharma', '["C3 AI Supply Chain", "C3 AI Reliability"]',
  '["Supply Chain Visibility", "Manufacturing Optimization", "Quality Analytics"]',
  '["VP Supply Chain", "VP Manufacturing", "VP Quality"]',
  'Regulatory complexity. Cold chain and compliance requirements.'),
('Chemicals', '["C3 AI Reliability", "C3 AI Supply Chain"]',
  '["Process Optimization", "Asset Performance Management", "Supply Chain"]',
  '["VP Operations", "VP Manufacturing", "Plant Manager"]',
  'Process-intensive. Strong APM fit for continuous operations.');
