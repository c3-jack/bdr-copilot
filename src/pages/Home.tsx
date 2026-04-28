import { useState, useEffect } from 'react';

const API = import.meta.env.DEV ? 'http://localhost:3001' : '';

interface WinPreview { industry: string; useCase: string; champion: string; entry: string; deals: number; tcv: string }
interface CasePreview { customer: string; industry: string; useCase: string; value: string; isPublic: boolean }
interface PersonaPreview { useCase: string; titles: string; seniority: string; conversion: number }

interface HomeStats {
  seedData: {
    winPatterns: number;
    icpCriteria: number;
    targetIndustries: number;
    caseStudies: number;
    personas: number;
    outreachTemplates: number;
  };
  prospects: number;
  integrations: { zoominfo: boolean; dataverse: boolean; claude: boolean };
  industries: string[];
  topUseCases: string[];
  preview: {
    wins: WinPreview[];
    caseStudies: CasePreview[];
    personas: PersonaPreview[];
  };
}

const PROMPTS = [
  {
    label: 'Research a company',
    prompt: 'Research [COMPANY] for C3 AI. Search SharePoint and Confluence for any internal docs, past proposals, or engagement notes. Then tell me: what do they do, what are their AI initiatives, and which C3 use case fits best?',
  },
  {
    label: 'Draft a cold email',
    prompt: 'Draft a cold email to [NAME], [TITLE] at [COMPANY]. They\'re in [INDUSTRY]. Reference our case study with [SIMILAR_CUSTOMER] and focus on [USE_CASE]. Tone: executive, concise, no fluff.',
  },
  {
    label: 'Find lookalike companies',
    prompt: 'Find 5 companies similar to [COMPANY] that would be good C3 AI prospects. Same industry or adjacent, similar size, similar operational challenges. For each one tell me why they\'re a fit and who to target.',
  },
  {
    label: 'Prep for a meeting',
    prompt: 'I have a meeting with [NAME] ([TITLE]) at [COMPANY] tomorrow. Search SharePoint for any past engagement docs. Give me: 3 talking points, 2 questions to ask, the best case study to reference, and any landmines to avoid.',
  },
  {
    label: 'Build an outreach sequence',
    prompt: 'Build a 4-email outreach sequence for [TITLE] personas at [INDUSTRY] companies. Use case: [USE_CASE]. First email should be a cold intro, then value prop, then case study, then break-up. Keep each under 100 words.',
  },
];

