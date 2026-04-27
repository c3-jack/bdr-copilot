import { useState, useEffect } from 'react';
import { getPipeline, updateProspectStatus, type Prospect } from '../lib/api';
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

export default function Pipeline() {
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<'score' | 'date' | 'company'>('score');

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
              className={`bg-gray-900 border rounded-lg p-4 transition-colors ${
                prospect.isStale ? 'border-amber-800/50' : 'border-gray-800'
              }`}
            >
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
                <div className="flex items-center gap-4">
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
