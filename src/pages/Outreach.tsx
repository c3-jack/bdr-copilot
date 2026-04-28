import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getPipeline, generateOutreach, getDrafts as fetchDrafts, type Prospect, type OutreachResult, type Draft } from '../lib/api';

const TONES = [
  { value: 'executive', label: 'Executive' },
  { value: 'professional', label: 'Professional' },
  { value: 'technical', label: 'Technical' },
];

interface EditableEmail {
  subject: string;
  body: string;
  sequencePosition: number;
  tone: string;
  personaType: string;
  templateBasis: string;
}

export default function Outreach() {
  const [searchParams] = useSearchParams();
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [selectedProspect, setSelectedProspect] = useState<Prospect | null>(null);
  const [tone, setTone] = useState('executive');
  const [sequenceLength, setSequenceLength] = useState(3);
  const [customContext, setCustomContext] = useState('');
  const [targetTitle, setTargetTitle] = useState('');
  const [senderName, setSenderName] = useState('');
  const [result, setResult] = useState<OutreachResult | null>(null);
  const [editedEmails, setEditedEmails] = useState<EditableEmail[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const [savedDrafts, setSavedDrafts] = useState<Draft[]>([]);
  const [showSaved, setShowSaved] = useState(false);

  useEffect(() => {
    getPipeline().then(r => {
      setProspects(r.prospects);
      // Auto-select prospect from query param (e.g., from Pipeline "Outreach" button)
      const qId = searchParams.get('prospectId');
      if (qId && !selectedProspect) {
        const match = r.prospects.find(p => p.id === Number(qId));
        if (match) {
          setSelectedProspect(match);
          setTargetTitle(match.recommended_title ?? match.recommendedTitle ?? '');
        }
      }
    }).catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (selectedProspect) {
      fetchDrafts(selectedProspect.id).then(r => setSavedDrafts(r.drafts)).catch(() => setSavedDrafts([]));
    } else {
      setSavedDrafts([]);
    }
  }, [selectedProspect]);

  async function handleGenerate() {
    if (!selectedProspect) return;

    setLoading(true);
    setError('');
    setResult(null);
    setEditedEmails([]);

    try {
      const res = await generateOutreach({
        prospectId: selectedProspect.id,
        targetTitle: targetTitle || undefined,
        tone,
        sequenceLength,
        customContext: customContext || undefined,
      });
      setResult(res);
      // Replace {{sender_name}} placeholder and make editable copies
      const name = senderName || '{{sender_name}}';
      setEditedEmails(res.emails.map(e => ({
        ...e,
        body: e.body.replace(/\{\{sender_name\}\}/g, name),
        subject: e.subject.replace(/\{\{sender_name\}\}/g, name),
      })));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  function updateEmail(idx: number, field: 'subject' | 'body', value: string) {
    setEditedEmails(prev => prev.map((e, i) => i === idx ? { ...e, [field]: value } : e));
  }

  function copyToClipboard(idx: number) {
    const email = editedEmails[idx];
    navigator.clipboard.writeText(email.body);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  }

  return (
    <div className="max-w-3xl">
      <h2 className="text-lg font-semibold text-neutral-100 mb-0.5">Draft Outreach</h2>
      <p className="text-neutral-500 text-sm mb-5">
        Generate personalized email sequences from research and win patterns.
      </p>

      <div className="grid grid-cols-2 gap-3 mb-3">
        <div>
          <label className="block text-xs text-neutral-500 mb-1">Company</label>
          <select
            value={selectedProspect?.id ?? ''}
            onChange={e => {
              const p = prospects.find(p => p.id === Number(e.target.value));
              setSelectedProspect(p ?? null);
              if (p) setTargetTitle(p.recommended_title ?? p.recommendedTitle ?? '');
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
          <label className="block text-xs text-neutral-500 mb-1">Target Title</label>
          <input
            type="text"
            value={targetTitle}
            onChange={e => setTargetTitle(e.target.value)}
            placeholder="e.g., VP Supply Chain"
            className="w-full px-3 py-2 bg-neutral-900 border border-neutral-800 rounded text-sm text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-neutral-600"
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-4">
        <div>
          <label className="block text-xs text-neutral-500 mb-1">Your Name</label>
          <input
            type="text"
            value={senderName}
            onChange={e => setSenderName(e.target.value)}
            placeholder="e.g., Jack Homer"
            className="w-full px-3 py-2 bg-neutral-900 border border-neutral-800 rounded text-sm text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-neutral-600"
          />
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
                {selectedProspect.industry}{selectedProspect.revenue_b != null && ` · $${selectedProspect.revenue_b}B`}
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

      {result && !loading && editedEmails.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs text-neutral-500">
            {editedEmails.length}-email sequence for {result.context.companyName}
            {result.context.caseStudy && ` (ref: ${result.context.caseStudy})`}
          </p>

          {editedEmails.map((email, i) => (
            <div key={i} className="bg-neutral-900 border border-neutral-800 rounded overflow-hidden">
              <div className="flex items-center justify-between px-3 py-2 border-b border-neutral-800">
                <div className="flex items-center gap-2 text-xs text-neutral-500">
                  <span className="bg-neutral-800 text-neutral-400 px-1.5 py-0.5 rounded text-[11px]">
                    {email.sequencePosition}
                  </span>
                  <span>{email.tone} &middot; {email.personaType}</span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(email.subject);
                      setCopiedIdx(i * 100);
                      setTimeout(() => setCopiedIdx(null), 2000);
                    }}
                    className="text-xs text-neutral-500 hover:text-neutral-200 transition-colors"
                  >
                    {copiedIdx === i * 100 ? 'Copied' : 'Copy Subject'}
                  </button>
                  <button
                    onClick={() => copyToClipboard(i)}
                    className="text-xs text-neutral-500 hover:text-neutral-200 transition-colors"
                  >
                    {copiedIdx === i ? 'Copied' : 'Copy Body'}
                  </button>
                </div>
              </div>
              <div className="p-3">
                <input
                  type="text"
                  value={email.subject}
                  onChange={e => updateEmail(i, 'subject', e.target.value)}
                  className="w-full text-sm font-medium text-neutral-200 bg-transparent border-b border-neutral-800 pb-1.5 mb-2 focus:outline-none focus:border-neutral-600"
                />
                <textarea
                  value={email.body}
                  onChange={e => updateEmail(i, 'body', e.target.value)}
                  rows={8}
                  className="w-full text-sm text-neutral-300 bg-transparent font-sans leading-relaxed resize-none focus:outline-none"
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {!selectedProspect && !loading && prospects.length === 0 && (
        <div className="text-center py-16">
          <p className="text-neutral-400 text-sm mb-3">No prospects in your pipeline yet.</p>
          <a
            href="/discover"
            className="inline-block px-4 py-2 bg-neutral-100 hover:bg-white text-neutral-900 text-sm font-medium rounded transition-colors"
          >
            Find Targets First
          </a>
          <p className="text-neutral-600 text-xs mt-3">
            Discover companies, then come back here to draft personalized emails.
          </p>
        </div>
      )}
      {savedDrafts.length > 0 && !loading && (
        <div className="mt-6">
          <button
            onClick={() => setShowSaved(!showSaved)}
            className="text-xs text-neutral-500 hover:text-neutral-300 transition-colors mb-2"
          >
            {showSaved ? 'Hide' : 'Show'} previous drafts ({savedDrafts.length})
          </button>
          {showSaved && (
            <div className="space-y-2">
              {savedDrafts.map((draft, i) => (
                <div key={draft.id ?? i} className="bg-neutral-900/50 border border-neutral-800/50 rounded p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-neutral-400 font-medium">{draft.subject}</span>
                    <span className="text-[11px] text-neutral-600">
                      {new Date(draft.created_at).toLocaleDateString()} &middot; {draft.tone}
                    </span>
                  </div>
                  <p className="text-xs text-neutral-500 whitespace-pre-line line-clamp-3">{draft.body}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {!selectedProspect && !loading && prospects.length > 0 && (
        <div className="text-center py-16 text-neutral-500 text-sm">
          Select a prospect above to generate outreach.
        </div>
      )}
    </div>
  );
}
