/**
 * 서버 → 클라이언트 컴포넌트로 넘기는 직렬화 가능한 뷰 모델.
 * 큰 rawData 대신 화면에 필요한 값만 추려 전송량을 줄인다.
 */
import { FACTOR_META, FACTOR_ORDER } from "../fear-greed/factor-meta";
import { classify } from "../fear-greed/classify";
import { filterByPeriod } from "../fear-greed/analytics";
import {
  getFactorScore,
  type Classification,
  type FactorKey,
  type FearGreedDaily,
} from "../fear-greed/types";
import {
  formatKrwEok,
  formatNumber,
  formatSignedPct,
  formatInt,
} from "../utils/format";

/* ---------------- 차트 ---------------- */

export interface ChartPoint {
  /** yyyy-MM-dd */
  d: string;
  /** 공포·탐욕 점수 */
  s: number;
  /** KOSPI 종가 */
  k: number;
}

export function toChartPoints(series: readonly FearGreedDaily[]): ChartPoint[] {
  return series.map((x) => ({ d: x.date, s: x.score, k: x.kospiClose }));
}

/* ---------------- 히트맵 ---------------- */

export interface HeatmapDay {
  d: string;
  s: number;
  k: number;
  /** FACTOR_ORDER 순서의 Factor 점수 */
  f: (number | null)[];
}

export function toHeatmapDays(series: readonly FearGreedDaily[]): HeatmapDay[] {
  return filterByPeriod(series, "1y").map((x) => ({
    d: x.date,
    s: x.score,
    k: x.kospiClose,
    f: FACTOR_ORDER.map((key) => getFactorScore(x, key)),
  }));
}

/* ---------------- Factor 카드 ---------------- */

export interface DataLine {
  label: string;
  value: string;
}

export interface FactorCardModel {
  key: FactorKey;
  label: string;
  summary: string;
  score: number | null;
  classification: Classification | null;
  /** 기본 가중치 */
  baseWeight: number;
  /** 결측 재분배 후 실제 가중치 */
  appliedWeight: number | null;
  /** 1주(5거래일) 전 대비 점수 변화 */
  change5d: number | null;
  lines: DataLine[];
  method: string[];
  fallback: string;
  greedMeaning: string;
  fearMeaning: string;
  available: boolean;
}

export function factorDataLines(day: FearGreedDaily, key: FactorKey): DataLine[] {
  const r = day.rawData;
  switch (key) {
    case "momentum": {
      const m = r.momentum;
      if (!m) return [];
      return [
        { label: "KOSPI", value: formatNumber(m.close, 2) },
        { label: "20일선 대비", value: formatSignedPct(m.gap20) },
        { label: "60일선 대비", value: formatSignedPct(m.gap60) },
        { label: "120일선 대비", value: formatSignedPct(m.gap120) },
      ];
    }
    case "volatility": {
      const v = r.volatility;
      if (!v) return [];
      return [
        { label: v.source === "vkospi" ? "VKOSPI" : "20일 실현 변동성", value: formatNumber(v.value, 2) },
        {
          label: "1개월 변화",
          value: v.change20d === null ? "–" : `${v.change20d > 0 ? "+" : ""}${formatNumber(v.change20d, 2)}p`,
        },
      ];
    }
    case "breadth": {
      const b = r.breadth;
      if (!b) return [];
      return [
        { label: "상승 / 하락", value: `${formatInt(b.advancing)} / ${formatInt(b.declining)}` },
        { label: "당일 상승 비율", value: `${formatNumber(b.ratio, 1)}%` },
        { label: "20일 평균", value: `${formatNumber(b.ratioMa20, 1)}%` },
      ];
    }
    case "foreignFlow": {
      const f = r.foreignFlow;
      if (!f) return [];
      return [
        { label: "1일", value: formatKrwEok(f.net1d, true) },
        { label: "5일 누적", value: formatKrwEok(f.net5d, true) },
        { label: "20일 누적", value: formatKrwEok(f.net20d, true) },
      ];
    }
    case "marketStrength": {
      const s = r.marketStrength;
      if (!s) return [];
      if (s.source === "highs-lows") {
        return [
          { label: "52주 신고가", value: `${formatInt(s.newHighs ?? 0)}종목` },
          { label: "52주 신저가", value: `${formatInt(s.newLows ?? 0)}종목` },
          { label: "신고가 비중(10일)", value: `${formatNumber(s.highRatio ?? 0, 1)}%` },
        ];
      }
      return [
        { label: "20일 수익률 중앙값", value: formatSignedPct(s.medianReturn20d ?? 0) },
        { label: "60일 수익률 중앙값", value: formatSignedPct(s.medianReturn60d ?? 0) },
      ];
    }
    case "putCall": {
      const p = r.putCall;
      if (!p) return [];
      return [
        { label: "Put/Call 비율", value: formatNumber(p.ratio, 2) },
        { label: "5일 평균", value: formatNumber(p.ratioMa5, 2) },
      ];
    }
    case "riskAppetite": {
      const a = r.riskAppetite;
      if (!a) return [];
      const lines = [
        { label: "코스닥/코스피 상대강도", value: formatSignedPct(a.kosdaqRelative20d) },
        { label: "코스닥 20일 수익률", value: formatSignedPct(a.kosdaqReturn20d) },
      ];
      if (a.smallLargeRelative20d !== undefined)
        lines.push({ label: "소형/대형 상대강도", value: formatSignedPct(a.smallLargeRelative20d) });
      return lines;
    }
  }
}

export function toFactorCards(series: readonly FearGreedDaily[]): FactorCardModel[] {
  const latest = series.at(-1);
  if (!latest) return [];
  const prev = series.length > 5 ? series[series.length - 6] : null;

  return FACTOR_ORDER.map((key) => {
    const meta = FACTOR_META[key];
    const score = getFactorScore(latest, key);
    const prevScore = prev ? getFactorScore(prev, key) : null;
    return {
      key,
      label: meta.label,
      summary: meta.summary,
      score: score === null ? null : Math.round(score),
      classification: score === null ? null : classify(score),
      baseWeight: meta.weight,
      appliedWeight: latest.appliedWeights[key] ?? null,
      change5d: score !== null && prevScore !== null ? Math.round(score - prevScore) : null,
      lines: factorDataLines(latest, key),
      method: meta.method,
      fallback: meta.fallback,
      greedMeaning: meta.greedMeaning,
      fearMeaning: meta.fearMeaning,
      available: score !== null,
    };
  });
}
