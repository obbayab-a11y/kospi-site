/**
 * Provider 레지스트리.
 *
 * DATA_MODE=demo  → 모든 슬롯에 Mock Provider
 * DATA_MODE=live  → KRX Open API Provider (+ 외국인 수급은 CSV 또는 미연결)
 *
 * Provider를 교체하려면 이 파일에서 해당 슬롯에 MarketDataProvider<T> 구현체를
 * 넣기만 하면 된다. 계산 엔진·UI는 Provider 구현에 의존하지 않는다.
 */
import { getEnv, type AppEnv } from "../config/env";
import type { ForeignFlowObservation } from "../fear-greed/types";
import { CsvForeignFlowProvider } from "./file/csv-foreign-flow";
import { KrxClient } from "./krx/client";
import {
  KrxBreadthProvider,
  KrxKospiProvider,
  KrxMarketStrengthProvider,
  KrxPutCallProvider,
  KrxRiskAppetiteProvider,
  KrxVolatilityProvider,
} from "./krx/providers";
import { createMockProviders } from "./mock";
import type { ProviderSet } from "./types";
import { UnconfiguredProvider } from "./unconfigured";

export * from "./types";

export function createLiveProviders(env: AppEnv): ProviderSet {
  const client = new KrxClient({
    apiKey: env.KRX_API_KEY ?? "",
    baseUrl: env.KRX_API_BASE_URL,
    cacheDir: env.KRX_CACHE_DIR,
  });

  const foreignFlow = env.FOREIGN_FLOW_CSV
    ? new CsvForeignFlowProvider(env.FOREIGN_FLOW_CSV)
    : new UnconfiguredProvider<ForeignFlowObservation>(
        "unconfigured-foreign-flow",
        "외국인 순매수",
        "KRX Open API는 투자자별 매매동향을 제공하지 않습니다. FOREIGN_FLOW_CSV를 지정하거나 라이선스가 있는 데이터 API Provider를 구현하세요.",
      );

  return {
    kospi: new KrxKospiProvider(client),
    volatility: new KrxVolatilityProvider(client),
    breadth: new KrxBreadthProvider(client),
    foreignFlow,
    marketStrength: new KrxMarketStrengthProvider(client),
    putCall: new KrxPutCallProvider(client),
    riskAppetite: new KrxRiskAppetiteProvider(client),
  };
}

export function getProviders(env: AppEnv = getEnv()): ProviderSet {
  if (env.DATA_MODE === "live") return createLiveProviders(env);
  return createMockProviders(env.DEMO_FAIL_FACTORS);
}
