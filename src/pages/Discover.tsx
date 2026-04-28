import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import CompanyCard from '../components/CompanyCard';
import { discoverCompanies, findSimilar, deepResearch, type ScoredCompany } from '../lib/api';

const INDUSTRIES = [
  'All Industries',
  'Manufacturing',
  'Energy',
  'Financial Services',
  'Defense',
  'Aerospace',
  'Retail',
  'Pharma',
  'Chemicals',
  'Telecom',
  'Transportation',
];

export default function Discover() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [industry, setIndustry] = useState('All Industries');
  const [companies, setCompanies] = useState<ScoredCompany[]>([]);
  const [searchAnswer, setSearchAnswer] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [excludedMsg, setExcludedMsg] = useState('');
  const [researchingIdx, setResearchingIdx] = useState<number | null>(null);
  const [addedSet, setAddedSet] = useState<Set<number>>(new Set());

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setError('');
    setCompanies([]);
    setSearchAnswer('');
    setExcludedMsg('');

    try {
      const result = await discoverCompanies(
        query,
        industry !== 'All Industries' ? industry : undefined
      );
      setCompanies(result.companies);
      setSearchAnswer(result.searchAnswer ?? '');
      setExcludedMsg(result.excludedReason ?? '');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function handleFindSimilar(companyName: string) {
    setLoading(true);
    setError('');
    setSearchAnswer('');

    try {
      const result = await findSimilar(companyName);
      setCompanies(result.companies);
      setQuery(`Similar to ${companyName}`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-3xl">
      <h2 className="text-lg font-semibold text-neutral-100 mb-0.5">Find New Targets</h2>
      <p className="text-neutral-500 text-sm mb-5">
        Search for companies matching C3 AI's ICP.
      </p>

      <form onSubmit={handleSearch} className="flex gap-2 mb-6">
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="e.g., large manufacturing companies investing in AI..."
          className="flex-1 px-3 py-2 bg-neutral-900 border border-neutral-800 rounded text-sm text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-neutral-600"
        />
        <select
          value={industry}
          onChange={e => setIndustry(e.target.value)}
          className="px-3 py-2 bg-neutral-900 border border-neutral-800 rounded text-sm text-neutral-300 focus:outline-none focus:border-neutral-600"
        >
          {INDUSTRIES.map(ind => (
            <option key={ind}>{ind}</option>
          ))}
        </select>
        <button
          type="submit"
          disabled={loading || !query.trim()}
          className="px-4 py-2 bg-neutral-100 hover:bg-white disabled:bg-neutral-800 disabled:text-neutral-600 text-neutral-900 text-sm font-medium rounded transition-colors"
        >
          {loading ? 'Searching...' : 'Search'}
        </button>
      </form>

      {error && (
        <div className="bg-red-950/50 border border-red-900/50 text-red-400 px-3 py-2 rounded text-sm mb-4">
          {error}
        </div>
      )}

      {loading && (
        <div className="text-center py-16">
          <div className="inline-block w-5 h-5 border-2 border-neutral-500 border-t-transparent rounded-full animate-spin mb-3" />
          <p className="text-neutral-500 text-sm">Researching companies...</p>
          <p className="text-neutral-600 text-xs mt-1">30-60 seconds</p>
        </div>
      )}

      {searchAnswer && !loading && (
        <div className="bg-neutral-900 border border-neutral-800 rounded p-3 mb-4">
          <p className="text-sm text-neutral-300">{searchAnswer}</p>
        </div>
      )}

      {!loading && companies.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs text-neutral-500">{companies.length} companies, ranked by ICP fit</p>
            {excludedMsg && (
              <p className="text-xs text-amber-500">{excludedMsg}</p>
            )}
          </div>
          {companies.map((company, i) => (
            <CompanyCard
              key={i}
              company={company}
              onResearch={researchingIdx === i ? undefined : () => {
                setResearchingIdx(i);
                // The company is already saved to prospects by the discover endpoint.
                // Find its prospect ID from the pipeline and trigger deep research.
                // For now, navigate to pipeline where they can research it.
                // TODO: direct research from discover
                fetch(`${import.meta.env.DEV ? 'http://localhost:3001' : ''}/api/pipeline`)
                  .then(r => r.json())
                  .then((data: { prospects: Array<{ id: number; company_name: string }> }) => {
                    const match = data.prospects.find(
                      p => p.company_name.toLowerCase() === company.company_name.toLowerCase()
                    );
                    if (match) {
                      deepResearch(match.id).then(() => {
                        setResearchingIdx(null);
                        navigate(`/pipeline`);
                      }).catch(() => setResearchingIdx(null));
                    } else {
                      setResearchingIdx(null);
                      navigate('/pipeline');
                    }
                  })
                  .catch(() => setResearchingIdx(null));
              }}
              onOutreach={() => {
                // Navigate to outreach — the prospect is already saved by discover endpoint
                navigate('/outreach');
              }}
              onFindSimilar={() => handleFindSimilar(company.company_name)}
              addedToPipeline={addedSet.has(i)}
              onAddToPipeline={() => {
                // Companies are auto-saved by the discover endpoint — this just confirms it visually
                setAddedSet(prev => new Set(prev).add(i));
              }}
            />
          ))}
        </div>
      )}

      {!loading && !error && companies.length === 0 && query && (
        <div className="text-center py-16 text-neutral-500 text-sm">
          No results. Try a broader search.
        </div>
      )}

      {!query && !loading && companies.length === 0 && (
        <div className="text-center py-16">
          <p className="text-neutral-500 text-sm mb-3">Try searching for:</p>
          <div className="flex flex-wrap gap-2 justify-center">
            {[
              'Fortune 500 manufacturing companies investing in AI',
              'energy companies with digital transformation initiatives',
              'large financial services firms hiring for AI roles',
              'defense contractors with predictive maintenance needs',
            ].map(suggestion => (
              <button
                key={suggestion}
                onClick={() => {
                  setQuery(suggestion);
                  setTimeout(() => {
                    document.querySelector<HTMLFormElement>('form')?.requestSubmit();
                  }, 0);
                }}
                className="px-3 py-1.5 text-xs bg-neutral-900 border border-neutral-800 rounded text-neutral-400 hover:text-neutral-200 hover:border-neutral-700 transition-colors"
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
