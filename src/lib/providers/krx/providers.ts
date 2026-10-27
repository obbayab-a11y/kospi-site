/**
 * KRX Open API 기반 Live Provider 구현.
 *
 * ⚠️ 응답 필드명은 KRX Open API 서비스 명세(OutBlock_1)를 따르지만,
 *    지수명(IDX_NM)·권리유형(RGHT_TP_NM) 같은 "값"의 표기는 실제 응답으로
 *    한 번 검증한 뒤 아래 상수를 조정해야 한다. (README "실제 데이터 연결" 참고)
 */
import { subDays } from "date-fns";
import type {
  BreadthObservation,
  DailyObservation,
  IsoDate,
  KospiObservation,
  MarketStrengthObservation,
  PutCallObservation,
  RiskAppetiteObservation,
  VolatilityObservation,
} from "../../fear-greed/types";
import { toIsoDate, tradingDaysBetween } from "../../utils/date";
import { ProviderFetchError, type MarketDataProvider, type ProviderInfo } from "../types";
import { KRX_ENDPOINTS, parseKrxNumber, type KrxClient, type KrxEndpoint, type KrxRow } from "./client";

const KRX_SOURCE = "한국거래소(KRX) Open API";
const KRX_URL = "https://openapi.krx.co.kr";

/** IDX_NM 매칭용 지수명 (공백 무시 비교) */
export const KRX_INDEX_NAMES = {
  kospi: "코스피",
  kospiLarge: "코스피 대형주",
  kospiSmall: "코스피 소형주",
  kosdaq: "코스닥",
  vkospi: "코스피 200 변동성지수",
} as const;

const norm = (s: string | undefined) => (s ?? "").replace(/\s+/g, "");

function findIndexClose(rows: KrxRow[], name: string): number {
  const row = rows.find((r) => norm(r.IDX_NM) === norm(name));
  return row ? parseKrxNumber(row.CLSPRC_IDX) : NaN;
}

/**
 * 하나 이상의 KRX 엔드포인트를 날짜별로 조회해 관측치로 변환하는 공통 베이스.
 */
abstract class KrxDailyProvider<T extends DailyObservation> implements MarketDataProvider<T> {
  abstract readonly info: ProviderInfo;
  protected abstract readonly endpoints: readonly KrxEndpoint[];

  constructor(protected readonly client: KrxClient) {}

  /** 날짜별 응답 → 관측치. 필요한 값이 없으면 null */
  protected abstract extract(date: IsoDate, rows: Record<string, KrxRow[]>): T | null;

  protected async load(start: IsoDate, end: IsoDate): Promise<T[]> {
    const dates = tradingDaysBetween(start, end);
    try {
      const maps = await Promise.all(this.endpoints.map((ep) => this.client.fetchRange(ep, dates)));
      const out: T[] = [];
      for (const date of dates) {
        const rows: Record<string, KrxRow[]> = {};
        let complete = true;
        this.endpoints.forEach((ep, i) => {
          const r = maps[i].get(date);
          if (r) rows[ep] = r;
          else complete = false;
        });
        if (!complete) continue; // 휴장일 또는 결측
        const obs = this.extract(date, rows);
        if (obs) out.push(obs);
      }
      return out;
    } catch (err) {
      throw new ProviderFetchError(this.info.name, err);
    }
  }

  async getHistory(start: Date, end: Date): Promise<T[]> {
    return this.load(toIsoDate(start), toIsoDate(end));
  }

  async getCurrent(): Promise<T> {
    const end = new Date();
    const rows = await this.load(toIsoDate(subDays(end, 10)), toIsoDate(end));
    const last = rows.at(-1);
    if (!last) throw new ProviderFetchError(this.info.name, "최근 10일 데이터 없음");
    return last;
  }
}

export class KrxKospiProvider extends KrxDailyProvider<KospiObservation> {
  readonly info: ProviderInfo = {
    id: "krx-kospi",
    name: "KOSPI 지수",
    kind: "live",
    source: `${KRX_SOURCE} · KOSPI 시리즈 일별시세 (idx/kospi_dd_trd)`,
    sourceUrl: KRX_URL,
  };
  protected readonly endpoints = [KRX_ENDPOINTS.kospiIndex];

