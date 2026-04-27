import { getWinPatterns, getIcpCriteria } from './db.js';

interface ProspectSignals {
  industry?: string;
  revenue_b?: number;
  hasAiInitiatives?: boolean;
  hasCloudMigration?: boolean;
  hasNewCxoHire?: boolean;
  hasEarningsAiMention?: boolean;
  hasAiJobPostings?: boolean;
  hasRegulatoryPressure?: boolean;
  hasPartnerConnection?: boolean;
}

interface ScoringResult {
  score: number; // 0-100
  matchedPatterns: Array<{
    use_case: string;
    champion_title: string;
    entry_point: string;
    similarity: number;
  }>;
  recommendedUseCase: string;
  recommendedTitle: string;
  reasoning: string;
}

/**
 * Score a prospect against historical win patterns and ICP criteria.
 * Returns 0-100 score with reasoning.
 */
export function scoreProspect(signals: ProspectSignals): ScoringResult {
  let score = 0;
  const reasons: string[] = [];

  // --- ICP Match (up to 40 points) ---
  const icpList = getIcpCriteria() as Array<{
    min_revenue_b: number;
    target_industries: string;
    qualifying_signals: string;
  }>;
  const coreIcp = icpList[0];

  if (coreIcp) {
    const targetIndustries = JSON.parse(coreIcp.target_industries) as string[];

    // Revenue fit (0-15 points)
    if (signals.revenue_b) {
      if (signals.revenue_b >= 50) {
        score += 15;
        reasons.push('Enterprise scale ($50B+)');
      } else if (signals.revenue_b >= 10) {
        score += 12;
        reasons.push('Large company ($10B+)');
      } else if (signals.revenue_b >= 5) {
        score += 6;
        reasons.push('Mid-size company ($5-10B) — stretch ICP');
      }
    }

    // Industry fit (0-15 points)
    if (signals.industry && targetIndustries.includes(signals.industry)) {
      score += 15;
      reasons.push(`Core target industry: ${signals.industry}`);
    } else if (signals.industry) {
      score += 5;
      reasons.push(`Non-core industry: ${signals.industry}`);
    }

    // Signal strength (0-10 points, 2 each)
    if (signals.hasAiInitiatives) { score += 2; reasons.push('Active AI initiatives'); }
    if (signals.hasCloudMigration) { score += 2; reasons.push('Cloud migration underway'); }
    if (signals.hasNewCxoHire) { score += 2; reasons.push('Recent CxO hire'); }
    if (signals.hasEarningsAiMention) { score += 2; reasons.push('AI mentioned in earnings'); }
    if (signals.hasAiJobPostings) { score += 2; reasons.push('AI job postings active'); }
  }

  // --- Win Pattern Match (up to 40 points) ---
  const patterns = getWinPatterns() as Array<{
    industry: string;
    company_size_bucket: string;
    use_case: string;
    champion_title: string;
    entry_point: string;
    deal_count: number;
  }>;

  const matchedPatterns = patterns
    .filter(p => !signals.industry || p.industry === signals.industry)
    .map(p => {
      let similarity = 0;
      if (p.industry === signals.industry) similarity += 30;

      const sizeBucket = signals.revenue_b
        ? signals.revenue_b >= 50 ? 'enterprise'
        : signals.revenue_b >= 10 ? 'large'
        : 'mid'
        : 'unknown';

      if (p.company_size_bucket === sizeBucket) similarity += 20;

      // Weight by deal count (more deals = more confidence)
      similarity += Math.min(p.deal_count * 5, 30);

      return {
        use_case: p.use_case,
        champion_title: p.champion_title,
        entry_point: p.entry_point,
        similarity: Math.min(similarity, 100),
      };
    })
    .sort((a, b) => b.similarity - a.similarity);

  if (matchedPatterns.length > 0) {
    const topMatch = matchedPatterns[0];
    score += Math.round(topMatch.similarity * 0.4);
    reasons.push(`Strong match to ${topMatch.use_case} pattern`);
  }

  // --- Intent Signals Bonus (up to 20 points) ---
  if (signals.hasPartnerConnection) { score += 10; reasons.push('Partner connection exists'); }
  if (signals.hasRegulatoryPressure) { score += 10; reasons.push('Regulatory pressure driving urgency'); }

  const topPattern = matchedPatterns[0];

  return {
    score: Math.min(score, 100),
    matchedPatterns: matchedPatterns.slice(0, 3),
    recommendedUseCase: topPattern?.use_case ?? 'Asset Performance Management',
    recommendedTitle: topPattern?.champion_title ?? 'VP Operations',
    reasoning: reasons.join('. ') + '.',
  };
}
