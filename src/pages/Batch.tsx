import { useState, useRef } from 'react';
import { batchPreview, batchGenerate, type BatchContact, type BatchResult } from '../lib/api';

const TONES = [
  { value: 'executive', label: 'Executive' },
  { value: 'professional', label: 'Professional' },
  { value: 'technical', label: 'Technical' },
];

export default function Batch() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [contacts, setContacts] = useState<BatchContact[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [tone, setTone] = useState('professional');
  const [senderName, setSenderName] = useState('');
  const [results, setResults] = useState<BatchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState('');
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setParsing(true);
    setError('');
    setContacts([]);
    setResults([]);

    try {
      const text = await file.text();
      const res = await batchPreview(text);
      setContacts(res.contacts);
      setSelected(new Set(res.contacts.map((_, i) => i)));
      if (res.valid < res.total) {
        setError(`${res.total - res.valid} rows skipped (missing company name or contact name)`);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setParsing(false);
    }
  }

  async function handleGenerate() {
    const selectedContacts = contacts.filter((_, i) => selected.has(i));
    if (selectedContacts.length === 0) return;

    setLoading(true);
    setError('');
    setResults([]);
    setProgress(`Generating emails for ${selectedContacts.length} contacts...`);

    try {
      const res = await batchGenerate(selectedContacts, tone, senderName || undefined);
      setResults(res.results);
      setProgress(`Done — ${res.successful} emails generated, ${res.failed} failed`);
    } catch (err) {
      setError((err as Error).message);
      setProgress('');
    } finally {
      setLoading(false);
    }
  }

  function toggleSelect(idx: number) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx); else next.add(idx);
      return next;
    });
  }

  function toggleAll() {
    if (selected.size === contacts.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(contacts.map((_, i) => i)));
    }
  }

  function copyEmail(idx: number) {
    const r = results[idx];
    if (!r) return;
    navigator.clipboard.writeText(`Subject: ${r.email.subject}\n\n${r.email.body}`);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  }

  function copyAllEmails() {
    const text = results
      .filter(r => !r.error)
      .map(r => `To: ${r.contact.fullName} <${r.contact.email}>\nSubject: ${r.email.subject}\n\n${r.email.body}`)
      .join('\n\n---\n\n');
    navigator.clipboard.writeText(text);
    setCopiedIdx(-1);
    setTimeout(() => setCopiedIdx(null), 2000);
  }

  return (
    <div className="max-w-4xl">
      <h2 className="text-lg font-semibold text-neutral-100 mb-0.5">Batch Outreach</h2>
      <p className="text-neutral-500 text-sm mb-5">
        Upload a ZoomInfo CSV and generate personalized emails for every contact.
      </p>

      {/* Upload + Config */}
      {results.length === 0 && (
        <>
          <div className="flex items-center gap-3 mb-4">
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={parsing}
              className="px-4 py-2 bg-neutral-100 hover:bg-white disabled:bg-neutral-800 disabled:text-neutral-600 text-neutral-900 text-sm font-medium rounded transition-colors"
            >
              {parsing ? 'Parsing...' : contacts.length > 0 ? 'Upload Different CSV' : 'Upload ZoomInfo CSV'}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleFileUpload}
              className="hidden"
            />
            {contacts.length > 0 && (
              <span className="text-xs text-neutral-500">
                {contacts.length} contacts loaded
              </span>
            )}
          </div>

          {/* Contact list */}
          {contacts.length > 0 && (
            <>
              <div className="flex items-center justify-between mb-2">
                <button
                  onClick={toggleAll}
                  className="text-[11px] text-neutral-500 hover:text-neutral-300 transition-colors"
                >
                  {selected.size === contacts.length ? 'Deselect all' : 'Select all'}
                </button>
                <span className="text-[11px] text-neutral-600">
                  {selected.size} of {contacts.length} selected
                </span>
              </div>

              <div className="bg-neutral-900 border border-neutral-800 rounded mb-4 max-h-80 overflow-y-auto">
                {contacts.map((c, i) => (
                  <label
                    key={i}
                    className={`flex items-center gap-3 px-3 py-2 text-xs cursor-pointer hover:bg-neutral-800/50 transition-colors ${
                      i > 0 ? 'border-t border-neutral-800/50' : ''
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selected.has(i)}
                      onChange={() => toggleSelect(i)}
                      className="rounded border-neutral-700"
                    />
                    <div className="flex-1 min-w-0">
                      <span className="text-neutral-200 font-medium">{c.fullName || `${c.firstName} ${c.lastName}`}</span>
                      <span className="text-neutral-500 ml-2">{c.jobTitle}</span>
                    </div>
                    <span className="text-neutral-400 truncate max-w-48">{c.companyName}</span>
                    <span className="text-neutral-600 text-[11px]">{c.industry}</span>
                  </label>
                ))}
              </div>

              <div className="grid grid-cols-3 gap-3 mb-4">
                <div>
                  <label className="block text-xs text-neutral-500 mb-1">Your Name</label>
                  <input
                    type="text"
                    value={senderName}
                    onChange={e => setSenderName(e.target.value)}
                    placeholder="e.g., Ryan Stanley"
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
                <div className="flex items-end">
                  <button
                    onClick={handleGenerate}
                    disabled={loading || selected.size === 0}
                    className="w-full px-4 py-2 bg-neutral-100 hover:bg-white disabled:bg-neutral-800 disabled:text-neutral-600 text-neutral-900 text-sm font-medium rounded transition-colors"
                  >
                    {loading ? 'Generating...' : `Generate ${selected.size} Email${selected.size !== 1 ? 's' : ''}`}
                  </button>
                </div>
              </div>
            </>
          )}
        </>
      )}

      {error && (
        <div className="bg-red-950/50 border border-red-900/50 text-red-400 px-3 py-2 rounded text-sm mb-4">
          {error}
        </div>
      )}

      {loading && (
        <div className="text-center py-12">
          <div className="inline-block w-5 h-5 border-2 border-neutral-500 border-t-transparent rounded-full animate-spin mb-3" />
          <p className="text-neutral-500 text-sm">{progress}</p>
          <p className="text-neutral-600 text-[11px] mt-1">This can take a few minutes for large batches.</p>
        </div>
      )}

      {/* Results */}
      {results.length > 0 && !loading && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs text-neutral-500">{progress}</p>
            <div className="flex gap-2">
              <button
                onClick={copyAllEmails}
                className="text-xs px-2.5 py-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded transition-colors"
              >
                {copiedIdx === -1 ? 'Copied All' : 'Copy All Emails'}
              </button>
              <button
                onClick={() => { setResults([]); setProgress(''); }}
                className="text-xs px-2.5 py-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded transition-colors"
              >
                New Batch
              </button>
            </div>
          </div>

          <div className="space-y-2">
            {results.map((r, i) => (
              <div
                key={i}
                className={`bg-neutral-900 border rounded overflow-hidden ${r.error ? 'border-red-900/50' : 'border-neutral-800'}`}
              >
                <div
                  className="flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-neutral-800/30 transition-colors"
                  onClick={() => setExpandedIdx(expandedIdx === i ? null : i)}
                >
                  <div className="flex items-center gap-2 text-xs min-w-0">
                    <span className="text-neutral-200 font-medium truncate">
                      {r.contact.fullName || `${r.contact.firstName} ${r.contact.lastName}`}
                    </span>
                    <span className="text-neutral-500 truncate">{r.contact.jobTitle}</span>
                    <span className="text-neutral-600">@</span>
                    <span className="text-neutral-400 truncate">{r.contact.companyName}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    {r.error ? (
                      <span className="text-[11px] text-red-400">Failed</span>
                    ) : (
                      <>
                        <button
                          onClick={(e) => { e.stopPropagation(); copyEmail(i); }}
                          className="text-xs text-neutral-500 hover:text-neutral-200 transition-colors"
                        >
                          {copiedIdx === i ? 'Copied' : 'Copy'}
                        </button>
                        {r.contact.email && (
                          <a
                            href={`mailto:${r.contact.email}?subject=${encodeURIComponent(r.email.subject)}&body=${encodeURIComponent(r.email.body)}`}
                            onClick={e => e.stopPropagation()}
                            className="text-xs text-neutral-500 hover:text-neutral-200 transition-colors"
                          >
                            Draft in Mail
                          </a>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {expandedIdx === i && !r.error && (
                  <div className="px-3 pb-3 border-t border-neutral-800">
                    <p className="text-xs text-neutral-400 font-medium mt-2 mb-1">{r.email.subject}</p>
                    <p className="text-xs text-neutral-300 whitespace-pre-line leading-relaxed">{r.email.body}</p>
                    {r.contact.email && (
                      <p className="text-[11px] text-neutral-600 mt-2">
                        {r.contact.email}
                        {r.contact.linkedinUrl && (
                          <> &middot; <a href={r.contact.linkedinUrl} target="_blank" rel="noreferrer" className="text-blue-400 hover:underline">LinkedIn</a></>
                        )}
                      </p>
                    )}
                  </div>
                )}

                {expandedIdx === i && r.error && (
                  <div className="px-3 pb-3 border-t border-neutral-800">
                    <p className="text-xs text-red-400 mt-2">{r.error}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {contacts.length === 0 && results.length === 0 && !loading && !parsing && (
        <div className="text-center py-16">
          <p className="text-neutral-400 text-sm mb-3">Upload a ZoomInfo CSV to get started.</p>
          <p className="text-neutral-600 text-xs">
            Export contacts from ZoomInfo, upload the CSV here, and we'll write a personalized email for each one.
          </p>
        </div>
      )}
    </div>
  );
}
