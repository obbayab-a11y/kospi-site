/**
 * 공포·탐욕지수 데이터 서비스 (UI·API 공용 진입점).
 *
 *  Providers ──► MarketDataset ──► 계산 엔진 ──► FearGreedDaily[] ──► 캐시/저장소
 *
 * 장애 대응
 *  1. Provider 단위 실패  → 해당 Factor 제외 + 가중치 자동 재분배
 *  2. 필수 데이터(KOSPI) 실패 또는 전체 실패 → 마지막 정상 데이터(last-good) 사용
 *  3. last-good도 없음 (live 첫 실행 실패) → 데모 데이터로 대체하고 화면에 안내
 */
import { cache } from "react";
import { subYears } from "date-fns";
import { getEnv } from "../config/env";
import { TtlCache } from "../cache/memory-cache";
import { getCacheTtlSeconds } from "../cache/ttl";
import { calculateFearGreedSeries } from "../fear-greed/calculateIndex";
import type { FactorKey, FearGreedDaily, MarketDataset } from "../fear-greed/types";
import {
  getProviders,
  ProviderNotConfiguredError,
  SLOT_FACTOR,
  type ProviderInfo,
  type ProviderSet,
  type ProviderSlot,
} from "../providers";
import { createMockProviders } from "../providers/mock";
import { MOCK_START_DATE } from "../providers/mock/generator";
import { getSnapshotStore } from "../store/snapshot-store";
import { lastCompletedTradingDay } from "../utils/date";

export type ProviderState = "ok" | "error" | "unconfigured";

export interface ProviderStatus {
  slot: ProviderSlot;
  factor: FactorKey;
  info: ProviderInfo;
  state: ProviderState;
  observations: number;
  lastDate: string | null;
  error?: string;
}

export interface FearGreedSnapshot {
  /** 설정된 모드 */
  mode: "demo" | "live";
  /** 실제로 화면에 표시 중인 데이터의 모드 (live 실패 시 demo로 대체될 수 있음) */
  effectiveMode: "demo" | "live";
  series: FearGreedDaily[];
  latest: FearGreedDaily;
  providers: ProviderStatus[];
  generatedAt: string;
  /** 갱신 실패로 마지막 정상 데이터를 표시 중 */
  stale: boolean;
  notices: string[];
}

const SLOTS: ProviderSlot[] = [
  "kospi",
  "volatility",
  "breadth",
  "foreignFlow",
  "marketStrength",
  "putCall",
  "riskAppetite",
];

/* ------------------------------------------------------------------ */

export interface DatasetLoadResult {
  dataset: MarketDataset;
  statuses: ProviderStatus[];
}

/** 모든 Provider를 병렬·독립적으로 호출해 데이터셋을 만든다. */
export async function loadMarketDataset(
  providers: ProviderSet,
  start: Date,
  end: Date,
): Promise<DatasetLoadResult> {
  const results = await Promise.allSettled(
    SLOTS.map((slot) => providers[slot].getHistory(start, end)),
  );

  const statuses: ProviderStatus[] = SLOTS.map((slot, i) => {
    const r = results[i];
    const info = providers[slot].info;
    if (r.status === "fulfilled") {
      return {
        slot,
        factor: SLOT_FACTOR[slot],
        info,
        state: r.value.length > 0 ? "ok" : "error",
        observations: r.value.length,
        lastDate: r.value.at(-1)?.date ?? null,
        error: r.value.length > 0 ? undefined : "데이터 없음",
      };
    }
    const reason: unknown = r.reason;
    return {
      slot,
      factor: SLOT_FACTOR[slot],
      info,
      state: reason instanceof ProviderNotConfiguredError ? "unconfigured" : "error",
      observations: 0,
      lastDate: null,
      error: reason instanceof Error ? reason.message : String(reason),
    };
  });

  const pick = <S extends ProviderSlot>(slot: S) => {
    const r = results[SLOTS.indexOf(slot)];
    return r.status === "fulfilled" && r.value.length > 0 ? r.value : null;
  };

  const kospi = pick("kospi");
  if (!kospi) {
    const err = statuses.find((s) => s.slot === "kospi")?.error ?? "KOSPI 데이터 없음";
    throw new Error(`필수 데이터(KOSPI) 조회 실패: ${err}`);
  }

  const dataset: MarketDataset = {
    kospi: kospi as MarketDataset["kospi"],
    volatility: pick("volatility") as MarketDataset["volatility"],
    breadth: pick("breadth") as MarketDataset["breadth"],
    foreignFlow: pick("foreignFlow") as MarketDataset["foreignFlow"],
    marketStrength: pick("marketStrength") as MarketDataset["marketStrength"],
    putCall: pick("putCall") as MarketDataset["putCall"],
    riskAppetite: pick("riskAppetite") as MarketDataset["riskAppetite"],
  };
  return { dataset, statuses };
}

