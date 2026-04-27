import { useState, useEffect } from 'react';
import { getPipeline, generateOutreach, type Prospect, type OutreachResult } from '../lib/api';

const TONES = [
  { value: 'executive', label: 'Executive' },
  { value: 'professional', label: 'Professional' },
  { value: 'technical', label: 'Technical' },
];

export default function Outreach() {
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [selectedProspect, setSelectedProspect] = useState<Prospect | null>(null);
  const [tone, setTone] = useState('executive');
  const [sequenceLength, setSequenceLength] = useState(3);
  const [customContext, setCustomContext] = useState('');
  const [result, setResult] = useState<OutreachResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  useEffect(() => {
    getPipeline().then(r => setProspects(r.prospects)).catch(() => {});
  }, []);

  async function handleGenerate() {
    if (!selectedProspect) return;

    setLoading(true);
    setError('');
    setResult(null);

    try {
      const res = await generateOutreach({
        prospectId: selectedProspect.id,
        tone,
        sequenceLength,
        customContext: customContext || undefined,
      });
      setResult(res);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  function copyToClipboard(text: string, idx: number) {
    navigator.clipboard.writeText(text);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  }

  return (
    <div className="max-w-3xl">
      <h2 className="text-lg font-semibold text-neutral-100 mb-0.5">Draft Outreach</h2>
      <p className="text-neutral-500 text-sm mb-5">
        Generate personalized email sequences from research and win patterns.
      </p>

      <div className="grid grid-cols-3 gap-3 mb-4">
        <div>
          <label className="block text-xs text-neutral-500 mb-1">Company</label>
          <select
            value={selectedProspect?.id ?? ''}
            onChange={e => {
              const p = prospects.find(p => p.id === Number(e.target.value));
              setSelectedProspect(p ?? null);
            }}
            className="w-full px-3 py-2 bg-neutral-900 border border-neutral-800 rounded text-sm text-neutral-300 focus:outline-none focus:border-neutral-600"
          >
            <option value="">Select a prospect...</option>
            {prospects.map(p => (
              <option key={p.id} value={p.id}>
                {p.company_name} ({p.industry})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs text-neutral-500 mb-1">Tone</label>
          <select
            value={tone}
            onChange={e => setTone(e.target.value)}
            className="w-full px-3 py-2 bg-neutral-900 border border-neutral-800 rounded text-sm text-neutral-300 focus:outline-none focus:border-neutral-600"
          >
            {TONES.map(t => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs text-neutral-500 mb-1">Emails</label>
          <select
            value={sequenceLength}
            onChange={e => setSequenceLength(Number(e.target.value))}
            className="w-full px-3 py-2 bg-neutral-900 border border-neutral-800 rounded text-sm text-neutral-300 focus:outline-none focus:border-neutral-600"
          >
            {[1, 2, 3, 4, 5].map(n => (
              <option key={n} value={n}>{n} email{n > 1 ? 's' : ''}</option>
            ))}
          </select>
        </div>
      </div>

      {selectedProspect && (
        <div className="bg-neutral-900 border border-neutral-800 rounded p-3 mb-3 text-sm">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-neutral-200 font-medium">{selectedProspect.company_name}</span>
              <span className="text-neutral-500 ml-2 text-xs">
                {selectedProspect.industry} &middot; ${selectedProspect.revenue_b}B
              </span>
            </div>
            <div className="text-xs text-neutral-500">
              Target: <span className="text-neutral-300">{selectedProspect.recommended_title ?? selectedProspect.recommendedTitle}</span>
              {' '}&middot;{' '}
              <span className="text-neutral-300">{selectedProspect.recommended_use_case ?? selectedProspect.recommendedUseCase}</span>
            </div>
          </div>
        </div>
      )}

      <div className="mb-4">
        <label className="block text-xs text-neutral-500 mb-1">Additional context (optional)</label>
        <textarea
          value={customContext}
          onChange={e => setCustomContext(e.target.value)}
          placeholder="e.g., Met their VP at AWS re:Invent..."
          className="w-full px-3 py-2 bg-neutral-900 border border-neutral-800 rounded text-sm text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-neutral-600 h-16 resize-none"
        />
      </div>

      <button
        onClick={handleGenerate}
        disabled={loading || !selectedProspect}
        className="px-4 py-2 bg-neutral-100 hover:bg-white disabled:bg-neutral-800 disabled:text-neutral-600 text-neutral-900 text-sm font-medium rounded transition-colors mb-6"
      >
        {loading ? 'Generating...' : 'Generate Sequence'}
      </button>

      {error && (
        <div className="bg-red-950/50 border border-red-900/50 text-red-400 px-3 py-2 rounded text-sm mb-4">
          {error}
        </div>
      )}

      {loading && (
        <div className="text-center py-12">
          <div className="inline-block w-5 h-5 border-2 border-neutral-500 border-t-transparent rounded-full animate-spin mb-3" />
          <p className="text-neutral-500 text-sm">Writing personalized emails...</p>
        </div>
      )}

      {result && !loading && (
        <div className="space-y-3">
          <p className="text-xs text-neutral-500">
            {result.emails.length}-email sequence for {result.context.companyName}
            {result.context.caseStudy && ` (ref: ${result.context.caseStudy})`}
          </p>

          {result.emails.map((email, i) => (
            <div key={i} className="bg-neutral-900 border border-neutral-800 rounded overflow-hidden">
              <div className="flex items-center justify-between px-3 py-2 border-b border-neutral-800">
                <div className="flex items-center gap-2 text-xs text-neutral-500">
                  <span className="bg-neutral-800 text-neutral-400 px-1.5 py-0.5 rounded text-[11px]">
                    {email.sequencePosition}
                  </span>
                  <span>{email.tone} &middot; {email.personaType}</span>
                </div>
                <button
                  onClick={() => copyToClipboard(`Subject: ${email.subject}\n\n${email.body}`, i)}
                  className="text-xs text-neutral-500 hover:text-neutral-200 transition-colors"
                >
                  {copiedIdx === i ? 'Copied' : 'Copy'}
                </button>
              </div>
              <div className="p-3">
                <p className="text-sm font-medium text-neutral-300 mb-1.5">Subject: {email.subject}</p>
                <pre className="text-sm text-neutral-400 whitespace-pre-wrap font-sans leading-relaxed">{email.body}</pre>
              </div>
            </div>
          ))}
        </div>
      )}

      {!selectedProspect && !loading && (
        <div className="text-center py-16 text-neutral-500 text-sm">
          {prospects.length === 0
            ? 'No prospects yet. Use Find Targets to discover companies first.'
            : 'Select a prospect above to generate outreach.'}
        </div>
      )}
    </div>
  );
}
