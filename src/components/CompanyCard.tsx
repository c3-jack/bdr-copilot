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
  if (score >= 40) return 'text-amber-400';
  return 'text-neutral-500';
}

function companyLinkedInUrl(name: string): string {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+$/, '');
  return `https://www.linkedin.com/company/${slug}`;
}

function salesNavUrl(name: string): string {
  return `https://www.linkedin.com/sales/search/people?query=${encodeURIComponent(name)}`;
}

export default function CompanyCard({ company, onResearch, onOutreach, onFindSimilar }: Props) {
  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded p-4 hover:border-neutral-700 transition-colors">
      <div className="flex items-start justify-between mb-2">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-medium text-neutral-100">{company.company_name}</h3>
            <a
              href={companyLinkedInUrl(company.company_name)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-neutral-500 hover:text-neutral-300 text-[11px]"
            >
              LI
            </a>
            <a
              href={salesNavUrl(company.company_name)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-neutral-500 hover:text-neutral-300 text-[11px]"
            >
              SN
            </a>
          </div>
          <p className="text-xs text-neutral-500 mt-0.5">
            {company.industry} &middot; ${company.revenue_b}B
            {company.headquarters && ` &middot; ${company.headquarters}`}
            {company.employee_count && ` &middot; ${company.employee_count.toLocaleString()} emp`}
          </p>
        </div>
        <span className={`text-lg font-semibold tabular-nums ${scoreColor(company.score)}`}>
          {company.score}
        </span>
      </div>

      <p className="text-sm text-neutral-400 mb-2">{company.why_a_fit}</p>

      <div className="flex flex-wrap gap-1 mb-2">
        {company.signals.map((signal, i) => (
          <SignalBadge key={i} signal={signal} />
        ))}
      </div>

      <div className="bg-neutral-800/50 rounded p-2.5 mb-3 text-xs">
        <div className="flex gap-6">
          <div>
            <span className="text-neutral-500">Use Case</span>
            <p className="text-neutral-200 font-medium">{company.recommendedUseCase}</p>
          </div>
          <div>
            <span className="text-neutral-500">Target Title</span>
            <p className="text-neutral-200 font-medium">{company.recommendedTitle}</p>
          </div>
        </div>
        {company.reasoning && (
          <p className="text-neutral-600 text-[11px] mt-1.5">{company.reasoning}</p>
        )}
      </div>

      <div className="flex gap-2">
        {onResearch && (
          <button
            onClick={onResearch}
            className="px-3 py-1 text-xs bg-neutral-100 hover:bg-white text-neutral-900 font-medium rounded transition-colors"
          >
            Deep Research
          </button>
        )}
        {onOutreach && (
          <button
            onClick={onOutreach}
            className="px-3 py-1 text-xs bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded transition-colors"
          >
            Draft Outreach
          </button>
        )}
        {onFindSimilar && (
          <button
            onClick={onFindSimilar}
            className="px-3 py-1 text-xs text-neutral-500 hover:text-neutral-200 hover:bg-neutral-800 rounded transition-colors"
          >
            Find Similar
          </button>
        )}
      </div>
    </div>
  );
}
