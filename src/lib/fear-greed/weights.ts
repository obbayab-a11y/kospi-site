import type { FactorKey } from "./types";

/** 기본 가중치. 합계는 반드시 1이어야 한다 (unit test로 보장). */
export const DEFAULT_WEIGHTS: Readonly<Record<FactorKey, number>> = {
  momentum: 0.2,
  volatility: 0.2,
  breadth: 0.2,
  foreignFlow: 0.15,
  marketStrength: 0.1,
  putCall: 0.1,
  riskAppetite: 0.05,
};

/**
 * 사용 가능한 Factor에만 가중치를 비례 재분배한다.
 *
 * 예) putCall(10%) 누락 시 나머지 90%를 100%로 환산:
 *     momentum 0.2 / 0.9 = 0.2222...
 *
 * 사용 가능한 Factor가 하나도 없으면 빈 객체를 반환한다.
 */
export function redistributeWeights(
  available: readonly FactorKey[],
  weights: Readonly<Record<FactorKey, number>> = DEFAULT_WEIGHTS,
): Partial<Record<FactorKey, number>> {
  const unique = Array.from(new Set(available));
  const total = unique.reduce((sum, key) => sum + weights[key], 0);
  if (total <= 0) return {};

  const result: Partial<Record<FactorKey, number>> = {};
  for (const key of unique) {
    result[key] = weights[key] / total;
  }
  return result;
}

export function sumWeights(
  weights: Partial<Record<FactorKey, number>>,
): number {
  return Object.values(weights).reduce<number>((s, w) => s + (w ?? 0), 0);
}
