import type { Classification, ClassificationKey } from "./types";

export interface ClassificationBand {
  key: ClassificationKey;
  label: Classification;
  /** 포함 하한 */
  min: number;
  /** 포함 상한 */
  max: number;
}

/**
 * 점수 구간.
 * 0~20 극도의 공포 / 21~40 공포 / 41~60 중립 / 61~80 탐욕 / 81~100 극도의 탐욕
 */
export const CLASSIFICATION_BANDS: readonly ClassificationBand[] = [
  { key: "extreme-fear", label: "극도의 공포", min: 0, max: 20 },
  { key: "fear", label: "공포", min: 21, max: 40 },
  { key: "neutral", label: "중립", min: 41, max: 60 },
  { key: "greed", label: "탐욕", min: 61, max: 80 },
  { key: "extreme-greed", label: "극도의 탐욕", min: 81, max: 100 },
] as const;

export function clampScore(score: number): number {
  if (!Number.isFinite(score)) return 50;
  return Math.min(100, Math.max(0, score));
}

/** 소수 점수도 받을 수 있도록 반올림 후 구간을 판정한다. */
export function getBand(score: number): ClassificationBand {
  const s = Math.round(clampScore(score));
  return (
    CLASSIFICATION_BANDS.find((b) => s >= b.min && s <= b.max) ??
    CLASSIFICATION_BANDS[2]
  );
}

export function classify(score: number): Classification {
  return getBand(score).label;
}

export function classificationKey(score: number): ClassificationKey {
  return getBand(score).key;
}
