interface Props {
  signal: string;
}

const signalColors: Record<string, string> = {
  ai: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  cloud: 'bg-sky-500/20 text-sky-300 border-sky-500/30',
  hire: 'bg-green-500/20 text-green-300 border-green-500/30',
  regulatory: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  earnings: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  partner: 'bg-teal-500/20 text-teal-300 border-teal-500/30',
  default: 'bg-gray-500/20 text-gray-300 border-gray-500/30',
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
    <span className={`inline-block px-2 py-0.5 text-xs rounded-full border ${getColor(signal)}`}>
      {signal}
    </span>
  );
}
