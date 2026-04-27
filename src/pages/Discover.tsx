import { useState } from 'react';
import CompanyCard from '../components/CompanyCard';
import { discoverCompanies, findSimilar, type ScoredCompany } from '../lib/api';

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
  const [query, setQuery] = useState('');
  const [industry, setIndustry] = useState('All Industries');
  const [companies, setCompanies] = useState<ScoredCompany[]>([]);
  const [searchAnswer, setSearchAnswer] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setError('');
    setCompanies([]);
    setSearchAnswer('');

    try {
      const result = await discoverCompanies(
        query,
        industry !== 'All Industries' ? industry : undefined
      );
      setCompanies(result.companies);
      setSearchAnswer(result.searchAnswer ?? '');
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
    <div className="max-w-4xl">
      <h2 className="text-2xl font-bold text-white mb-1">Find New Targets</h2>
      <p className="text-gray-400 text-sm mb-6">
        Search for companies matching C3 AI's ICP. Powered by web search + AI analysis.
      </p>

      <form onSubmit={handleSearch} className="flex gap-3 mb-6">
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="e.g., large manufacturing companies investing in AI..."
          className="flex-1 px-4 py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
        />
        <select
          value={industry}
          onChange={e => setIndustry(e.target.value)}
          className="px-3 py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-gray-300 focus:outline-none focus:border-blue-500"
        >
          {INDUSTRIES.map(ind => (
            <option key={ind}>{ind}</option>
          ))}
        </select>
        <button
          type="submit"
          disabled={loading || !query.trim()}
          className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 text-white font-medium rounded-lg transition-colors"
        >
          {loading ? 'Searching...' : 'Search'}
        </button>
      </form>

      {error && (
        <div className="bg-red-900/30 border border-red-800 text-red-300 px-4 py-3 rounded-lg mb-6">
          {error}
        </div>
      )}

      {loading && (
        <div className="text-center py-16">
          <div className="inline-block w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-gray-400">Researching companies and scoring against ICP...</p>
          <p className="text-gray-600 text-sm mt-1">This takes 30-60 seconds</p>
        </div>
      )}

      {searchAnswer && !loading && (
        <div className="bg-blue-900/20 border border-blue-800/50 rounded-lg p-4 mb-6">
          <p className="text-sm text-blue-200">{searchAnswer}</p>
        </div>
      )}

      {!loading && companies.length > 0 && (
        <div className="space-y-4">
          <p className="text-sm text-gray-500">{companies.length} companies found, ranked by ICP fit</p>
          {companies.map((company, i) => (
            <CompanyCard
              key={i}
              company={company}
              onFindSimilar={() => handleFindSimilar(company.company_name)}
            />
          ))}
        </div>
      )}

      {!loading && !error && companies.length === 0 && query && (
        <div className="text-center py-16 text-gray-500">
          No results yet. Try a broader search.
        </div>
      )}

      {!query && !loading && companies.length === 0 && (
        <div className="text-center py-16">
          <p className="text-gray-500 mb-4">Try searching for:</p>
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
                  // Auto-trigger search after setting query
                  setTimeout(() => {
                    document.querySelector<HTMLFormElement>('form')?.requestSubmit();
                  }, 0);
                }}
                className="px-3 py-1.5 text-sm bg-gray-900 border border-gray-700 rounded-full text-gray-400 hover:text-white hover:border-gray-600 transition-colors"
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