  protected extract(date: IsoDate, rows: Record<string, KrxRow[]>) {
    const close = findIndexClose(rows[KRX_ENDPOINTS.kospiIndex], KRX_INDEX_NAMES.kospi);
    return Number.isFinite(close) ? { date, close } : null;
  }
}

export class KrxVolatilityProvider extends KrxDailyProvider<VolatilityObservation> {
  readonly info: ProviderInfo = {
    id: "krx-vkospi",
    name: "VKOSPI (코스피 200 변동성지수)",
    kind: "live",
    source: `${KRX_SOURCE} · 파생상품지수 일별시세 (idx/drvprod_dd_trd)`,
    sourceUrl: KRX_URL,
  };
  protected readonly endpoints = [KRX_ENDPOINTS.derivativeIndex];

  protected extract(date: IsoDate, rows: Record<string, KrxRow[]>) {
    const list = rows[KRX_ENDPOINTS.derivativeIndex];
    let v = findIndexClose(list, KRX_INDEX_NAMES.vkospi);
    if (!Number.isFinite(v)) {
      // 표기 차이 대비: "변동성" + "200"을 포함하는 지수명
      const row = list.find((r) => /변동성/.test(r.IDX_NM ?? "") && /200/.test(r.IDX_NM ?? ""));
      v = row ? parseKrxNumber(row.CLSPRC_IDX) : NaN;
    }
    return Number.isFinite(v) ? { date, vkospi: v } : null;
  }
}

export class KrxBreadthProvider extends KrxDailyProvider<BreadthObservation> {
  readonly info: ProviderInfo = {
    id: "krx-breadth",
    name: "KOSPI 상승·하락 종목 수",
    kind: "live",
    source: `${KRX_SOURCE} · 유가증권 일별매매정보 (sto/stk_bydd_trd) 등락률 집계`,
    sourceUrl: KRX_URL,
  };
  protected readonly endpoints = [KRX_ENDPOINTS.kospiStocks];

  protected extract(date: IsoDate, rows: Record<string, KrxRow[]>) {
    let advancing = 0;
    let declining = 0;
    let unchanged = 0;
    for (const r of rows[KRX_ENDPOINTS.kospiStocks]) {
      const chg = parseKrxNumber(r.FLUC_RT);
      if (!Number.isFinite(chg)) continue;
      if (chg > 0) advancing += 1;
      else if (chg < 0) declining += 1;
      else unchanged += 1;
    }
    return advancing + declining > 0 ? { date, advancing, declining, unchanged } : null;
  }
}

export class KrxRiskAppetiteProvider extends KrxDailyProvider<RiskAppetiteObservation> {
  readonly info: ProviderInfo = {
    id: "krx-risk-appetite",
    name: "KOSDAQ · 코스피 대형주/소형주 지수",
    kind: "live",
    source: `${KRX_SOURCE} · KOSDAQ/KOSPI 시리즈 일별시세`,
    sourceUrl: KRX_URL,
  };
  protected readonly endpoints = [KRX_ENDPOINTS.kosdaqIndex, KRX_ENDPOINTS.kospiIndex];

  protected extract(date: IsoDate, rows: Record<string, KrxRow[]>) {
    const kosdaqClose = findIndexClose(rows[KRX_ENDPOINTS.kosdaqIndex], KRX_INDEX_NAMES.kosdaq);
    if (!Number.isFinite(kosdaqClose)) return null;
    const small = findIndexClose(rows[KRX_ENDPOINTS.kospiIndex], KRX_INDEX_NAMES.kospiSmall);
    const large = findIndexClose(rows[KRX_ENDPOINTS.kospiIndex], KRX_INDEX_NAMES.kospiLarge);
    return {
      date,
      kosdaqClose,
      smallCapClose: Number.isFinite(small) ? small : undefined,
      largeCapClose: Number.isFinite(large) ? large : undefined,
    };
  }
}

