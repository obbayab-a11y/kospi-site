import type { DailyObservation } from "../../fear-greed/types";
import { lastCompletedTradingDay, toIsoDate } from "../../utils/date";
import {
  ProviderFetchError,
  type MarketDataProvider,
  type ProviderInfo,
  type ProviderSet,
  type ProviderSlot,
} from "../types";
import { generateMockMarketData, type MockMarketData } from "./generator";

const MOCK_SOURCE = "데모용 합성 데이터 (실제 시장 데이터 아님)";

/**
 * Mock Provider — 결정론적 합성 데이터를 반환한다.
 * `failing=true`이면 항상 실패해 Error handling(가중치 재분배)을 시연할 수 있다.
 */
export class MockProvider<T extends DailyObservation> implements MarketDataProvider<T> {
  readonly info: ProviderInfo;

  constructor(
    slot: ProviderSlot,
    name: string,
    private readonly select: (d: MockMarketData) => T[],
    private readonly failing = false,
  ) {
    this.info = { id: `mock-${slot}`, name, kind: "mock", source: MOCK_SOURCE };
  }

  private data(): T[] {
    if (this.failing) {
      throw new ProviderFetchError(this.info.name, "DEMO_FAIL_FACTORS 설정에 의한 모의 장애");
    }
    return this.select(generateMockMarketData(lastCompletedTradingDay()));
  }

  async getCurrent(): Promise<T> {
    const rows = this.data();
    const last = rows.at(-1);
    if (!last) throw new ProviderFetchError(this.info.name, "데이터 없음");
    return last;
  }

  async getHistory(start: Date, end: Date): Promise<T[]> {
    const s = toIsoDate(start);
    const e = toIsoDate(end);
    return this.data().filter((r) => r.date >= s && r.date <= e);
  }
}

export function createMockProviders(failingSlots: readonly string[] = []): ProviderSet {
  const fails = (slot: ProviderSlot) => failingSlots.includes(slot);
  return {
    kospi: new MockProvider("kospi", "KOSPI 지수 (데모)", (d) => d.kospi, fails("kospi")),
    volatility: new MockProvider("volatility", "VKOSPI (데모)", (d) => d.volatility, fails("volatility")),
    breadth: new MockProvider("breadth", "상승·하락 종목 수 (데모)", (d) => d.breadth, fails("breadth")),
    foreignFlow: new MockProvider("foreignFlow", "외국인 순매수 (데모)", (d) => d.foreignFlow, fails("foreignFlow")),
    marketStrength: new MockProvider(
      "marketStrength",
      "52주 신고가·신저가 (데모)",
      (d) => d.marketStrength,
      fails("marketStrength"),
    ),
    putCall: new MockProvider("putCall", "KOSPI200 옵션 Put/Call (데모)", (d) => d.putCall, fails("putCall")),
    riskAppetite: new MockProvider(
      "riskAppetite",
      "KOSDAQ·규모별 지수 (데모)",
      (d) => d.riskAppetite,
      fails("riskAppetite"),
    ),
  };
}
