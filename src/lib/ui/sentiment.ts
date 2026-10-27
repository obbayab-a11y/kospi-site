import { CLASSIFICATION_BANDS, getBand } from "../fear-greed/classify";
import type { ClassificationKey } from "../fear-greed/types";

/** 심리 구간별 색 (CSS 변수 — 라이트/다크 모드 자동 전환) */
export const SENTIMENT_COLOR: Record<ClassificationKey, string> = {
  "extreme-fear": "var(--sentiment-extreme-fear)",
  fear: "var(--sentiment-fear)",
  neutral: "var(--sentiment-neutral)",
  greed: "var(--sentiment-greed)",
  "extreme-greed": "var(--sentiment-extreme-greed)",
};

export function sentimentColor(score: number): string {
  return SENTIMENT_COLOR[getBand(score).key];
}

export const SENTIMENT_BANDS = CLASSIFICATION_BANDS.map((b) => ({
  ...b,
  color: SENTIMENT_COLOR[b.key],
}));

/** 국내 관례: 상승=빨강, 하락=파랑 */
export function deltaColorClass(delta: number): string {
  if (delta > 0) return "text-price-up";
  if (delta < 0) return "text-price-down";
  return "text-muted-foreground";
}

export function deltaArrow(delta: number): string {
  if (delta > 0) return "▲";
  if (delta < 0) return "▼";
  return "";
}
