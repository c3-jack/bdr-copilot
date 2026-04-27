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
    <div className="max-w-4xl">
      <h2 className="text-2xl font-bold text-white mb-1">Draft Outreach</h2>
      <p className="text-gray-400 text-sm mb-6">
        Generate personalized email sequences based on company research and win patterns.
      </p>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div>
          <label className="block text-sm text-gray-400 mb-1">Company</label>
          <select
            value={selectedProspect?.id ?? ''}
            onChange={e => {
              const p = prospects.find(p => p.id === Number(e.target.value));
              setSelectedProspect(p ?? null);
            }}
            className="w-full px-3 py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-gray-300 focus:outline-none focus:border-blue-500"
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
          <label className="block text-sm text-gray-400 mb-1">Tone</label>
          <select
            value={tone}
            onChange={e => setTone(e.target.value)}
            className="w-full px-3 py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-gray-300 focus:outline-none focus:border-blue-500"
          >
            {TONES.map(t => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm text-gray-400 mb-1">Emails in Sequence</label>
          <select
            value={sequenceLength}
            onChange={e => setSequenceLength(Number(e.target.value))}
            className="w-full px-3 py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-gray-300 focus:outline-none focus:border-blue-500"
          >
            {[1, 2, 3, 4, 5].map(n => (
              <option key={n} value={n}>{n} email{n > 1 ? 's' : ''}</option>
            ))}
          </select>
        </div>
      </div>

      {selectedProspect && (
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 mb-4">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-white font-medium">{selectedProspect.company_name}</span>
              <span className="text-gray-500 ml-2">
                {selectedProspect.industry} &middot; ${selectedProspect.revenue_b}B
              </span>
            </div>
            <div className="text-sm text-gray-400">
              Target: <span className="text-blue-400">{selectedProspect.recommended_title ?? selectedProspect.recommendedTitle}</span>
              &middot; Use Case: <span className="text-blue-400">{selectedProspect.recommended_use_case ?? selectedProspect.recommendedUseCase}</span>
            </div>
          </div>
        </div>
      )}

      <div className="mb-4">
        <label className="block text-sm text-gray-400 mb-1">Additional Context (optional)</label>
        <textarea
          value={customContext}
          onChange={e => setCustomContext(e.target.value)}
          placeholder="e.g., Met their VP at AWS re:Invent. They mentioned evaluating predictive maintenance vendors..."
          className="w-full px-4 py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 h-20 resize-none"
        />
      </div>

      <button
        onClick={handleGenerate}
        disabled={loading || !selectedProspect}
        className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 text-white font-medium rounded-lg transition-colors mb-6"
      >
        {loading ? 'Generating...' : 'Generate Sequence'}
      </button>

      {error && (
        <div className="bg-red-900/30 border border-red-800 text-red-300 px-4 py-3 rounded-lg mb-6">
          {error}
        </div>
      )}

      {loading && (
        <div className="text-center py-12">
          <div className="inline-block w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-gray-400">Claude is writing personalized emails...</p>
        </div>
      )}

      {result && !loading && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">
              {result.emails.length}-email sequence for {result.context.companyName}
              {result.context.caseStudy && ` (referencing ${result.context.caseStudy})`}
            </p>
          </div>

          {result.emails.map((email, i) => (
            <div key={i} className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2 bg-gray-800/50 border-b border-gray-800">
                <div className="flex items-center gap-3">
                  <span className="text-xs bg-gray-700 text-gray-300 px-2 py-0.5 rounded">
                    Email {email.sequencePosition}
                  </span>
                  <span className="text-xs text-gray-500">{email.tone} &middot; {email.personaType}</span>
                </div>
                <button
                  onClick={() => copyToClipboard(`Subject: ${email.subject}\n\n${email.body}`, i)}
                  className="text-xs text-gray-400 hover:text-white transition-colors"
                >
                  {copiedIdx === i ? 'Copied' : 'Copy'}
                </button>
              </div>
              <div className="p-4">
                <p className="text-sm font-medium text-gray-300 mb-2">Subject: {email.subject}</p>
                <pre className="text-sm text-gray-400 whitespace-pre-wrap font-sans">{email.body}</pre>
              </div>
            </div>
          ))}
        </div>
      )}

      {!selectedProspect && !loading && (
        <div className="text-center py-16 text-gray-500">
          {prospects.length === 0
            ? 'No prospects yet. Use Find Targets to discover companies first.'
            : 'Select a prospect above to generate outreach.'}
        </div>
      )}
    </div>
  );
}
