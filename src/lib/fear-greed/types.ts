/**
 * KOSPI 공포·탐욕지수 도메인 타입.
 *
 * 날짜는 모두 KST 기준 거래일 문자열(yyyy-MM-dd)로 다룬다.
 * 타임존 변환으로 인한 날짜 밀림을 피하기 위함이다.
 */

export type IsoDate = string;

export type FactorKey =
  | "momentum"
  | "volatility"
  | "breadth"
  | "foreignFlow"
  | "marketStrength"
  | "putCall"
  | "riskAppetite";

export const FACTOR_KEYS: readonly FactorKey[] = [
  "momentum",
  "volatility",
  "breadth",
  "foreignFlow",
  "marketStrength",
  "putCall",
  "riskAppetite",
] as const;

export type Classification =
  | "극도의 공포"
  | "공포"
  | "중립"
  | "탐욕"
  | "극도의 탐욕";

export type ClassificationKey =
  | "extreme-fear"
  | "fear"
  | "neutral"
  | "greed"
  | "extreme-greed";

/* ------------------------------------------------------------------ */
/* 원천(raw) 시장 데이터 — Provider가 반환하는 일별 관측치                  */
/* ------------------------------------------------------------------ */

export interface DailyObservation {
  date: IsoDate;
}

export interface KospiObservation extends DailyObservation {
  close: number;
}

export interface VolatilityObservation extends DailyObservation {
  /** VKOSPI(코스피200 변동성지수) 종가 */
  vkospi: number;
}

export interface BreadthObservation extends DailyObservation {
  advancing: number;
  declining: number;
  unchanged?: number;
}

export interface ForeignFlowObservation extends DailyObservation {
  /** 외국인 KOSPI 순매수 금액 (억원) */
  netBuy: number;
}

export interface MarketStrengthObservation extends DailyObservation {
  /** 52주 신고가 종목 수 */
  newHighs?: number;
  /** 52주 신저가 종목 수 */
  newLows?: number;
  /** 대체지표: 구성 종목 20일 수익률 중앙값 (%) */
  medianReturn20d?: number;
  /** 대체지표: 구성 종목 60일 수익률 중앙값 (%) */
  medianReturn60d?: number;
}

export interface PutCallObservation extends DailyObservation {
  /** KOSPI200 옵션 Put/Call 거래량 비율 */
  ratio: number;
}

export interface RiskAppetiteObservation extends DailyObservation {
  kosdaqClose: number;
  /** 코스피 소형주 지수 (선택) */
  smallCapClose?: number;
  /** 코스피 대형주 지수 (선택) */
  largeCapClose?: number;
}

/** 계산 엔진 입력: 날짜별로 정렬된 Factor별 시계열 묶음 */
export interface MarketDataset {
  kospi: KospiObservation[];
  volatility: VolatilityObservation[] | null;
  breadth: BreadthObservation[] | null;
  foreignFlow: ForeignFlowObservation[] | null;
  marketStrength: MarketStrengthObservation[] | null;
  putCall: PutCallObservation[] | null;
  riskAppetite: RiskAppetiteObservation[] | null;
}

/* ------------------------------------------------------------------ */
/* Factor 결과                                                         */
/* ------------------------------------------------------------------ */

interface FactorResultBase<K extends FactorKey, R> {
  key: K;
  /** 0~100 정규화 점수. 계산 불가 시 null */
  score: number | null;
  /** 점수 산출에 사용한 원천 수치 */
  raw: R | null;
}

export interface MomentumRaw {
  close: number;
  ma20: number;
  ma60: number;
  ma120: number;
  /** (price / MA - 1) * 100 */
  gap20: number;
  gap60: number;
  gap120: number;
}

export interface VolatilityRaw {
  source: "vkospi" | "realized";
  /** VKOSPI 또는 20일 연율화 실현 변동성 (%) */
  value: number;
  /** 1개월 전 대비 변화 (%p) */
  change20d: number | null;
}

