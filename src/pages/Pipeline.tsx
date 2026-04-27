import { useState, useEffect } from 'react';
import { getPipeline, updateProspectStatus, getContacts, enrichProspect, type Prospect, type ZiContactWithLinks, type ZiCompany, type ZiIntent, type LinkedInLinks } from '../lib/api';
import SignalBadge from '../components/SignalBadge';

const STATUS_FILTERS = ['all', 'new', 'researched', 'contacted', 'qualified', 'disqualified'];

const statusColors: Record<string, string> = {
  new: 'bg-blue-500/20 text-blue-300',
  researched: 'bg-purple-500/20 text-purple-300',
  contacted: 'bg-yellow-500/20 text-yellow-300',
  qualified: 'bg-green-500/20 text-green-300',
  disqualified: 'bg-red-500/20 text-red-300',
};

function scoreColor(score: number): string {
  if (score >= 70) return 'text-green-400';
  if (score >= 40) return 'text-yellow-400';
  return 'text-gray-500';
}

interface EnrichmentData {
  company: ZiCompany | null;
  intent: ZiIntent[];
  linkedIn: LinkedInLinks;
  contacts: ZiContactWithLinks[];
  configured: boolean;
}

export default function Pipeline() {
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<'score' | 'date' | 'company'>('score');
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [enrichment, setEnrichment] = useState<EnrichmentData | null>(null);
  const [enrichLoading, setEnrichLoading] = useState(false);

  useEffect(() => {
    loadProspects();
  }, [filter]);

  async function loadProspects() {
    setLoading(true);
    try {
      const status = filter === 'all' ? undefined : filter;
      const result = await getPipeline(status);
      setProspects(result.prospects);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }

  async function handleStatusChange(id: number, newStatus: string) {
    try {
      await updateProspectStatus(id, newStatus);
      await loadProspects();
    } catch {
      // silently fail
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

  const sorted = [...prospects].sort((a, b) => {
    if (sortBy === 'score') return (b.score ?? 0) - (a.score ?? 0);
    if (sortBy === 'date') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    return a.company_name.localeCompare(b.company_name);
  });

  return (
    <div className="max-w-5xl">
      <h2 className="text-2xl font-bold text-white mb-1">My Pipeline</h2>
      <p className="text-gray-400 text-sm mb-6">
        Track and manage your discovered prospects.
      </p>

      <div className="flex items-center justify-between mb-6">
        <div className="flex gap-2">
          {STATUS_FILTERS.map(s => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`px-3 py-1.5 text-sm rounded-lg transition-colors capitalize ${
                filter === s
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-900 text-gray-400 hover:text-white border border-gray-800'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">Sort:</span>
          {(['score', 'date', 'company'] as const).map(s => (
            <button
              key={s}
              onClick={() => setSortBy(s)}
              className={`px-2 py-1 text-xs rounded transition-colors capitalize ${
                sortBy === s ? 'text-blue-400' : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="text-center py-16">
          <div className="inline-block w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : sorted.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          {filter === 'all'
            ? 'No prospects yet. Use Find Targets to discover companies.'
            : `No prospects with status "${filter}".`}
        </div>
      ) : (
        <div className="space-y-3">
          {sorted.map(prospect => (
            <div
              key={prospect.id}
              className={`bg-gray-900 border rounded-lg transition-colors ${
                prospect.isStale ? 'border-amber-800/50' : 'border-gray-800'
              }`}
            >
              <div className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className="text-white font-medium">{prospect.company_name}</h3>
                      <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${statusColors[prospect.status] ?? statusColors.new}`}>
                        {prospect.status}
                      </span>
                      {prospect.isStale && (
                        <span className="text-xs text-amber-400">
                          Stale ({prospect.daysSinceUpdate}d)
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-400 mb-2">
                      {prospect.industry} &middot; ${prospect.revenue_b}B
                      {prospect.recommended_use_case && (
                        <> &middot; <span className="text-blue-400">{prospect.recommended_use_case}</span></>
                      )}
                      {prospect.recommended_title && (
                        <> &middot; Target: <span className="text-blue-400">{prospect.recommended_title}</span></>
                      )}
                    </p>
                    <div className="flex items-center gap-2">
                      {prospect.signals && prospect.signals.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {prospect.signals.slice(0, 4).map((s, i) => (
                            <SignalBadge key={i} signal={s} />
                          ))}
                          {prospect.signals.length > 4 && (
                            <span className="text-xs text-gray-500">+{prospect.signals.length - 4} more</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <button
                      onClick={() => handleExpand(prospect)}
                      className={`text-xs px-2 py-1 rounded transition-colors ${
                        expandedId === prospect.id
                          ? 'bg-blue-600 text-white'
                          : 'text-gray-400 hover:text-white hover:bg-gray-800'
                      }`}
                    >
                      {expandedId === prospect.id ? 'Close' : 'Enrich'}
                    </button>
                    <span className={`text-xl font-bold ${scoreColor(prospect.score ?? 0)}`}>
                      {prospect.score ?? '--'}
                    </span>
                    <select
                      value={prospect.status}
                      onChange={e => handleStatusChange(prospect.id, e.target.value)}
                      className="text-xs bg-gray-800 border border-gray-700 rounded px-2 py-1 text-gray-300"
                    >
                      {STATUS_FILTERS.filter(s => s !== 'all').map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {expandedId === prospect.id && (
                <div className="border-t border-gray-800 p-4">
                  {enrichLoading ? (
                    <div className="flex items-center gap-2 text-gray-400 text-sm py-4">
                      <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                      Fetching ZoomInfo data and LinkedIn links...
                    </div>
                  ) : enrichment ? (
                    <div className="space-y-4">
                      {/* LinkedIn Quick Links */}
                      <div className="flex gap-3 text-sm">
                        <a href={enrichment.linkedIn.companyPage} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300">
                          LinkedIn Company Page
                        </a>
                        <a href={enrichment.linkedIn.salesNavSearch} target="_blank" rel="noopener noreferrer" className="text-green-400 hover:text-green-300">
                          Sales Navigator
                        </a>
                      </div>

                      {/* ZoomInfo Company */}
                      {enrichment.company && (
                        <div className="bg-gray-800/50 rounded p-3">
                          <h4 className="text-xs text-gray-500 uppercase tracking-wider mb-2">ZoomInfo Company Data</h4>
                          <div className="grid grid-cols-3 gap-3 text-sm">
                            <div>
                              <span className="text-gray-500">Revenue</span>
                              <p className="text-white">{enrichment.company.revenueRange || `$${(enrichment.company.revenue / 1e6).toFixed(0)}M`}</p>
                            </div>
                            <div>
                              <span className="text-gray-500">Employees</span>
                              <p className="text-white">{enrichment.company.employeeCount?.toLocaleString()}</p>
                            </div>
                            <div>
                              <span className="text-gray-500">HQ</span>
                              <p className="text-white">{enrichment.company.city}, {enrichment.company.state}</p>
                            </div>
                            <div>
                              <span className="text-gray-500">Sub-Industry</span>
                              <p className="text-white">{enrichment.company.subIndustry}</p>
                            </div>
                            <div>
                              <span className="text-gray-500">Website</span>
                              <p className="text-white">{enrichment.company.website}</p>
                            </div>
                            {enrichment.company.ticker && (
                              <div>
                                <span className="text-gray-500">Ticker</span>
                                <p className="text-white">{enrichment.company.ticker}</p>
                              </div>
                            )}
                          </div>
                          {enrichment.company.description && (
                            <p className="text-xs text-gray-400 mt-2">{enrichment.company.description.slice(0, 200)}...</p>
                          )}
                        </div>
                      )}

                      {/* Intent Signals */}
                      {enrichment.intent.length > 0 && (
                        <div className="bg-gray-800/50 rounded p-3">
                          <h4 className="text-xs text-gray-500 uppercase tracking-wider mb-2">Intent Signals</h4>
                          <div className="flex flex-wrap gap-2">
                            {enrichment.intent.map((intent, i) => (
                              <span key={i} className="text-xs px-2 py-1 rounded bg-purple-900/30 text-purple-300">
                                {intent.topicName} ({intent.signalScore})
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Contacts */}
                      {enrichment.contacts.length > 0 && (
                        <div className="bg-gray-800/50 rounded p-3">
                          <h4 className="text-xs text-gray-500 uppercase tracking-wider mb-2">
                            Key Contacts ({enrichment.contacts.length})
                          </h4>
                          <div className="space-y-2">
                            {enrichment.contacts.slice(0, 8).map((c, i) => (
                              <div key={i} className="flex items-center justify-between text-sm">
                                <div>
                                  <span className="text-white">{c.fullName}</span>
                                  <span className="text-gray-500 ml-2">{c.jobTitle}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  {c.email && <span className="text-xs text-gray-400">{c.email}</span>}
                                  <a
                                    href={c.linkedIn.profileSearch}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs text-blue-400 hover:text-blue-300"
                                  >
                                    LI
                                  </a>
                                  <a
                                    href={c.linkedIn.salesNavSearch}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs text-green-400 hover:text-green-300"
                                  >
                                    SN
                                  </a>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {!enrichment.configured && (
                        <p className="text-xs text-gray-500">
                          ZoomInfo not configured. Add ZOOMINFO_CLIENT_ID and ZOOMINFO_PRIVATE_KEY to .env for contact enrichment.
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
        <p className="text-xs text-gray-600 mt-4">
          {sorted.length} prospect{sorted.length !== 1 ? 's' : ''} &middot;
          {sorted.filter(p => p.isStale).length} stale &middot;
          Avg score: {Math.round(sorted.reduce((sum, p) => sum + (p.score ?? 0), 0) / sorted.length)}
        </p>
      )}
    </div>
  );
}
