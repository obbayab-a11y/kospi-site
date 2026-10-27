/**
 * 지수 시계열 분석: 기간 비교, 역대 극단 구간, 기간 필터.
 */
import { subDays, subMonths, subYears, format, parseISO } from "date-fns";
import type { FearGreedDaily, IsoDate } from "./types";

/* ---------------- 기간 비교 ---------------- */

export interface ComparisonPoint {
  label: string;
  date: IsoDate;
  score: number;
  /** 현재 점수 − 비교 시점 점수 */
  delta: number;
}

/** 대상 날짜 이전(포함)의 가장 최근 데이터 */
export function findOnOrBefore(
  series: readonly FearGreedDaily[],
  date: IsoDate,
): FearGreedDaily | null {
  let lo = 0;
  let hi = series.length - 1;
  let found: FearGreedDaily | null = null;
  while (lo <= hi) {
    const mid = (lo + hi) >>> 1;
    if (series[mid].date <= date) {
      found = series[mid];
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return found;
}

export function getComparisons(series: readonly FearGreedDaily[]): ComparisonPoint[] {
  const latest = series.at(-1);
  if (!latest) return [];
  const base = parseISO(latest.date);
  const iso = (d: Date) => format(d, "yyyy-MM-dd");

  const targets: { label: string; point: FearGreedDaily | null }[] = [
    { label: "어제", point: series.length >= 2 ? series[series.length - 2] : null },
    { label: "1주 전", point: findOnOrBefore(series, iso(subDays(base, 7))) },
    { label: "1개월 전", point: findOnOrBefore(series, iso(subMonths(base, 1))) },
  ];
  return targets.flatMap(({ label, point }) =>
    point
      ? [{ label, date: point.date, score: point.score, delta: latest.score - point.score }]
      : [],
  );
}

/* ---------------- 기간 필터 ---------------- */

export const PERIODS = ["1m", "3m", "6m", "1y", "3y", "all"] as const;
export type Period = (typeof PERIODS)[number];

export const PERIOD_LABELS: Record<Period, string> = {
  "1m": "1개월",
  "3m": "3개월",
  "6m": "6개월",
  "1y": "1년",
  "3y": "3년",
  all: "전체",
};

export function periodStartDate(latest: IsoDate, period: Period): IsoDate | null {
  const base = parseISO(latest);
  const d = {
    "1m": () => subMonths(base, 1),
    "3m": () => subMonths(base, 3),
    "6m": () => subMonths(base, 6),
    "1y": () => subYears(base, 1),
    "3y": () => subYears(base, 3),
    all: () => null,
  }[period]();
  return d ? format(d, "yyyy-MM-dd") : null;
}

export function filterByPeriod<T extends { date: IsoDate }>(
  series: readonly T[],
  period: Period,
): T[] {
  const latest = series.at(-1);
  if (!latest) return [];
  const start = periodStartDate(latest.date, period);
  return start ? series.filter((d) => d.date > start) : [...series];
}

/* ---------------- 역대 극단 구간 ---------------- */

export interface ExtremeEntry {
  date: IsoDate;
  score: number;
  classification: FearGreedDaily["classification"];
  kospiClose: number;
  /** 이후 수익률 (%). 미래 데이터가 없으면 null */
  return1m: number | null;
  return3m: number | null;
  return6m: number | null;
}

/** 거래일 기준 1/3/6개월 */
export const FORWARD_DAYS = { "1m": 21, "3m": 63, "6m": 126 } as const;

function forwardReturn(
  series: readonly FearGreedDaily[],
  index: number,
  days: number,
): number | null {
  const future = series[index + days];
  if (!future) return null;
  const now = series[index].kospiClose;
  return Math.round((future.kospiClose / now - 1) * 1000) / 10;
}

/**
 * 극도의 공포/탐욕 Top N.
 *
 * 연속된 며칠이 한 국면에 몰려 표가 같은 시기로 도배되지 않도록
 * 선택된 날짜로부터 minGapDays(거래일) 이내의 날짜는 건너뛴다.
 */
export function findExtremes(
  series: readonly FearGreedDaily[],
  kind: "fear" | "greed",
  limit = 10,
  minGapDays = 20,
): ExtremeEntry[] {
  const indexed = series.map((d, i) => ({ d, i }));
  indexed.sort((a, b) =>
    kind === "fear" ? a.d.score - b.d.score || a.i - b.i : b.d.score - a.d.score || a.i - b.i,
  );

  const picked: number[] = [];
  for (const { i } of indexed) {
    if (picked.length >= limit) break;
    if (picked.some((p) => Math.abs(p - i) < minGapDays)) continue;
    picked.push(i);
  }

  return picked.map((i) => {
    const d = series[i];
    return {
      date: d.date,
      score: d.score,
      classification: d.classification,
      kospiClose: d.kospiClose,
      return1m: forwardReturn(series, i, FORWARD_DAYS["1m"]),
      return3m: forwardReturn(series, i, FORWARD_DAYS["3m"]),
      return6m: forwardReturn(series, i, FORWARD_DAYS["6m"]),
    };
  });
}

/* ---------------- 통계 ---------------- */

export function classificationDistribution(series: readonly FearGreedDaily[]) {
  const counts = new Map<FearGreedDaily["classification"], number>();
  for (const d of series) counts.set(d.classification, (counts.get(d.classification) ?? 0) + 1);
  return counts;
}

/* ---------------- 월별 요약 ---------------- */

export interface MonthlySummary {
  /** yyyy-MM */
  month: string;
  avg: number;
  min: number;
  max: number;
  /** 월말 점수 */
  close: number;
  kospiClose: number;
  /** 월간 KOSPI 수익률 (%) — 전월 말 대비 */
  kospiReturn: number | null;
  days: number;
}

export function monthlySummary(series: readonly FearGreedDaily[]): MonthlySummary[] {
  const groups = new Map<string, FearGreedDaily[]>();
  for (const d of series) {
    const key = d.date.slice(0, 7);
    const g = groups.get(key);
    if (g) g.push(d);
    else groups.set(key, [d]);
  }
  const out: MonthlySummary[] = [];
  let prevClose: number | null = null;
  for (const [month, days] of groups) {
    const scores = days.map((d) => d.score);
    const last = days[days.length - 1];
    out.push({
      month,
      avg: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
      min: Math.min(...scores),
      max: Math.max(...scores),
      close: last.score,
      kospiClose: last.kospiClose,
      kospiReturn: prevClose === null ? null : Math.round((last.kospiClose / prevClose - 1) * 1000) / 10,
      days: days.length,
    });
    prevClose = last.kospiClose;
  }
  return out;
}