export interface BreadthRaw {
  advancing: number;
  declining: number;
  /** 당일 상승 비율 (%) */
  ratio: number;
  /** 20일 평균 상승 비율 (%) */
  ratioMa20: number;
}

export interface ForeignFlowRaw {
  /** 억원 */
  net1d: number;
  net5d: number;
  net20d: number;
}

export interface MarketStrengthRaw {
  source: "highs-lows" | "return-distribution";
  newHighs?: number;
  newLows?: number;
  /** 신고가 비중 (%) */
  highRatio?: number;
  medianReturn20d?: number;
  medianReturn60d?: number;
}

export interface PutCallRaw {
  ratio: number;
  /** 5일 평균 */
  ratioMa5: number;
}

export interface RiskAppetiteRaw {
  /** KOSDAQ/KOSPI 상대강도 20일 변화율 (%) */
  kosdaqRelative20d: number;
  /** KOSDAQ 20일 수익률 (%) */
  kosdaqReturn20d: number;
  /** 소형주/대형주 상대강도 20일 변화율 (%) */
  smallLargeRelative20d?: number;
}

export type MomentumFactor = FactorResultBase<"momentum", MomentumRaw>;
export type VolatilityFactor = FactorResultBase<"volatility", VolatilityRaw>;
export type BreadthFactor = FactorResultBase<"breadth", BreadthRaw>;
export type ForeignFlowFactor = FactorResultBase<"foreignFlow", ForeignFlowRaw>;
export type MarketStrengthFactor = FactorResultBase<
  "marketStrength",
  MarketStrengthRaw
>;
export type PutCallFactor = FactorResultBase<"putCall", PutCallRaw>;
export type RiskAppetiteFactor = FactorResultBase<
  "riskAppetite",
  RiskAppetiteRaw
>;

export interface FactorResults {
  momentum: MomentumFactor;
  volatility: VolatilityFactor;
  breadth: BreadthFactor;
  foreignFlow: ForeignFlowFactor;
  marketStrength: MarketStrengthFactor;
  putCall: PutCallFactor;
  riskAppetite: RiskAppetiteFactor;
}

export type AnyFactor = FactorResults[FactorKey];

export interface FactorRawData {
  momentum: MomentumRaw | null;
  volatility: VolatilityRaw | null;
  breadth: BreadthRaw | null;
  foreignFlow: ForeignFlowRaw | null;
  marketStrength: MarketStrengthRaw | null;
  putCall: PutCallRaw | null;
  riskAppetite: RiskAppetiteRaw | null;
}

/* ------------------------------------------------------------------ */
/* 일별 공포·탐욕지수                                                    */
/* ------------------------------------------------------------------ */

export interface FearGreedDaily {
  date: IsoDate;
  score: number;
  classification: Classification;
  kospiClose: number;

  momentumScore: number | null;
  volatilityScore: number | null;
  breadthScore: number | null;
  foreignFlowScore: number | null;
  marketStrengthScore: number | null;
  putCallScore: number | null;
  riskAppetiteScore: number | null;

  rawData: FactorRawData;

  /** 실제 적용된 (재분배 후) 가중치 */
  appliedWeights: Partial<Record<FactorKey, number>>;
  /** 누락되어 제외된 Factor */
  missingFactors: FactorKey[];

  updatedAt: string;
}

export const SCORE_FIELD: Record<FactorKey, keyof FearGreedDaily> = {
  momentum: "momentumScore",
  volatility: "volatilityScore",
  breadth: "breadthScore",
  foreignFlow: "foreignFlowScore",
  marketStrength: "marketStrengthScore",
  putCall: "putCallScore",
  riskAppetite: "riskAppetiteScore",
};

export function getFactorScore(
  day: FearGreedDaily,
  key: FactorKey,
): number | null {
  return day[SCORE_FIELD[key]] as number | null;
}