function historyStart(mode: "demo" | "live", end: Date, lookbackYears: number): Date {
  if (mode === "demo") return new Date(`${MOCK_START_DATE}T00:00:00+09:00`);
  // live: 5년 lookback + 이동평균/정규화 워밍업(약 1년)
  return subYears(end, lookbackYears + 1);
}

async function computeSnapshot(
  providers: ProviderSet,
  mode: "demo" | "live",
  lookbackYears: number,
): Promise<Omit<FearGreedSnapshot, "mode" | "stale">> {
  const end = new Date();
  const { dataset, statuses } = await loadMarketDataset(
    providers,
    historyStart(mode, end, lookbackYears),
    end,
  );
  const generatedAt = new Date().toISOString();
  const series = calculateFearGreedSeries(dataset, {
    lookback: 252 * lookbackYears,
    updatedAt: generatedAt,
  });
  const latest = series.at(-1);
  if (!latest) throw new Error("지수를 산출할 수 있는 데이터가 부족합니다.");

  const notices: string[] = [];
  const failed = statuses.filter((s) => s.state === "error");
  const unconfigured = statuses.filter((s) => s.state === "unconfigured");
  if (failed.length > 0 || latest.missingFactors.length > unconfigured.length) {
    notices.push("일부 지표 데이터 업데이트 지연");
  }
  if (unconfigured.length > 0) {
    notices.push(
      `미연결 지표(${unconfigured.map((s) => s.info.name).join(", ")})는 제외하고 가중치를 재분배했습니다.`,
    );
  }

  return { effectiveMode: mode, series, latest, providers: statuses, generatedAt, notices };
}

/* ------------------------------------------------------------------ */

const snapshotCache = new TtlCache<FearGreedSnapshot>();
let lastGood: FearGreedSnapshot | null = null;

async function refreshSnapshot(): Promise<FearGreedSnapshot> {
  const env = getEnv();
  const mode = env.DATA_MODE;
  const store = await getSnapshotStore().catch(() => null);

  try {
    const snap = await computeSnapshot(getProviders(env), mode, env.LOOKBACK_YEARS);
    const full: FearGreedSnapshot = { ...snap, mode, stale: false };
    lastGood = full;
    if (store && mode === "live") {
      await store.save(full.series).catch((e: unknown) => {
        console.error("[fear-greed] 저장소 저장 실패", e);
      });
    }
    return full;
  } catch (err) {
    console.error("[fear-greed] 데이터 갱신 실패", err);
    const message = "데이터 업데이트가 지연되고 있어 마지막 정상 데이터를 표시합니다.";

    // 1) 메모리의 마지막 정상 데이터
    if (lastGood) {
      return { ...lastGood, stale: true, notices: [message, ...lastGood.notices] };
    }
    // 2) 영속 저장소의 마지막 정상 데이터
    const stored = await store?.load().catch(() => null);
    if (stored && stored.length > 0) {
      return {
        mode,
        effectiveMode: mode,
        series: stored,
        latest: stored[stored.length - 1],
        providers: [],
        generatedAt: stored[stored.length - 1].updatedAt,
        stale: true,
        notices: [message],
      };
    }
    // 3) live 모드인데 아무 데이터도 없으면 데모 데이터로 대체
    if (mode === "live") {
      const demo = await computeSnapshot(createMockProviders(), "demo", env.LOOKBACK_YEARS);
      return {
        ...demo,
        mode,
        effectiveMode: "demo",
        stale: true,
        notices: ["실시간 데이터 연결에 실패해 데모 데이터를 표시합니다.", ...demo.notices],
      };
    }
    throw err;
  }
}

/**
 * 캐시된 스냅샷을 반환한다.
 * 장중 10분 / 장 종료 후 1시간 TTL. 같은 요청 안에서는 React cache로 한 번만 계산한다.
 */
export const getFearGreedSnapshot = cache(async (): Promise<FearGreedSnapshot> => {
  const key = `${getEnv().DATA_MODE}:${lastCompletedTradingDay()}`;
  return snapshotCache.getOrLoad(key, getCacheTtlSeconds(), refreshSnapshot);
});

/** 테스트·스크립트용: 캐시를 무시하고 다시 계산 */
export async function computeFreshSnapshot(): Promise<FearGreedSnapshot> {
  snapshotCache.clear();
  return refreshSnapshot();
}
