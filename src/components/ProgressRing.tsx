import { toArabicDigits } from '../lib/store';

interface Props {
  read: number;
  total: number;
  size?: number;
}

export default function ProgressRing({ read, total, size = 168 }: Props) {
  const pct = total > 0 ? read / total : 0;
  const stroke = 12;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="ring-wrap" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="ring-svg">
        <circle cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} className="ring-bg" fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          strokeWidth={stroke}
          className="ring-fg"
          fill="none"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div className="ring-center">
        <div className="ring-pct">{toArabicDigits(Math.round(pct * 100))}٪</div>
        <div className="ring-count">
          {toArabicDigits(read)} من {toArabicDigits(total)} صفحة
        </div>
      </div>
    </div>
  );
}
