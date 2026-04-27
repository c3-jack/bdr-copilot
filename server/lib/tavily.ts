interface TavilyResult {
  title: string;
  url: string;
  content: string;
  score: number;
}

interface TavilyResponse {
  results: TavilyResult[];
  answer?: string;
}

/**
 * Search the web using Tavily API.
 * Falls back to a no-op if TAVILY_API_KEY is not set.
 */
export async function webSearch(query: string, options?: {
  maxResults?: number;
  searchDepth?: 'basic' | 'advanced';
  includeAnswer?: boolean;
}): Promise<TavilyResponse> {
  const apiKey = process.env.TAVILY_API_KEY;

  if (!apiKey || apiKey.startsWith('tvly-xxxxx')) {
    return { results: [], answer: 'Web search not configured. Set TAVILY_API_KEY in .env' };
  }

  const response = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: apiKey,
      query,
      max_results: options?.maxResults ?? 5,
      search_depth: options?.searchDepth ?? 'basic',
      include_answer: options?.includeAnswer ?? true,
    }),
  });

  if (!response.ok) {
    throw new Error(`Tavily API error: ${response.status} ${response.statusText}`);
  }

  return response.json() as Promise<TavilyResponse>;
}

/**
 * Research a company — searches for recent news, AI initiatives, and strategic priorities.
 */
export async function researchCompany(companyName: string): Promise<{
  news: TavilyResult[];
  aiSignals: TavilyResult[];
  financials: TavilyResult[];
}> {
  const [news, aiSignals, financials] = await Promise.all([
    webSearch(`${companyName} recent news 2025 2026`, { maxResults: 3 }),
    webSearch(`${companyName} AI artificial intelligence machine learning digital transformation`, { maxResults: 3 }),
    webSearch(`${companyName} revenue earnings annual report`, { maxResults: 3 }),
  ]);

  return {
    news: news.results,
    aiSignals: aiSignals.results,
    financials: financials.results,
  };
}
