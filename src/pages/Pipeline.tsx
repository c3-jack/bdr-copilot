import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getPipeline, updateProspectStatus, getContacts, enrichProspect, syncDynamics, type Prospect, type ZiContactWithLinks, type ZiCompany, type ZiIntent, type LinkedInLinks } from '../lib/api';
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
