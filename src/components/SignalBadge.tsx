interface Props {
  signal: string;
}

const signalColors: Record<string, string> = {
  ai: 'bg-violet-500/10 text-violet-400',
  cloud: 'bg-sky-500/10 text-sky-400',
  hire: 'bg-emerald-500/10 text-emerald-400',
  regulatory: 'bg-amber-500/10 text-amber-400',
  earnings: 'bg-blue-500/10 text-blue-400',
  partner: 'bg-teal-500/10 text-teal-400',
  default: 'bg-neutral-500/10 text-neutral-400',
};

function getColor(signal: string): string {
  const lower = signal.toLowerCase();
  if (/ai|artificial|machine learning|ml/i.test(lower)) return signalColors.ai;
  if (/cloud/i.test(lower)) return signalColors.cloud;
  if (/hire|cxo|cto|cio/i.test(lower)) return signalColors.hire;
  if (/regulat/i.test(lower)) return signalColors.regulatory;
  if (/earning|revenue|financial/i.test(lower)) return signalColors.earnings;
  if (/partner|aws|azure|gcp/i.test(lower)) return signalColors.partner;
  return signalColors.default;
}

export default function SignalBadge({ signal }: Props) {
  return (
    <span className={`inline-block px-1.5 py-0.5 text-[11px] rounded ${getColor(signal)}`}>
      {signal}
    </span>
  );
}
