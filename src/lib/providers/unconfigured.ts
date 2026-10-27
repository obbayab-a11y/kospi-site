import type { DailyObservation } from "../fear-greed/types";
import { ProviderNotConfiguredError, type MarketDataProvider, type ProviderInfo } from "./types";

/**
 * 실제 데이터 소스가 아직 연결되지 않은 슬롯용 Provider.
 * 항상 ProviderNotConfiguredError를 던지며, 상위 서비스는 해당 Factor를 제외하고
 * 가중치를 재분배한다.
 */
export class UnconfiguredProvider<T extends DailyObservation> implements MarketDataProvider<T> {
  readonly info: ProviderInfo;

  constructor(id: string, name: string, private readonly hint: string) {
    this.info = {
      id,
      name,
      kind: "unconfigured",
      source: "연결된 데이터 소스 없음",
      note: `이 Provider에는 실제 데이터 소스 연결이 필요합니다. ${hint}`,
    };
  }

  async getCurrent(): Promise<T> {
    throw new ProviderNotConfiguredError(this.info.name, this.hint);
  }

  async getHistory(): Promise<T[]> {
    throw new ProviderNotConfiguredError(this.info.name, this.hint);
  }
}
