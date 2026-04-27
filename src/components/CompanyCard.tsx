import SignalBadge from './SignalBadge';
import type { ScoredCompany } from '../lib/api';

interface Props {
  company: ScoredCompany;
  onResearch?: () => void;
  onOutreach?: () => void;
  onFindSimilar?: () => void;
}

function scoreColor(score: number): string {
  if (score >= 70) return 'text-green-400';
  if (score >= 40) return 'text-yellow-400';
  return 'text-gray-400';
}

export default function CompanyCard({ company, onResearch, onOutreach, onFindSimilar }: Props) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-5 hover:border-gray-700 transition-colors">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="text-lg font-semibold text-white">{company.company_name}</h3>
          <p className="text-sm text-gray-400">
            {company.industry} &middot; ${company.revenue_b}B revenue
            {company.headquarters && ` &middot; ${company.headquarters}`}
          </p>
        </div>
        <div className={`text-2xl font-bold ${scoreColor(company.score)}`}>
          {company.score}
        </div>
      </div>

      <p className="text-sm text-gray-300 mb-3">{company.why_a_fit}</p>

      <div className="flex flex-wrap gap-1.5 mb-3">
        {company.signals.map((signal, i) => (
          <SignalBadge key={i} signal={signal} />
        ))}
      </div>

      <div className="bg-gray-800/50 rounded p-3 mb-4 text-sm">
        <div className="flex gap-6">
          <div>
            <span className="text-gray-500">Recommended Use Case</span>
            <p className="text-blue-400 font-medium">{company.recommendedUseCase}</p>
          </div>
          <div>
            <span className="text-gray-500">Target Title</span>
            <p className="text-blue-400 font-medium">{company.recommendedTitle}</p>
          </div>
        </div>
        {company.reasoning && (
          <p className="text-gray-500 text-xs mt-2">{company.reasoning}</p>
        )}
      </div>

      <div className="flex gap-2">
        {onResearch && (
          <button
            onClick={onResearch}
            className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-500 text-white rounded transition-colors"
          >
            Deep Research
          </button>
        )}
        {onOutreach && (
          <button
            onClick={onOutreach}
            className="px-3 py-1.5 text-sm bg-gray-700 hover:bg-gray-600 text-white rounded transition-colors"
          >
            Draft Outreach
          </button>
        )}
        {onFindSimilar && (
          <button
            onClick={onFindSimilar}
            className="px-3 py-1.5 text-sm text-gray-400 hover:text-white hover:bg-gray-800 rounded transition-colors"
          >
            Find Similar
          </button>
        )}
      </div>
    </div>
  );
}
