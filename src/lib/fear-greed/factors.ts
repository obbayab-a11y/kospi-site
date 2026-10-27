/**
 * 7개 Factor의 일별 원천 수치와 0~100 점수 시계열을 계산한다.
 *
 * 모든 시계열은 KOSPI 거래일(dataset.kospi) 기준으로 정렬·정렬(align)된다.
 * 각 Factor는 독립적으로 계산되므로 한 Factor의 데이터가 없어도
 * 나머지 Factor 계산에는 영향을 주지 않는다.
 */
import {
  DEFAULT_LOOKBACK,
  MIN_SAMPLES,
  combineScores,
  movingAverage,
  realizedVolatility,
  rollingPercentile,
} from "./normalize";
import type {
  BreadthRaw,
  DailyObservation,
  FactorKey,
  ForeignFlowRaw,
  IsoDate,
  MarketDataset,
  MarketStrengthRaw,
  MomentumRaw,
  PutCallRaw,
  RiskAppetiteRaw,
  VolatilityRaw,
} from "./types";

export interface FactorSeries<R> {
  key: FactorKey;
  scores: (number | null)[];
  raws: (R | null)[];
}

export interface FactorEngineOptions {
  lookback?: number;
  minSamples?: number;
}

type Num = number | null;

/* ------------------------------------------------------------------ */
/* 공통 유틸                                                           */
/* ------------------------------------------------------------------ */

export function alignToDates<T extends DailyObservation, V>(
  dates: readonly IsoDate[],
  observations: readonly T[] | null,
  pick: (o: T) => V | undefined,
): (V | null)[] {
  if (!observations) return dates.map(() => null);
  const map = new Map<IsoDate, T>();
  for (const o of observations) map.set(o.date, o);
  return dates.map((d) => {
    const o = map.get(d);
    if (!o) return null;
    const v = pick(o);
    return v === undefined ? null : v;
  });
}

/** 결측을 허용하는 이동평균. 창 안의 유효값이 minCount 미만이면 null. */
export function rollingMeanNullable(
  values: readonly Num[],
  window: number,
  minCount = Math.ceil(window * 0.75),
): Num[] {
  return values.map((_, i) => {
    if (i < window - 1) return null;
    let sum = 0;
    let n = 0;
    for (let j = i - window + 1; j <= i; j++) {
      const v = values[j];
      if (v !== null && Number.isFinite(v)) {
        sum += v;
        n += 1;
      }
    }
    return n >= minCount ? sum / n : null;
  });
}

/** 결측을 0이 아닌 null로 전파하는 rolling 합계 (창 전체가 유효해야 함) */
export function rollingSumStrict(values: readonly Num[], window: number): Num[] {
  return values.map((_, i) => {
    if (i < window - 1) return null;
    let sum = 0;
    for (let j = i - window + 1; j <= i; j++) {
      const v = values[j];
      if (v === null || !Number.isFinite(v)) return null;
      sum += v;
    }
    return sum;
  });
}

function countValid(values: readonly Num[]): number {
  return values.reduce<number>(
    (n, v) => (v !== null && Number.isFinite(v) ? n + 1 : n),
    0,
  );
}

const round2 = (v: number) => Math.round(v * 100) / 100;

/* ------------------------------------------------------------------ */
/* 1. 시장 모멘텀 (20%)                                                 */
/* ------------------------------------------------------------------ */

