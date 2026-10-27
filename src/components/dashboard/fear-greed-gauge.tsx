import { getBand } from "@/lib/fear-greed/classify";
import { SENTIMENT_BANDS } from "@/lib/ui/sentiment";

const CX = 150;
const CY = 150;
const R = 118;
const STROKE = 20;

/** score(0~100) → 반원 위의 좌표. 0=왼쪽(공포), 100=오른쪽(탐욕) */
function point(score: number, radius = R) {
  const theta = Math.PI * (1 - score / 100);
  return { x: CX + radius * Math.cos(theta), y: CY - radius * Math.sin(theta) };
}

function arcPath(from: number, to: number) {
  const a = point(from);
  const b = point(to);
  return `M ${a.x.toFixed(2)} ${a.y.toFixed(2)} A ${R} ${R} 0 0 1 ${b.x.toFixed(2)} ${b.y.toFixed(2)}`;
}

/**
 * 반원형 공포·탐욕 게이지 (서버 렌더링 SVG).
 * 현재 구간은 진하게, 나머지 구간은 옅게 표시해 시선이 현재 상태에 모이게 한다.
 */
export function FearGreedGauge({ score, size = "lg" }: { score: number; size?: "lg" | "sm" }) {
  const active = getBand(score).key;
  const needle = point(score, R - STROKE / 2 - 14);
  const label = (s: number) => point(s, R + STROKE / 2 + 14);

  return (
    <svg
      viewBox="0 0 300 172"
      role="img"
      aria-label={`공포·탐욕지수 게이지: ${score}점, ${getBand(score).label}`}
      className={size === "lg" ? "w-full max-w-[360px]" : "w-full max-w-[200px]"}
    >
      {SENTIMENT_BANDS.map((band, i) => {
        // 구간 사이 시각적 간격 (양 끝은 제외)
        const from = i === 0 ? 0 : band.min - 0.5 + 0.7;
        const to = i === SENTIMENT_BANDS.length - 1 ? 100 : band.max + 0.5 - 0.7;
        return (
          <path
            key={band.key}
            d={arcPath(from, to)}
            fill="none"
            stroke={band.color}
            strokeWidth={STROKE}
            strokeLinecap="butt"
            opacity={band.key === active ? 1 : 0.32}
          />
        );
      })}

      {/* 눈금 라벨 */}
      {[0, 25, 50, 75, 100].map((s) => {
        const p = label(s);
        return (
          <text
            key={s}
            x={p.x}
            y={p.y + 4}
            textAnchor={s === 0 ? "start" : s === 100 ? "end" : "middle"}
            className="fill-muted-foreground"
            fontSize="10"
          >
            {s}
          </text>
        );
      })}

      {/* 바늘 */}
      <line
        x1={CX}
        y1={CY}
        x2={needle.x}
        y2={needle.y}
        stroke="var(--foreground)"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <circle cx={CX} cy={CY} r="7" fill="var(--foreground)" />
      <circle cx={CX} cy={CY} r="3" fill="var(--background)" />

      <text x="22" y="168" className="fill-muted-foreground" fontSize="11" fontWeight={500}>
        공포
      </text>
      <text x="278" y="168" textAnchor="end" className="fill-muted-foreground" fontSize="11" fontWeight={500}>
        탐욕
      </text>
    </svg>
  );
}