export class KrxPutCallProvider extends KrxDailyProvider<PutCallObservation> {
  readonly info: ProviderInfo = {
    id: "krx-put-call",
    name: "KOSPI200 옵션 Put/Call 거래량 비율",
    kind: "live",
    source: `${KRX_SOURCE} · 옵션 일별매매정보 (drv/opt_bydd_trd) 거래량 집계`,
    sourceUrl: KRX_URL,
    note: "상품명·권리유형 표기는 실제 응답으로 검증 필요",
  };
  protected readonly endpoints = [KRX_ENDPOINTS.options];

  protected extract(date: IsoDate, rows: Record<string, KrxRow[]>) {
    let puts = 0;
    let calls = 0;
    for (const r of rows[KRX_ENDPOINTS.options]) {
      const product = r.PROD_NM ?? "";
      if (!/코스피\s?200|KOSPI\s?200/i.test(product) || /미니|mini/i.test(product)) continue;
      const vol = parseKrxNumber(r.ACC_TRDVOL);
      if (!Number.isFinite(vol)) continue;
      const right = (r.RGHT_TP_NM ?? "").trim();
      if (/^(풋|PUT|P)$/i.test(right)) puts += vol;
      else if (/^(콜|CALL|C)$/i.test(right)) calls += vol;
    }
    return calls > 0 ? { date, ratio: puts / calls } : null;
  }
}

/**
 * 52주 신고가/신저가 종목 수.
 * KRX는 신고가 집계를 직접 제공하지 않으므로 종목별 일별 고가/저가로 직접 계산한다.
 * 52주(≈250거래일) 창을 채우기 위해 요청 시작일보다 약 1년 앞부터 조회한다.
 */
export class KrxMarketStrengthProvider extends KrxDailyProvider<MarketStrengthObservation> {
  readonly info: ProviderInfo = {
    id: "krx-market-strength",
    name: "52주 신고가·신저가 종목 수",
    kind: "live",
    source: `${KRX_SOURCE} · 유가증권 일별매매정보 (sto/stk_bydd_trd) 종목별 고가/저가 집계`,
    sourceUrl: KRX_URL,
  };
  protected readonly endpoints = [KRX_ENDPOINTS.kospiStocks];
  private static readonly WINDOW = 250;

  protected extract(): MarketStrengthObservation | null {
    return null; // load()를 재정의하므로 사용하지 않음
  }

  protected async load(start: IsoDate, end: IsoDate): Promise<MarketStrengthObservation[]> {
    const warmStart = toIsoDate(subDays(new Date(`${start}T00:00:00+09:00`), 380));
    const dates = tradingDaysBetween(warmStart, end);
    let byDate: Map<IsoDate, KrxRow[]>;
    try {
      byDate = await this.client.fetchRange(KRX_ENDPOINTS.kospiStocks, dates);
    } catch (err) {
      throw new ProviderFetchError(this.info.name, err);
    }

    // 종목별 과거 고가/저가 이력
    const highs = new Map<string, number[]>();
    const lows = new Map<string, number[]>();
    const out: MarketStrengthObservation[] = [];
    const W = KrxMarketStrengthProvider.WINDOW;

    for (const [date, rows] of byDate) {
      let newHighs = 0;
      let newLows = 0;
      for (const r of rows) {
        const code = r.ISU_CD;
        const hi = parseKrxNumber(r.TDD_HGPRC);
        const lo = parseKrxNumber(r.TDD_LWPRC);
        if (!code || !Number.isFinite(hi) || !Number.isFinite(lo) || hi <= 0) continue;
        const h = highs.get(code) ?? [];
        const l = lows.get(code) ?? [];
        if (h.length >= W - 1) {
          if (hi > Math.max(...h)) newHighs += 1;
          if (lo < Math.min(...l)) newLows += 1;
        }
        h.push(hi);
        l.push(lo);
        if (h.length > W - 1) h.shift();
        if (l.length > W - 1) l.shift();
        highs.set(code, h);
        lows.set(code, l);
      }
      if (date >= start) out.push({ date, newHighs, newLows });
    }
    return out;
  }
}