export function computeMomentum(
  closes: readonly number[],
  opts: FactorEngineOptions = {},
): FactorSeries<MomentumRaw> {
  const ma20 = movingAverage(closes, 20);
  const ma60 = movingAverage(closes, 60);
  const ma120 = movingAverage(closes, 120);
  const gap = (ma: Num[]) =>
    closes.map((c, i) => {
      const m = ma[i];
      return m ? (c / m - 1) * 100 : null;
    });
  const gap20 = gap(ma20);
  const gap60 = gap(ma60);
  const gap120 = gap(ma120);

  const p20 = rollingPercentile(gap20, opts);
  const p60 = rollingPercentile(gap60, opts);
  const p120 = rollingPercentile(gap120, opts);

  const scores = closes.map((_, i) =>
    combineScores([
      { score: p20[i], weight: 1 },
      { score: p60[i], weight: 1 },
      { score: p120[i], weight: 1 },
    ]),
  );
  const raws = closes.map((c, i): MomentumRaw | null => {
    const [m20, m60, m120] = [ma20[i], ma60[i], ma120[i]];
    if (m20 === null || m60 === null || m120 === null) return null;
    return {
      close: c,
      ma20: round2(m20),
      ma60: round2(m60),
      ma120: round2(m120),
      gap20: round2(gap20[i] ?? 0),
      gap60: round2(gap60[i] ?? 0),
      gap120: round2(gap120[i] ?? 0),
    };
  });
  return { key: "momentum", scores, raws };
}

/* ------------------------------------------------------------------ */
/* 2. 변동성 (20%) — VKOSPI 역 percentile, 없으면 실현 변동성             */
/* ------------------------------------------------------------------ */

export function computeVolatility(
  dates: readonly IsoDate[],
  closes: readonly number[],
  dataset: MarketDataset,
  opts: FactorEngineOptions = {},
): FactorSeries<VolatilityRaw> {
  const minSamples = opts.minSamples ?? MIN_SAMPLES;
  const vkospi = alignToDates(dates, dataset.volatility, (o) => o.vkospi);
  const useVkospi = countValid(vkospi) >= minSamples;
  const source: VolatilityRaw["source"] = useVkospi ? "vkospi" : "realized";
  const values: Num[] = useVkospi ? vkospi : realizedVolatility(closes, 20);

  const scores = rollingPercentile(values, { ...opts, invert: true });
  const raws = values.map((v, i): VolatilityRaw | null => {
    if (v === null) return null;
    const prev = i >= 20 ? values[i - 20] : null;
    return {
      source,
      value: round2(v),
      change20d: prev === null ? null : round2(v - prev),
    };
  });
  return { key: "volatility", scores, raws };
}

/* ------------------------------------------------------------------ */
/* 3. 시장 폭 (20%) — 상승 종목 비율                                     */
/* ------------------------------------------------------------------ */

export function computeBreadth(
  dates: readonly IsoDate[],
  dataset: MarketDataset,
  opts: FactorEngineOptions = {},
): FactorSeries<BreadthRaw> {
  const adv = alignToDates(dates, dataset.breadth, (o) => o.advancing);
  const dec = alignToDates(dates, dataset.breadth, (o) => o.declining);
  const ratio: Num[] = dates.map((_, i) => {
    const a = adv[i];
    const d = dec[i];
    if (a === null || d === null || a + d === 0) return null;
    return (a / (a + d)) * 100;
  });
  const ma20 = rollingMeanNullable(ratio, 20);
  const ma5 = rollingMeanNullable(ratio, 5, 4);

  const p20 = rollingPercentile(ma20, opts);
  const p5 = rollingPercentile(ma5, opts);
  const scores = dates.map((_, i) =>
    combineScores([
      { score: p20[i], weight: 0.7 },
      { score: p5[i], weight: 0.3 },
    ]),
  );
  const raws = dates.map((_, i): BreadthRaw | null => {
    const r = ratio[i];
    const m = ma20[i];
    if (r === null || m === null) return null;
    return {
      advancing: adv[i] ?? 0,
      declining: dec[i] ?? 0,
      ratio: round2(r),
      ratioMa20: round2(m),
    };
  });
  return { key: "breadth", scores, raws };
}

/* ------------------------------------------------------------------ */
/* 4. 외국인 수급 (15%) — 1/5/20일 누적 순매수                            */
/* ------------------------------------------------------------------ */