export default function Home() {
  const [stats, setStats] = useState<HomeStats | null>(null);
  const [copied, setCopied] = useState<number | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API}/api/home/stats`).then(r => r.json()).then(setStats).catch(() => {});
  }, []);

  function copyPrompt(index: number) {
    navigator.clipboard.writeText(PROMPTS[index].prompt);
    setCopied(index);
    setTimeout(() => setCopied(null), 2000);
  }

  function toggle(key: string) {
    setExpanded(expanded === key ? null : key);
  }

  return (
    <div className="max-w-2xl">
      <h2 className="text-lg font-semibold text-neutral-100 mb-0.5">BDR Copilot</h2>
      <p className="text-neutral-500 text-sm mb-6">
        Prospecting intelligence for C3 AI. Use the tools here or copy prompts into Claude Desktop.
      </p>

      {/* Integrations */}
      <section className="mb-5">
        <h3 className="text-xs font-medium text-neutral-400 uppercase tracking-wider mb-2">Integrations</h3>
        <div className="bg-neutral-900 border border-neutral-800 rounded p-3 space-y-1.5">
          <Integration name="Claude Code" connected={stats?.integrations.claude ?? false} detail="Powers all AI features" />
          <Integration name="Dynamics 365" connected={stats?.integrations.dataverse ?? false} detail="CRM via Dataverse MCP — accounts, pipeline, contacts" />
          <Integration name="ZoomInfo" connected={stats?.integrations.zoominfo ?? false} detail="Company + contact enrichment" />
          <Integration name="SharePoint" connected detail="Via Claude MCP — search internal docs" alwaysOn />
          <Integration name="Confluence" connected detail="Via Claude MCP — search wiki pages" alwaysOn />
          <Integration name="LinkedIn Sales Nav" connected detail="Direct links, no API needed" alwaysOn />
        </div>
      </section>

      {/* Getting Started */}
      {stats && stats.prospects === 0 && (
        <section className="mb-5">
          <h3 className="text-xs font-medium text-neutral-400 uppercase tracking-wider mb-2">Get Started</h3>
          <div className="bg-neutral-900 border border-neutral-800 rounded p-3 space-y-2">
            <div className="flex items-center gap-2.5">
              <span className="w-5 h-5 rounded-full bg-neutral-800 text-neutral-400 text-[11px] flex items-center justify-center font-medium">1</span>
              <span className="text-sm text-neutral-300">Check your integrations below</span>
            </div>
            <div className="flex items-center gap-2.5">
              <span className="w-5 h-5 rounded-full bg-neutral-800 text-neutral-400 text-[11px] flex items-center justify-center font-medium">2</span>
              <a href="/discover" className="text-sm text-neutral-200 hover:text-white underline underline-offset-2">Find your first targets</a>
            </div>
            <div className="flex items-center gap-2.5">
              <span className="w-5 h-5 rounded-full bg-neutral-800 text-neutral-400 text-[11px] flex items-center justify-center font-medium">3</span>
              <a href="/outreach" className="text-sm text-neutral-300 hover:text-white underline underline-offset-2">Draft personalized outreach</a>
            </div>
          </div>
        </section>
      )}

      {/* Win Patterns — only show when data exists */}
      {stats && stats.seedData.winPatterns > 0 && (
      <section className="mb-5">
        <button onClick={() => toggle('wins')} className="flex items-center justify-between w-full mb-2">
          <h3 className="text-xs font-medium text-neutral-400 uppercase tracking-wider">
            Win Patterns <span className="text-neutral-600 normal-case font-normal ml-1">{stats.seedData.winPatterns} loaded</span>
          </h3>
          <span className="text-[11px] text-neutral-600">{expanded === 'wins' ? 'Hide' : 'Show'}</span>
        </button>
        {expanded === 'wins' && stats?.preview.wins && (
          <div className="bg-neutral-900 border border-neutral-800 rounded overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-neutral-800 text-neutral-500">
                  <th className="text-left px-3 py-2 font-medium">Industry</th>
                  <th className="text-left px-3 py-2 font-medium">Use Case</th>
                  <th className="text-left px-3 py-2 font-medium">Champion</th>
                  <th className="text-left px-3 py-2 font-medium">Entry</th>
                  <th className="text-right px-3 py-2 font-medium">Deals</th>
                </tr>
              </thead>
              <tbody>
                {stats.preview.wins.map((w, i) => (
                  <tr key={i} className="border-b border-neutral-800/50 text-neutral-400">
                    <td className="px-3 py-1.5">{w.industry}</td>
                    <td className="px-3 py-1.5 text-neutral-300">{w.useCase}</td>
                    <td className="px-3 py-1.5">{w.champion}</td>
                    <td className="px-3 py-1.5">{w.entry}</td>
                    <td className="px-3 py-1.5 text-right text-neutral-500">{w.deals}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      )}

      {/* Case Studies — only show when data exists */}
      {stats && stats.seedData.caseStudies > 0 && (
      <section className="mb-5">
        <button onClick={() => toggle('cases')} className="flex items-center justify-between w-full mb-2">
          <h3 className="text-xs font-medium text-neutral-400 uppercase tracking-wider">
            Case Studies <span className="text-neutral-600 normal-case font-normal ml-1">{stats.seedData.caseStudies} loaded</span>
          </h3>
          <span className="text-[11px] text-neutral-600">{expanded === 'cases' ? 'Hide' : 'Show'}</span>
        </button>
        {expanded === 'cases' && stats?.preview.caseStudies && (
          <div className="bg-neutral-900 border border-neutral-800 rounded divide-y divide-neutral-800">
            {stats.preview.caseStudies.map((c, i) => (
              <div key={i} className="px-3 py-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-neutral-200">{c.customer}</span>
                  <span className="text-[10px] px-1 py-0.5 bg-neutral-800 text-neutral-500 rounded">{c.industry}</span>
                  {c.isPublic && <span className="text-[10px] px-1 py-0.5 bg-emerald-900/30 text-emerald-500 rounded">Public</span>}
                </div>
                <p className="text-[11px] text-neutral-500 mt-0.5">{c.useCase} — {c.value}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      )}

      {/* Personas — only show when data exists */}
      {stats && stats.seedData.personas > 0 && (
      <section className="mb-5">
        <button onClick={() => toggle('personas')} className="flex items-center justify-between w-full mb-2">
          <h3 className="text-xs font-medium text-neutral-400 uppercase tracking-wider">
            Target Personas <span className="text-neutral-600 normal-case font-normal ml-1">{stats.seedData.personas} loaded</span>
          </h3>
          <span className="text-[11px] text-neutral-600">{expanded === 'personas' ? 'Hide' : 'Show'}</span>
        </button>
        {expanded === 'personas' && stats?.preview.personas && (
          <div className="bg-neutral-900 border border-neutral-800 rounded divide-y divide-neutral-800">
            {stats.preview.personas.map((p, i) => (
              <div key={i} className="px-3 py-2 flex items-center justify-between">
                <div>
                  <span className="text-sm text-neutral-300">{p.titles}</span>
                  <span className="text-[11px] text-neutral-600 ml-2">{p.seniority}</span>
                </div>
                <div className="text-right">
                  <span className="text-[11px] text-neutral-500">{p.useCase}</span>
                  <span className="text-[11px] text-emerald-500 ml-2">{Math.round(p.conversion * 100)}% conv.</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      )}

      {/* What each tab does */}
      <section className="mb-5">
        <h3 className="text-xs font-medium text-neutral-400 uppercase tracking-wider mb-2">What each tab does</h3>
        <div className="bg-neutral-900 border border-neutral-800 rounded divide-y divide-neutral-800">
          <Feature name="Find Targets" description="Search for companies matching C3's ICP. Scores each prospect against win patterns and recommends use cases + entry titles." />
          <Feature name="Draft Outreach" description="Generate personalized email sequences. Picks the right template, references relevant case studies, tailors tone to persona." />
          <Feature name="My Pipeline" description="Track prospects from discovery through outreach. Enriches with ZoomInfo, flags stale leads, generates LinkedIn links." />
        </div>
      </section>

      {/* Claude prompts */}
      <section className="mb-5">
        <h3 className="text-xs font-medium text-neutral-400 uppercase tracking-wider mb-1">Prompts for Claude Desktop</h3>
        <p className="text-[11px] text-neutral-600 mb-2">
          Open Claude Desktop and paste these. It has access to SharePoint + Confluence via MCP.
        </p>
        <div className="space-y-2">
          {PROMPTS.map((p, i) => (
            <div key={i} className="bg-neutral-900 border border-neutral-800 rounded p-3">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-sm text-neutral-200 font-medium">{p.label}</span>
                <button
                  onClick={() => copyPrompt(i)}
                  className="text-[11px] text-neutral-500 hover:text-neutral-300 transition-colors"
                >
                  {copied === i ? 'Copied' : 'Copy'}
                </button>
              </div>
              <p className="text-xs text-neutral-500 font-mono leading-relaxed">{p.prompt}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Coverage tags */}
      {stats && (
        <section className="mb-8">
          <h3 className="text-xs font-medium text-neutral-400 uppercase tracking-wider mb-2">Coverage</h3>
          <div className="bg-neutral-900 border border-neutral-800 rounded p-3">
            <div className="mb-3">
              <p className="text-[11px] text-neutral-500 mb-1">Target industries</p>
              <div className="flex flex-wrap gap-1">
                {stats.industries.map(ind => (
                  <span key={ind} className="text-[11px] px-1.5 py-0.5 bg-neutral-800 text-neutral-400 rounded">{ind}</span>
                ))}
              </div>
            </div>
            <div>
              <p className="text-[11px] text-neutral-500 mb-1">Top use cases</p>
              <div className="flex flex-wrap gap-1">
                {stats.topUseCases.map(uc => (
                  <span key={uc} className="text-[11px] px-1.5 py-0.5 bg-neutral-800 text-neutral-400 rounded">{uc as string}</span>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

function Integration({ name, connected, detail, alwaysOn }: {
  name: string; connected: boolean; detail: string; alwaysOn?: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-0.5">
      <div className="flex items-center gap-2">
        <div className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-emerald-400' : 'bg-neutral-600'}`} />
        <span className="text-sm text-neutral-300">{name}</span>
      </div>
      <span className="text-[11px] text-neutral-600">
        {alwaysOn ? detail : connected ? detail : 'Not configured — see Settings'}
      </span>
    </div>
  );
}

function Feature({ name, description }: { name: string; description: string }) {
  return (
    <div className="px-3 py-2.5">
      <span className="text-sm text-neutral-200 font-medium">{name}</span>
      <p className="text-[11px] text-neutral-500 mt-0.5 leading-relaxed">{description}</p>
    </div>
  );
}
