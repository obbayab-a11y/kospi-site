import { classify, clampScore } from "./classify";
import { computeAllFactors, type FactorEngineOptions } from "./factors";
import {
  FACTOR_KEYS,
  type FactorKey,
  type FactorRawData,
  type FearGreedDaily,
  type MarketDataset,
} from "./types";
import { DEFAULT_WEIGHTS, redistributeWeights } from "./weights";

export type FactorScoreInput = Partial<Record<FactorKey, number | null>>;

export interface IndexCalculation {
  /** 최종 점수: round 후 0~100 clamp */
  score: number;
  /** 반올림 전 가중 평균 */
  rawScore: number;
  appliedWeights: Partial<Record<FactorKey, number>>;
  missingFactors: FactorKey[];
}

/**
 * 개별 Factor 점수(0~100)의 가중 평균으로 최종 지수를 계산한다.
 *
 * - null/NaN/undefined Factor는 제외하고 가중치를 비례 재분배한다.
 * - 개별 점수도 0~100으로 clamp한 뒤 사용한다.
 * - 사용 가능한 Factor가 없으면 null을 반환한다.
 */
export function calculateIndex(
  factorScores: FactorScoreInput,
  weights: Readonly<Record<FactorKey, number>> = DEFAULT_WEIGHTS,
): IndexCalculation | null {
  const available = FACTOR_KEYS.filter((k) => {
    const s = factorScores[k];
    return s !== null && s !== undefined && Number.isFinite(s);
  });
  const missingFactors = FACTOR_KEYS.filter((k) => !available.includes(k));
  const appliedWeights = redistributeWeights(available, weights);
  if (available.length === 0) return null;

  const rawScore = available.reduce(
    (sum, k) => sum + clampScore(factorScores[k] as number) * (appliedWeights[k] ?? 0),
    0,
  );
  return {
    score: clampScore(Math.round(rawScore)),
    rawScore,
    appliedWeights,
    missingFactors,
  };
}

export interface SeriesOptions extends FactorEngineOptions {
  /**
   * 점수를 공표하기 위한 최소 가용 가중치 합(기본 가중치 기준).
   * 기본 0.5 — 핵심 지표 절반 이상이 있어야 그날 지수를 산출한다.
   */
  minWeightCoverage?: number;
  weights?: Readonly<Record<FactorKey, number>>;
  updatedAt?: string;
}

const round1 = (v: number | null) =>
  v === null ? null : Math.round(v * 10) / 10;

/**
 * 원천 데이터셋 전체로부터 일별 공포·탐욕지수 시계열을 계산한다.
 * 결과는 날짜 오름차순이며, 산출 가능한 날짜만 포함한다.
 */
export function calculateFearGreedSeries(
  dataset: MarketDataset,
  options: SeriesOptions = {},
): FearGreedDaily[] {
  const {
    minWeightCoverage = 0.5,
    weights = DEFAULT_WEIGHTS,
    updatedAt = new Date().toISOString(),
    ...engineOpts
  } = options;

  const factors = computeAllFactors(dataset, engineOpts);
  const out: FearGreedDaily[] = [];

  dataset.kospi.forEach((k, i) => {
    const scores: Record<FactorKey, number | null> = {
      momentum: round1(factors.momentum.scores[i]),
      volatility: round1(factors.volatility.scores[i]),
      breadth: round1(factors.breadth.scores[i]),
      foreignFlow: round1(factors.foreignFlow.scores[i]),
      marketStrength: round1(factors.marketStrength.scores[i]),
      putCall: round1(factors.putCall.scores[i]),
      riskAppetite: round1(factors.riskAppetite.scores[i]),
    };

    const coverage = FACTOR_KEYS.reduce(
      (s, key) => (scores[key] === null ? s : s + weights[key]),
      0,
    );
    if (coverage < minWeightCoverage) return;

    const calc = calculateIndex(scores, weights);
    if (!calc) return;

    const rawData: FactorRawData = {
      momentum: factors.momentum.raws[i],
      volatility: factors.volatility.raws[i],
      breadth: factors.breadth.raws[i],
      foreignFlow: factors.foreignFlow.raws[i],
      marketStrength: factors.marketStrength.raws[i],
      putCall: factors.putCall.raws[i],
      riskAppetite: factors.riskAppetite.raws[i],
    };

    out.push({
      date: k.date,
      score: calc.score,
      classification: classify(calc.score),
      kospiClose: k.close,
      momentumScore: scores.momentum,
      volatilityScore: scores.volatility,
      breadthScore: scores.breadth,
      foreignFlowScore: scores.foreignFlow,
      marketStrengthScore: scores.marketStrength,
      putCallScore: scores.putCall,
      riskAppetiteScore: scores.riskAppetite,
      rawData,
      appliedWeights: calc.appliedWeights,
      missingFactors: calc.missingFactors,
      updatedAt,
    });
  });

  return out;
}