export function computeForeignFlow(
  dates: readonly IsoDate[],
  dataset: MarketDataset,
  opts: FactorEngineOptions = {},
): FactorSeries<ForeignFlowRaw> {
  const net = alignToDates(dates, dataset.foreignFlow, (o) => o.netBuy);
  const s5 = rollingSumStrict(net, 5);
  const s20 = rollingSumStrict(net, 20);

  const p1 = rollingPercentile(net, opts);
  const p5 = rollingPercentile(s5, opts);
  const p20 = rollingPercentile(s20, opts);
  const scores = dates.map((_, i) =>
    combineScores([
      { score: p1[i], weight: 0.2 },
      { score: p5[i], weight: 0.3 },
      { score: p20[i], weight: 0.5 },
    ]),
  );
  const raws = dates.map((_, i): ForeignFlowRaw | null => {
    const [a, b, c] = [net[i], s5[i], s20[i]];
    if (a === null || b === null || c === null) return null;
    return { net1d: Math.round(a), net5d: Math.round(b), net20d: Math.round(c) };
  });
  return { key: "foreignFlow", scores, raws };
}

/* ------------------------------------------------------------------ */
/* 5. 시장 강도 (10%) — 52주 신고가/신저가, 대체: 수익률 분포              */
/* ------------------------------------------------------------------ */

export function computeMarketStrength(
  dates: readonly IsoDate[],
  dataset: MarketDataset,
  opts: FactorEngineOptions = {},
): FactorSeries<MarketStrengthRaw> {
  const minSamples = opts.minSamples ?? MIN_SAMPLES;
  const highs = alignToDates(dates, dataset.marketStrength, (o) => o.newHighs);
  const lows = alignToDates(dates, dataset.marketStrength, (o) => o.newLows);

  if (countValid(highs) >= minSamples && countValid(lows) >= minSamples) {
    // 일별 신고가/신저가 수는 0이 잦아 노이즈가 크므로 10일 합계로 평활한다.
    const h10 = rollingSumStrict(highs, 10);
    const l10 = rollingSumStrict(lows, 10);
    const ratio: Num[] = dates.map((_, i) => {
      const h = h10[i];
      const l = l10[i];
      if (h === null || l === null) return null;
      return h + l === 0 ? 50 : (h / (h + l)) * 100;
    });
    const scores = rollingPercentile(ratio, opts);
    const raws = dates.map((_, i): MarketStrengthRaw | null => {
      const r = ratio[i];
      if (r === null) return null;
      return {
        source: "highs-lows",
        newHighs: highs[i] ?? 0,
        newLows: lows[i] ?? 0,
        highRatio: round2(r),
      };
    });
    return { key: "marketStrength", scores, raws };
  }

  // 대체지표: 구성 종목 20일/60일 수익률 중앙값
  const r20 = alignToDates(dates, dataset.marketStrength, (o) => o.medianReturn20d);
  const r60 = alignToDates(dates, dataset.marketStrength, (o) => o.medianReturn60d);
  const p20 = rollingPercentile(r20, opts);
  const p60 = rollingPercentile(r60, opts);
  const scores = dates.map((_, i) =>
    combineScores([
      { score: p20[i], weight: 0.5 },
      { score: p60[i], weight: 0.5 },
    ]),
  );
  const raws = dates.map((_, i): MarketStrengthRaw | null => {
    if (r20[i] === null && r60[i] === null) return null;
    return {
      source: "return-distribution",
      medianReturn20d: r20[i] ?? undefined,
      medianReturn60d: r60[i] ?? undefined,
    };
  });
  return { key: "marketStrength", scores, raws };
}

/* ------------------------------------------------------------------ */
/* 6. Put/Call (10%) — 역 percentile                                    */
/* ------------------------------------------------------------------ */

