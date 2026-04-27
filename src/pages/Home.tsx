import { useState, useEffect } from 'react';

const API = import.meta.env.DEV ? 'http://localhost:3001' : '';

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
  integrations: {
    zoominfo: boolean;
    dynamics: boolean;
    claude: boolean;
  };
  industries: string[];
  topUseCases: string[];
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

  useEffect(() => {
    fetch(`${API}/api/home/stats`).then(r => r.json()).then(setStats).catch(() => {});
  }, []);

  function copyPrompt(index: number) {
    navigator.clipboard.writeText(PROMPTS[index].prompt);
    setCopied(index);
    setTimeout(() => setCopied(null), 2000);
  }

  return (
    <div className="max-w-2xl">
      <h2 className="text-lg font-semibold text-neutral-100 mb-0.5">BDR Copilot</h2>
      <p className="text-neutral-500 text-sm mb-6">
        Prospecting intelligence for C3 AI. Use the tools here or copy prompts into Claude Desktop.
      </p>

      {/* What's loaded */}
      <section className="mb-6">
        <h3 className="text-xs font-medium text-neutral-400 uppercase tracking-wider mb-2">Your data</h3>
        <div className="grid grid-cols-3 gap-2">
          {stats ? (
            <>
              <Stat label="Win patterns" value={stats.seedData.winPatterns} />
              <Stat label="Case studies" value={stats.seedData.caseStudies} />
              <Stat label="Target industries" value={stats.seedData.targetIndustries} />
              <Stat label="Personas" value={stats.seedData.personas} />
              <Stat label="Email templates" value={stats.seedData.outreachTemplates} />
              <Stat label="Saved prospects" value={stats.prospects} />
            </>
          ) : (
            Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-neutral-900 border border-neutral-800 rounded p-3 animate-pulse h-16" />
            ))
          )}
        </div>
      </section>

      {/* Integrations */}
      <section className="mb-6">
        <h3 className="text-xs font-medium text-neutral-400 uppercase tracking-wider mb-2">Integrations</h3>
        <div className="bg-neutral-900 border border-neutral-800 rounded p-3 space-y-1.5">
          <Integration name="Claude Code" connected={stats?.integrations.claude ?? false} detail="Powers all AI features" />
          <Integration name="Dynamics 365" connected={stats?.integrations.dynamics ?? false} detail="CRM accounts + pipeline" />
          <Integration name="ZoomInfo" connected={stats?.integrations.zoominfo ?? false} detail="Company + contact enrichment" />
          <Integration name="SharePoint" connected detail="Via Claude MCP — search internal docs" alwaysOn />
          <Integration name="Confluence" connected detail="Via Claude MCP — search wiki pages" alwaysOn />
          <Integration name="LinkedIn Sales Nav" connected detail="Direct links, no API needed" alwaysOn />
        </div>
      </section>

      {/* How to use */}
      <section className="mb-6">
        <h3 className="text-xs font-medium text-neutral-400 uppercase tracking-wider mb-2">What each tab does</h3>
        <div className="bg-neutral-900 border border-neutral-800 rounded divide-y divide-neutral-800">
          <Feature
            name="Find Targets"
            description="Search for companies matching C3's ICP. Scores each prospect against win patterns and recommends use cases + entry titles."
          />
          <Feature
            name="Draft Outreach"
            description="Generate personalized email sequences. Picks the right template, references relevant case studies, tailors tone to persona."
          />
          <Feature
            name="My Pipeline"
            description="Pulls your Dynamics 365 accounts, enriches with ZoomInfo, flags stale leads, suggests next actions."
          />
        </div>
      </section>

      {/* Claude prompts */}
      <section className="mb-8">
        <h3 className="text-xs font-medium text-neutral-400 uppercase tracking-wider mb-1">Prompts for Claude</h3>
        <p className="text-[11px] text-neutral-600 mb-2">
          Copy these into Claude Desktop. It has access to SharePoint + Confluence via MCP.
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

      {/* Industries + use cases */}
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

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded p-3">
      <div className="text-lg font-semibold text-neutral-100">{value}</div>
      <div className="text-[11px] text-neutral-500">{label}</div>
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
