/**
 * 데모용 합성 시장 데이터 생성기.
 *
 * ⚠️ 실제 시장 데이터가 아닙니다. 사이트를 API 키 없이 실행·시연하기 위한
 *    결정론적(seeded) 시뮬레이션이며, 같은 날짜에는 항상 같은 값을 생성합니다.
 *
 * 모델 개요
 *  - 잠재 심리 변수 s(t): AR(1) 과정 + 간헐적 충격(shock) 국면
 *  - KOSPI 일간 수익률: 심리에 따라 drift·변동성이 바뀌는 확률과정
 *  - VKOSPI, 상승/하락 종목 수, 외국인 순매수, 신고가/신저가, Put/Call,
 *    KOSDAQ·소형주는 위 두 과정과 상관을 갖도록 생성
 */
import type {
  BreadthObservation,
  ForeignFlowObservation,
  IsoDate,
  KospiObservation,
  MarketStrengthObservation,
  PutCallObservation,
  RiskAppetiteObservation,
  VolatilityObservation,
} from "../../fear-greed/types";
import { lastCompletedTradingDay, tradingDaysBetween } from "../../utils/date";

export const MOCK_START_DATE: IsoDate = "2018-01-02";
const SEED = 20180102;
const TOTAL_STOCKS = 940;

export interface MockMarketData {
  kospi: KospiObservation[];
  volatility: VolatilityObservation[];
  breadth: BreadthObservation[];
  foreignFlow: ForeignFlowObservation[];
  marketStrength: MarketStrengthObservation[];
  putCall: PutCallObservation[];
  riskAppetite: RiskAppetiteObservation[];
}

/** mulberry32 — 작고 빠른 seeded PRNG */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gaussian(rand: () => number): number {
  let u = 0;
  while (u === 0) u = rand();
  const v = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));
const r2 = (v: number) => Math.round(v * 100) / 100;

const cache = new Map<IsoDate, MockMarketData>();

export function generateMockMarketData(endDate: IsoDate = lastCompletedTradingDay()): MockMarketData {
  const hit = cache.get(endDate);
  if (hit) return hit;

  const dates = tradingDaysBetween(MOCK_START_DATE, endDate);
  const rand = mulberry32(SEED);

  const out: MockMarketData = {
    kospi: [],
    volatility: [],
    breadth: [],
    foreignFlow: [],
    marketStrength: [],
    putCall: [],
    riskAppetite: [],
  };

  let sentiment = 0; // 잠재 심리 (−: 공포, +: 탐욕)
  let riskTilt = 0; // 코스닥/소형주 선호 (위험선호 잠재 변수)
  let shock = 0; // 급락 국면 강도
  let kospi = 2470;
  let kosdaq = 800;
  let small = 1900;
  let large = 2400;
  let vkospi = 14;
  let pcr = 0.95;
  const closes: number[] = [];

  for (const date of dates) {
    // 간헐적 충격 국면 (평균 1년에 1~2회)
    if (shock < 0.05 && rand() < 0.006) shock = 1 + rand() * 1.5;
    shock *= 0.93;

    sentiment = 0.975 * sentiment + 0.16 * gaussian(rand) - 0.05 * shock;
    sentiment = clamp(sentiment, -3, 3);
    riskTilt = 0.97 * riskTilt + 0.15 * gaussian(rand) + 0.02 * sentiment;

    const dailyVol = 0.0085 * Math.exp(-0.18 * sentiment) * (1 + 0.9 * shock);
    const ret = 0.0006 + 0.0011 * sentiment - 0.0025 * shock + dailyVol * gaussian(rand);
    kospi *= 1 + ret;
    closes.push(kospi);

    const kqRet = 1.15 * ret + 0.0016 * riskTilt + 0.004 * gaussian(rand);
    kosdaq *= 1 + kqRet;
    const smallRet = 1.05 * ret + 0.0011 * riskTilt + 0.003 * gaussian(rand);
    const largeRet = 0.98 * ret + 0.002 * gaussian(rand);
    small *= 1 + smallRet;
    large *= 1 + largeRet;

    // VKOSPI: 실현 변동성을 따라가며 평균회귀
    const vkTarget = dailyVol * Math.sqrt(252) * 100 * 1.15 + 2;
    vkospi = vkospi + 0.25 * (vkTarget - vkospi) + 0.6 * gaussian(rand) + (ret < -0.015 ? 2.2 : 0);
    vkospi = clamp(vkospi, 9, 75);

    // 시장 폭
    const advShare = clamp(sigmoid((ret / dailyVol) * 1.25 + 0.25 * sentiment + 0.15 * gaussian(rand)), 0.03, 0.97);
    const unchanged = Math.round(TOTAL_STOCKS * (0.04 + 0.02 * rand()));
    const moving = TOTAL_STOCKS - unchanged;
    const advancing = Math.round(moving * advShare);

    // 외국인 순매수 (억원)
    const foreign = 1400 * sentiment + 2600 * (ret / 0.01) - 1800 * shock + 2600 * gaussian(rand);

    // 52주 신고가/신저가 — 지수의 52주 범위 내 위치에 따라
    const window = closes.slice(-250);
    const hi = Math.max(...window);
    const lo = Math.min(...window);
    const pos = hi === lo ? 0.5 : (kospi - lo) / (hi - lo);
    const newHighs = Math.max(0, Math.round(90 * pos ** 3 + 6 * sentiment + 4 * gaussian(rand)));
    const newLows = Math.max(0, Math.round(90 * (1 - pos) ** 3 - 6 * sentiment + 4 * gaussian(rand) + 25 * shock));

    // Put/Call
    pcr = 0.6 * pcr + 0.4 * (0.95 - 0.09 * sentiment + 0.25 * shock) + 0.05 * gaussian(rand);
    pcr = clamp(pcr, 0.45, 2.2);

    out.kospi.push({ date, close: r2(kospi) });
    out.volatility.push({ date, vkospi: r2(vkospi) });
    out.breadth.push({ date, advancing, declining: moving - advancing, unchanged });
    out.foreignFlow.push({ date, netBuy: Math.round(foreign) });
    out.marketStrength.push({ date, newHighs, newLows });
    out.putCall.push({ date, ratio: r2(pcr) });
    out.riskAppetite.push({
      date,
      kosdaqClose: r2(kosdaq),
      smallCapClose: r2(small),
      largeCapClose: r2(large),
    });
  }

  cache.clear();
  cache.set(endDate, out);
  return out;
}