export function computePutCall(
  dates: readonly IsoDate[],
  dataset: MarketDataset,
  opts: FactorEngineOptions = {},
): FactorSeries<PutCallRaw> {
  const ratio = alignToDates(dates, dataset.putCall, (o) => o.ratio);
  const ma5 = rollingMeanNullable(ratio, 5, 4);
  const scores = rollingPercentile(ma5, { ...opts, invert: true });
  const raws = dates.map((_, i): PutCallRaw | null => {
    const r = ratio[i];
    const m = ma5[i];
    if (r === null || m === null) return null;
    return { ratio: round2(r), ratioMa5: round2(m) };
  });
  return { key: "putCall", scores, raws };
}

/* ------------------------------------------------------------------ */
/* 7. 위험선호도 (5%)                                                   */
/* ------------------------------------------------------------------ */

export function computeRiskAppetite(
  dates: readonly IsoDate[],
  closes: readonly number[],
  dataset: MarketDataset,
  opts: FactorEngineOptions = {},
): FactorSeries<RiskAppetiteRaw> {
  const kosdaq = alignToDates(dates, dataset.riskAppetite, (o) => o.kosdaqClose);
  const small = alignToDates(dates, dataset.riskAppetite, (o) => o.smallCapClose);
  const large = alignToDates(dates, dataset.riskAppetite, (o) => o.largeCapClose);

  const lagChange = (series: Num[], lag: number): Num[] =>
    series.map((v, i) => {
      const p = i >= lag ? series[i - lag] : null;
      return v !== null && p !== null && p !== 0 ? (v / p - 1) * 100 : null;
    });

  const relKq: Num[] = kosdaq.map((k, i) => (k === null ? null : k / closes[i]));
  const relSl: Num[] = small.map((s, i) => {
    const l = large[i];
    return s === null || l === null || l === 0 ? null : s / l;
  });
  const relKq20 = lagChange(relKq, 20);
  const kqRet20 = lagChange(kosdaq, 20);
  const relSl20 = lagChange(relSl, 20);

  const pRel = rollingPercentile(relKq20, opts);
  const pRet = rollingPercentile(kqRet20, opts);
  const pSl = rollingPercentile(relSl20, opts);
  const scores = dates.map((_, i) =>
    combineScores([
      { score: pRel[i], weight: 0.5 },
      { score: pSl[i], weight: 0.25 },
      { score: pRet[i], weight: 0.25 },
    ]),
  );
  const raws = dates.map((_, i): RiskAppetiteRaw | null => {
    const a = relKq20[i];
    const b = kqRet20[i];
    if (a === null || b === null) return null;
    const c = relSl20[i];
    return {
      kosdaqRelative20d: round2(a),
      kosdaqReturn20d: round2(b),
      smallLargeRelative20d: c === null ? undefined : round2(c),
    };
  });
  return { key: "riskAppetite", scores, raws };
}

/* ------------------------------------------------------------------ */

export interface AllFactorSeries {
  momentum: FactorSeries<MomentumRaw>;
  volatility: FactorSeries<VolatilityRaw>;
  breadth: FactorSeries<BreadthRaw>;
  foreignFlow: FactorSeries<ForeignFlowRaw>;
  marketStrength: FactorSeries<MarketStrengthRaw>;
  putCall: FactorSeries<PutCallRaw>;
  riskAppetite: FactorSeries<RiskAppetiteRaw>;
}

export function computeAllFactors(
  dataset: MarketDataset,
  opts: FactorEngineOptions = {},
): AllFactorSeries {
  const o = { lookback: DEFAULT_LOOKBACK, minSamples: MIN_SAMPLES, ...opts };
  const dates = dataset.kospi.map((k) => k.date);
  const closes = dataset.kospi.map((k) => k.close);
  return {
    momentum: computeMomentum(closes, o),
    volatility: computeVolatility(dates, closes, dataset, o),
    breadth: computeBreadth(dates, dataset, o),
    foreignFlow: computeForeignFlow(dates, dataset, o),
    marketStrength: computeMarketStrength(dates, dataset, o),
    putCall: computePutCall(dates, dataset, o),
    riskAppetite: computeRiskAppetite(dates, closes, dataset, o),
  };
}
