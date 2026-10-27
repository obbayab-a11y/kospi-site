import type {
  BreadthObservation,
  DailyObservation,
  FactorKey,
  ForeignFlowObservation,
  KospiObservation,
  MarketStrengthObservation,
  PutCallObservation,
  RiskAppetiteObservation,
  VolatilityObservation,
} from "../fear-greed/types";

export type ProviderKind = "live" | "mock" | "file" | "unconfigured";

export interface ProviderInfo {
  /** 고유 식별자 (예: "krx-kospi") */
  id: string;
  /** 화면 표시명 */
  name: string;
  kind: ProviderKind;
  /** 데이터 출처 설명 */
  source: string;
  sourceUrl?: string;
  /** 추가 안내 (예: 실제 데이터 소스 연결 필요) */
  note?: string;
}

/**
 * 모든 데이터 Provider의 공통 인터페이스.
 * 각 Provider는 독립적으로 데이터를 가져오며, 실패해도 다른 Provider에 영향을 주지 않는다.
 */
export interface MarketDataProvider<T extends DailyObservation> {
  readonly info: ProviderInfo;
  /** 가장 최근 관측치 */
  getCurrent(): Promise<T>;
  /** [start, end] 기간의 일별 관측치 (날짜 오름차순) */
  getHistory(start: Date, end: Date): Promise<T[]>;
}

export type KospiProvider = MarketDataProvider<KospiObservation>;
export type VolatilityProvider = MarketDataProvider<VolatilityObservation>;
export type MarketBreadthProvider = MarketDataProvider<BreadthObservation>;
export type ForeignFlowProvider = MarketDataProvider<ForeignFlowObservation>;
export type MarketStrengthProvider = MarketDataProvider<MarketStrengthObservation>;
export type PutCallProvider = MarketDataProvider<PutCallObservation>;
export type RiskAppetiteProvider = MarketDataProvider<RiskAppetiteObservation>;

export interface ProviderSet {
  kospi: KospiProvider;
  volatility: VolatilityProvider;
  breadth: MarketBreadthProvider;
  foreignFlow: ForeignFlowProvider;
  marketStrength: MarketStrengthProvider;
  putCall: PutCallProvider;
  riskAppetite: RiskAppetiteProvider;
}

export type ProviderSlot = keyof ProviderSet;

/** 데이터셋 Factor 키 ↔ Provider 슬롯 매핑 (KOSPI는 모멘텀 Factor의 원천) */
export const SLOT_FACTOR: Record<ProviderSlot, FactorKey> = {
  kospi: "momentum",
  volatility: "volatility",
  breadth: "breadth",
  foreignFlow: "foreignFlow",
  marketStrength: "marketStrength",
  putCall: "putCall",
  riskAppetite: "riskAppetite",
};

export class ProviderNotConfiguredError extends Error {
  constructor(providerName: string, detail?: string) {
    super(`${providerName}: 실제 데이터 소스 연결이 필요합니다.${detail ? ` (${detail})` : ""}`);
    this.name = "ProviderNotConfiguredError";
  }
}

export class ProviderFetchError extends Error {
  constructor(providerName: string, cause: unknown) {
    super(`${providerName}: 데이터 조회 실패 — ${cause instanceof Error ? cause.message : String(cause)}`);
    this.name = "ProviderFetchError";
  }
}
