import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getPipeline, updateProspectStatus, getContacts, enrichProspect, syncDynamics, getTimingIntelligence, type Prospect, type ZiContactWithLinks, type ZiCompany, type ZiIntent, type LinkedInLinks, type TimingIntelligence } from '../lib/api';
import SignalBadge from '../components/SignalBadge';

const STATUS_FILTERS = ['all', 'new', 'researched', 'contacted', 'qualified', 'disqualified'];

const statusColors: Record<string, string> = {
  new: 'bg-blue-500/10 text-blue-400',
  researched: 'bg-violet-500/10 text-violet-400',
  contacted: 'bg-amber-500/10 text-amber-400',
  qualified: 'bg-emerald-500/10 text-emerald-400',
  disqualified: 'bg-red-500/10 text-red-400',
};

function scoreColor(score: number): string {
  if (score >= 70) return 'text-green-400';
  if (score >= 40) return 'text-amber-400';
  return 'text-neutral-500';
}

interface EnrichmentData {
  company: ZiCompany | null;
  intent: ZiIntent[];
  linkedIn: LinkedInLinks;
  contacts: ZiContactWithLinks[];
  configured: boolean;
}

export default function Pipeline() {
  const navigate = useNavigate();
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<'score' | 'date' | 'company'>('score');
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [enrichment, setEnrichment] = useState<EnrichmentData | null>(null);
  const [enrichLoading, setEnrichLoading] = useState(false);
  const [timing, setTiming] = useState<TimingIntelligence | null>(null);
  const [timingLoading, setTimingLoading] = useState(false);
  const [timingId, setTimingId] = useState<number | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState('');
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    loadProspects();
  }, [filter]);

  async function loadProspects() {
    setLoading(true);
    try {
      const status = filter === 'all' ? undefined : filter;
      const result = await getPipeline(status);
      setProspects(result.prospects);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSyncDynamics() {
    setSyncing(true);
    setSyncError('');
    try {
      await syncDynamics();
      await loadProspects();
    } catch (err) {
      setSyncError((err as Error).message);
    } finally {
      setSyncing(false);
    }
  }

  async function handleStatusChange(id: number, newStatus: string) {
    try {
      await updateProspectStatus(id, newStatus);
      await loadProspects();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function handleExpand(prospect: Prospect) {
    if (expandedId === prospect.id) {
      setExpandedId(null);
      setEnrichment(null);
      return;
    }
    setExpandedId(prospect.id);
    setEnrichLoading(true);
    setEnrichment(null);
    try {
      const [enrichRes, contactsRes] = await Promise.all([
        enrichProspect(prospect.id),
        getContacts(prospect.id),
      ]);
      setEnrichment({
        company: enrichRes.company,
        intent: enrichRes.intent,
        linkedIn: enrichRes.linkedIn,
        contacts: contactsRes.contacts,
        configured: enrichRes.configured !== false,
      });
    } catch {
      setEnrichment({ company: null, intent: [], linkedIn: { profileSearch: '', salesNavSearch: '', companyPage: '' }, contacts: [], configured: false });
    } finally {
      setEnrichLoading(false);
    }
  }

  async function handleTiming(prospect: Prospect) {
    if (timingId === prospect.id) {
      setTimingId(null);
      setTiming(null);
      return;
    }
    setTimingId(prospect.id);
    setTimingLoading(true);
    setTiming(null);
    try {
      const res = await getTimingIntelligence(prospect.id);
      setTiming(res.timing);
    } catch {
      setTiming(null);
    } finally {
      setTimingLoading(false);
    }
  }

  const filtered = search
    ? prospects.filter(p => p.company_name.toLowerCase().includes(search.toLowerCase()))
    : prospects;

  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === 'score') return (b.score ?? 0) - (a.score ?? 0);
    if (sortBy === 'date') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    return a.company_name.localeCompare(b.company_name);
  });

  return (
    <div className="max-w-4xl">
      <h2 className="text-lg font-semibold text-neutral-100 mb-0.5">My Pipeline</h2>
      <div className="flex items-center justify-between mb-5">
        <p className="text-neutral-500 text-sm">
          Track and manage discovered prospects.
        </p>
        <button
          onClick={handleSyncDynamics}
          disabled={syncing}
          className="px-3 py-1.5 text-xs bg-neutral-800 hover:bg-neutral-700 disabled:text-neutral-600 text-neutral-300 rounded transition-colors"
        >
          {syncing ? 'Syncing...' : 'Sync from CRM'}
        </button>
      </div>

      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search companies..."
            className="px-2.5 py-1 text-xs bg-neutral-900 border border-neutral-800 rounded text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-neutral-600 w-40"
          />
          <div className="flex gap-1.5">
            {STATUS_FILTERS.map(s => (
              <button
                key={s}
                onClick={() => setFilter(s)}
                className={`px-2.5 py-1 text-xs rounded transition-colors capitalize ${
                  filter === s
                    ? 'bg-neutral-100 text-neutral-900 font-medium'
                    : 'text-neutral-500 hover:text-neutral-200 hover:bg-neutral-800'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] text-neutral-600">Sort:</span>
          {(['score', 'date', 'company'] as const).map(s => (
            <button
              key={s}
              onClick={() => setSortBy(s)}
              className={`px-1.5 py-0.5 text-[11px] rounded transition-colors capitalize ${
                sortBy === s ? 'text-neutral-200' : 'text-neutral-600 hover:text-neutral-400'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="bg-red-950/50 border border-red-900/50 text-red-400 px-3 py-2 rounded text-sm mb-4">
          {error}
        </div>
      )}
      {syncError && (
        <div className="bg-red-950/50 border border-red-900/50 text-red-400 px-3 py-2 rounded text-sm mb-4">
          {syncError}
        </div>
      )}

      {loading ? (
        <div className="text-center py-16">
          <div className="inline-block w-5 h-5 border-2 border-neutral-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : sorted.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-neutral-400 text-sm mb-4">
            {filter === 'all'
              ? 'No prospects in your pipeline yet.'
              : `No "${filter}" prospects.`}
          </p>
          {filter === 'all' && (
            <div className="flex items-center justify-center gap-3">
              <a
                href="/discover"
                className="px-4 py-2 bg-neutral-100 hover:bg-white text-neutral-900 text-sm font-medium rounded transition-colors"
              >
                Find Targets
              </a>
              <button
                onClick={handleSyncDynamics}
                disabled={syncing}
                className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 disabled:bg-neutral-800 disabled:text-neutral-600 text-neutral-200 text-sm rounded transition-colors"
              >
                {syncing ? 'Syncing...' : 'Sync from Dynamics'}
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {sorted.map(prospect => (
            <div
              key={prospect.id}
              className={`bg-neutral-900 border rounded transition-colors ${
                prospect.isStale ? 'border-amber-900/40' : 'border-neutral-800'
              }`}
            >
              <div className="p-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <h3 className="text-sm font-medium text-neutral-200">{prospect.company_name}</h3>
                      <span className={`text-[11px] px-1.5 py-0.5 rounded capitalize ${statusColors[prospect.status] ?? statusColors.new}`}>
                        {prospect.status}
                      </span>
                      {prospect.isStale && (
                        <span className="text-[11px] text-amber-500">
                          {prospect.daysSinceUpdate}d stale
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-neutral-500 mb-1.5">
                      {prospect.industry}{prospect.revenue_b != null && ` · $${prospect.revenue_b}B`}
                      {prospect.recommended_use_case && (
                        <> &middot; <span className="text-neutral-400">{prospect.recommended_use_case}</span></>
                      )}
                      {prospect.recommended_title && (
                        <> &middot; <span className="text-neutral-400">{prospect.recommended_title}</span></>
                      )}
                    </p>
                    {prospect.signals && prospect.signals.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {prospect.signals.slice(0, 4).map((s, i) => (
                          <SignalBadge key={i} signal={s} />
                        ))}
                        {prospect.signals.length > 4 && (
                          <span className="text-[11px] text-neutral-600">+{prospect.signals.length - 4}</span>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-3 ml-4">
                    <button
                      onClick={() => handleTiming(prospect)}
                      disabled={timingLoading && timingId === prospect.id}
                      className={`text-xs px-2 py-1 rounded transition-colors ${
                        timingId === prospect.id && timing
                          ? 'bg-violet-500/20 text-violet-400 font-medium'
                          : 'text-neutral-500 hover:text-neutral-200 hover:bg-neutral-800'
                      }`}
                    >
                      {timingLoading && timingId === prospect.id ? 'Researching...' : 'Timing'}
                    </button>
                    <button
                      onClick={() => navigate(`/outreach?prospectId=${prospect.id}`)}
                      className="text-xs px-2 py-1 rounded text-neutral-500 hover:text-neutral-200 hover:bg-neutral-800 transition-colors"
                    >
                      Outreach
                    </button>
                    <button
                      onClick={() => handleExpand(prospect)}
                      className={`text-xs px-2 py-1 rounded transition-colors ${
                        expandedId === prospect.id
                          ? 'bg-neutral-100 text-neutral-900 font-medium'
                          : 'text-neutral-500 hover:text-neutral-200 hover:bg-neutral-800'
                      }`}
                    >
                      {expandedId === prospect.id ? 'Close' : 'Enrich'}
                    </button>
                    <span className={`text-base font-semibold tabular-nums ${scoreColor(prospect.score ?? 0)}`}>
                      {prospect.score ?? '--'}
                    </span>
                    <select
                      value={prospect.status}
                      onChange={e => handleStatusChange(prospect.id, e.target.value)}
                      className="text-[11px] bg-neutral-800 border border-neutral-700 rounded px-1.5 py-0.5 text-neutral-400"
                    >
                      {STATUS_FILTERS.filter(s => s !== 'all').map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {timingId === prospect.id && (timing || timingLoading) && (
                <div className="border-t border-neutral-800 p-3">
                  {timingLoading ? (
                    <div className="flex items-center gap-2 text-neutral-500 text-xs py-3">
                      <div className="w-3.5 h-3.5 border-2 border-neutral-500 border-t-transparent rounded-full animate-spin" />
                      Deep timing research (searching web, then SharePoint, then analyzing)...
                    </div>
                  ) : timing ? (
                    <TimingPanel timing={timing} prospect={prospect} navigate={navigate} />
                  ) : null}
                </div>
              )}

              {expandedId === prospect.id && (
                <div className="border-t border-neutral-800 p-3">
                  {enrichLoading ? (
                    <div className="flex items-center gap-2 text-neutral-500 text-xs py-3">
                      <div className="w-3.5 h-3.5 border-2 border-neutral-500 border-t-transparent rounded-full animate-spin" />
                      Fetching enrichment data...
                    </div>
                  ) : enrichment ? (
                    <div className="space-y-3">
                      <div className="flex gap-3 text-xs">
                        <a href={enrichment.linkedIn.companyPage} target="_blank" rel="noopener noreferrer" className="text-neutral-400 hover:text-neutral-200 underline underline-offset-2">
                          LinkedIn
                        </a>
                        <a href={enrichment.linkedIn.salesNavSearch} target="_blank" rel="noopener noreferrer" className="text-neutral-400 hover:text-neutral-200 underline underline-offset-2">
                          Sales Navigator
                        </a>
                      </div>

                      {enrichment.company && (
                        <div className="bg-neutral-800/40 rounded p-2.5">
                          <h4 className="text-[11px] text-neutral-500 uppercase tracking-wider mb-1.5">Company</h4>
                          <div className="grid grid-cols-3 gap-2 text-xs">
                            <div>
                              <span className="text-neutral-500">Revenue</span>
                              <p className="text-neutral-200">{enrichment.company.revenueRange || `$${(enrichment.company.revenue / 1e6).toFixed(0)}M`}</p>
                            </div>
                            <div>
                              <span className="text-neutral-500">Employees</span>
                              <p className="text-neutral-200">{enrichment.company.employeeCount?.toLocaleString()}</p>
                            </div>
                            <div>
                              <span className="text-neutral-500">HQ</span>
                              <p className="text-neutral-200">{enrichment.company.city}, {enrichment.company.state}</p>
                            </div>
                            <div>
                              <span className="text-neutral-500">Sub-Industry</span>
                              <p className="text-neutral-200">{enrichment.company.subIndustry}</p>
                            </div>
                            <div>
                              <span className="text-neutral-500">Website</span>
                              <p className="text-neutral-200">{enrichment.company.website}</p>
                            </div>
                            {enrichment.company.ticker && (
                              <div>
                                <span className="text-neutral-500">Ticker</span>
                                <p className="text-neutral-200">{enrichment.company.ticker}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {enrichment.intent.length > 0 && (
                        <div className="bg-neutral-800/40 rounded p-2.5">
                          <h4 className="text-[11px] text-neutral-500 uppercase tracking-wider mb-1.5">Intent Signals</h4>
                          <div className="flex flex-wrap gap-1.5">
                            {enrichment.intent.map((intent, i) => (
                              <span key={i} className="text-[11px] px-1.5 py-0.5 rounded bg-violet-500/10 text-violet-400">
                                {intent.topicName} ({intent.signalScore})
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {enrichment.contacts.length > 0 && (
                        <div className="bg-neutral-800/40 rounded p-2.5">
                          <h4 className="text-[11px] text-neutral-500 uppercase tracking-wider mb-1.5">
                            Contacts ({enrichment.contacts.length})
                          </h4>
                          <div className="space-y-1.5">
                            {enrichment.contacts.slice(0, 8).map((c, i) => (
                              <div key={i} className="flex items-center justify-between text-xs">
                                <div>
                                  <span className="text-neutral-200">{c.fullName}</span>
                                  <span className="text-neutral-500 ml-1.5">{c.jobTitle}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  {c.email && <span className="text-[11px] text-neutral-500">{c.email}</span>}
                                  <a href={c.linkedIn.profileSearch} target="_blank" rel="noopener noreferrer" className="text-[11px] text-neutral-500 hover:text-neutral-300">LI</a>
                                  <a href={c.linkedIn.salesNavSearch} target="_blank" rel="noopener noreferrer" className="text-[11px] text-neutral-500 hover:text-neutral-300">SN</a>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {!enrichment.configured && (
                        <p className="text-[11px] text-neutral-600">
                          ZoomInfo not configured. Add credentials in Settings for contact enrichment.
                        </p>
                      )}
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {!loading && sorted.length > 0 && (
        <p className="text-[11px] text-neutral-600 mt-3">
          {sorted.length} prospect{sorted.length !== 1 ? 's' : ''} &middot;
          {sorted.filter(p => p.isStale).length} stale &middot;
          avg score {Math.round(sorted.reduce((sum, p) => sum + (p.score ?? 0), 0) / sorted.length)}
        </p>
      )}
    </div>
  );
}

// ── Timing Panel (two-tier: summary always visible, details behind toggle) ──

const urgencyStyles: Record<string, string> = {
  'strike-now': 'bg-emerald-500/10 text-emerald-400',
  'warming': 'bg-amber-500/10 text-amber-400',
  'early-stage': 'bg-blue-500/10 text-blue-400',
  'not-ready': 'bg-neutral-800/40 text-neutral-400',
};

const roleColors: Record<string, string> = {
  'economic-buyer': 'text-emerald-400',
  'champion': 'text-blue-400',
  'evaluator': 'text-violet-400',
  'coach': 'text-amber-400',
  'blocker': 'text-red-400',
};

function TimingPanel({ timing, prospect, navigate }: { timing: TimingIntelligence; prospect: Prospect; navigate: (path: string) => void }) {
  const [showDetails, setShowDetails] = useState(false);
  const tw = timing.recommendedTimingWindow;
  const strategy = timing.outreachStrategy;

  // Build timing context to pass to outreach
  const timingContext = [
    tw.urgency !== 'not-ready' && strategy.hook ? `Timing hook: ${strategy.hook}` : '',
    timing.triggerEvents.slice(0, 2).map(t => `Trigger: ${t.event} (${t.date})`).join('\n'),
    timing.buyerMap.filter(b => b.role === 'economic-buyer').map(b => `Economic buyer: ${b.name}, ${b.title}`).join('\n'),
    strategy.opener ? `Suggested opener: ${strategy.opener}` : '',
  ].filter(Boolean).join('\n');

  return (
    <div className="space-y-3">
      {/* ── Tier 1: Always visible ── */}

      {/* Urgency + confidence */}
      <div className={`rounded p-2.5 ${urgencyStyles[tw.urgency] ?? urgencyStyles['not-ready']}`}>
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium uppercase tracking-wider">
              {tw.urgency.replace('-', ' ')}
            </span>
            <span className={`text-[11px] px-1.5 py-0.5 rounded ${
              tw.confidence === 'high' ? 'bg-emerald-500/20' :
              tw.confidence === 'medium' ? 'bg-amber-500/20' : 'bg-neutral-700'
            }`}>
              {tw.confidence} confidence
            </span>
          </div>
          <span className="text-xs">{tw.window}</span>
        </div>
        <p className="text-xs">{tw.reasoning}</p>
        {tw.urgency === 'not-ready' && tw.revisitDate && (
          <p className="text-[11px] mt-1 opacity-75">Re-check: {tw.revisitDate}</p>
        )}
      </div>

      {/* Strategy */}
      <div className="bg-neutral-800/40 rounded p-2.5">
        <h4 className="text-[11px] text-neutral-500 uppercase tracking-wider mb-1">Outreach Strategy</h4>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <span className="text-neutral-500">Channel</span>
            <p className="text-neutral-300 capitalize">{strategy.channel}</p>
          </div>
          <div>
            <span className="text-neutral-500">Timing</span>
            <p className="text-neutral-300">{strategy.timing}</p>
          </div>
        </div>
        {strategy.hook && (
          <p className="text-xs text-neutral-400 mt-1.5">
            <span className="text-neutral-500">Hook:</span> {strategy.hook}
          </p>
        )}
        {strategy.opener && (
          <p className="text-xs text-neutral-300 mt-1 italic">&ldquo;{strategy.opener}&rdquo;</p>
        )}
      </div>

      {/* Top 2 trigger events */}
      {timing.triggerEvents.length > 0 && (
        <div className="bg-neutral-800/40 rounded p-2.5">
          <h4 className="text-[11px] text-neutral-500 uppercase tracking-wider mb-1.5">Top Triggers</h4>
          {timing.triggerEvents.slice(0, 2).map((t, i) => (
            <div key={i} className="flex items-start justify-between text-xs gap-2 mb-1">
              <div className="flex-1 min-w-0">
                <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1.5 ${
                  t.significance === 'high' ? 'bg-emerald-400' :
                  t.significance === 'medium' ? 'bg-amber-400' : 'bg-neutral-500'
                }`} />
                <span className="text-neutral-300">{t.event}</span>
                <span className="text-neutral-600 ml-1.5">{t.date}</span>
              </div>
              <a href={t.url} target="_blank" rel="noreferrer" className="text-[11px] text-blue-400 hover:underline shrink-0">source</a>
            </div>
          ))}
        </div>
      )}

      {/* Action row */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => navigate(`/outreach?prospectId=${prospect.id}&timingContext=${encodeURIComponent(timingContext)}`)}
          className="text-xs px-3 py-1.5 bg-neutral-100 text-neutral-900 font-medium rounded hover:bg-white transition-colors"
        >
          Write Outreach with Timing
        </button>
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="text-[11px] text-neutral-500 hover:text-neutral-300 transition-colors"
        >
          {showDetails ? 'Hide details' : 'Full intel'}
        </button>
      </div>

      {/* ── Tier 2: Behind "Full intel" toggle ── */}
      {showDetails && (
        <div className="space-y-3">
          {/* All trigger events */}
          {timing.triggerEvents.length > 2 && (
            <div className="bg-neutral-800/40 rounded p-2.5">
              <h4 className="text-[11px] text-neutral-500 uppercase tracking-wider mb-1.5">All Trigger Events</h4>
              <div className="space-y-1.5">
                {timing.triggerEvents.slice(2).map((t, i) => (
                  <div key={i} className="flex items-start justify-between text-xs gap-2">
                    <div className="flex-1 min-w-0">
                      <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1.5 ${
                        t.significance === 'high' ? 'bg-emerald-400' :
                        t.significance === 'medium' ? 'bg-amber-400' : 'bg-neutral-500'
                      }`} />
                      <span className="text-neutral-300">{t.event}</span>
                      <span className="text-neutral-600 ml-1.5">{t.date}</span>
                      {t.confidence === 'inferred' && <span className="text-[11px] text-neutral-600 ml-1">(inferred)</span>}
                    </div>
                    <a href={t.url} target="_blank" rel="noreferrer" className="text-[11px] text-blue-400 hover:underline shrink-0">source</a>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Buyer map */}
          {timing.buyerMap?.length > 0 && (
            <div className="bg-neutral-800/40 rounded p-2.5">
              <h4 className="text-[11px] text-neutral-500 uppercase tracking-wider mb-1.5">Buyer Map</h4>
              <div className="space-y-1.5">
                {timing.buyerMap.map((b, i) => (
                  <div key={i} className="text-xs">
                    <div className="flex items-center gap-1.5">
                      <span className="text-neutral-200 font-medium">{b.name}</span>
                      <span className="text-neutral-500">{b.title}</span>
                      <span className={`text-[11px] capitalize ${roleColors[b.role] ?? 'text-neutral-500'}`}>
                        {b.role.replace('-', ' ')}
                      </span>
                    </div>
                    <p className="text-neutral-400 mt-0.5">{b.signal}</p>
                    {b.url && <a href={b.url} target="_blank" rel="noreferrer" className="text-[11px] text-blue-400 hover:underline">source</a>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Prior engagement */}
          {timing.priorEngagement?.lastContactDate && (
            <div className="bg-neutral-800/40 rounded p-2.5">
              <h4 className="text-[11px] text-neutral-500 uppercase tracking-wider mb-1">Prior C3 Engagement</h4>
              <div className="text-xs text-neutral-400">
                <p>Last contact: <span className="text-neutral-300">{timing.priorEngagement.lastContactDate}</span></p>
                {timing.priorEngagement.stage && <p>Stage: <span className="text-neutral-300">{timing.priorEngagement.stage}</span></p>}
                {timing.priorEngagement.outcome && <p>Outcome: <span className="text-neutral-300">{timing.priorEngagement.outcome}</span></p>}
                {timing.priorEngagement.keyContacts?.length > 0 && (
                  <p>Key contacts: <span className="text-neutral-300">{timing.priorEngagement.keyContacts.join(', ')}</span></p>
                )}
              </div>
            </div>
          )}

          {/* Competitive landscape */}
          <div className="bg-neutral-800/40 rounded p-2.5">
            <h4 className="text-[11px] text-neutral-500 uppercase tracking-wider mb-1">Competitive Landscape</h4>
            {timing.competitiveLandscape.currentTools?.length > 0 && (
              <p className="text-xs text-neutral-400 mb-1">
                Current tools: <span className="text-neutral-300">{timing.competitiveLandscape.currentTools.join(', ')}</span>
              </p>
            )}
            {timing.competitiveLandscape.contractRenewals?.length > 0 && (
              <div className="mb-1">
                {timing.competitiveLandscape.contractRenewals.map((r, i) => (
                  <p key={i} className="text-xs text-amber-400">
                    {r.vendor} renewal: ~{r.estimatedDate}
                  </p>
                ))}
              </div>
            )}
            <p className="text-xs text-neutral-400">{timing.competitiveLandscape.vulnerability}</p>
          </div>

          {/* Job postings */}
          {timing.jobPostings?.length > 0 && (
            <div className="bg-neutral-800/40 rounded p-2.5">
              <h4 className="text-[11px] text-neutral-500 uppercase tracking-wider mb-1.5">Job Postings</h4>
              <div className="space-y-1">
                {timing.jobPostings.map((j, i) => (
                  <div key={i} className="flex items-center justify-between text-xs">
                    <span className="text-neutral-300">{j.title}</span>
                    <a href={j.url} target="_blank" rel="noreferrer" className="text-[11px] text-blue-400 hover:underline">view</a>
                  </div>
                ))}
              </div>
            </div>
          )}

          <p className="text-[11px] text-neutral-600">
            FY end: {timing.fiscalYearEnd} &middot; Budget: {timing.budgetPhase}
            {timing.nextEarningsDate && ` · Next earnings: ${timing.nextEarningsDate}`}
          </p>
        </div>
      )}
    </div>
  );
}
