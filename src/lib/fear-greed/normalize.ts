/**
 * 과거 분포 기반 정규화 유틸리티.
 *
 * 모든 개별 지표는 "현재 값이 과거 lookback 기간 분포에서 몇 percentile인가"로
 * 0~100 점수화한다. 고정 임계값을 쓰지 않으므로 시장 레짐 변화에 강하다.
 */

/** 약 5년 (연 252 거래일 기준) */
export const DEFAULT_LOOKBACK = 252 * 5;
/** percentile 산출에 필요한 최소 표본 수. 미만이면 점수를 내지 않는다. */
export const MIN_SAMPLES = 60;
/** winsorization 기본 분위 (양쪽 1%) */
export const DEFAULT_WINSOR = 0.01;

export function quantile(sortedValues: readonly number[], q: number): number {
  if (sortedValues.length === 0) return NaN;
  const pos = (sortedValues.length - 1) * Math.min(1, Math.max(0, q));
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) return sortedValues[lo];
  return sortedValues[lo] + (sortedValues[hi] - sortedValues[lo]) * (pos - lo);
}

/** 값을 분포의 [q, 1-q] 분위 범위로 잘라낸다. */
export function winsorize(
  value: number,
  sortedValues: readonly number[],
  q: number = DEFAULT_WINSOR,
): number {
  if (sortedValues.length === 0 || q <= 0) return value;
  const lo = quantile(sortedValues, q);
  const hi = quantile(sortedValues, 1 - q);
  return Math.min(hi, Math.max(lo, value));
}

/**
 * Percentile rank (0~100).
 *
 * (현재 값보다 작은 표본 수 + 같은 표본 수 × 0.5) / 전체 표본 수 × 100
 *
 * 동일값 처리를 위해 mid-rank 방식을 사용한다.
 */
export function percentileRank(value: number, sample: readonly number[]): number {
  const valid = sample.filter((v) => Number.isFinite(v));
  if (valid.length === 0 || !Number.isFinite(value)) return NaN;
  let below = 0;
  let equal = 0;
  for (const v of valid) {
    if (v < value) below += 1;
    else if (v === value) equal += 1;
  }
  return ((below + equal * 0.5) / valid.length) * 100;
}

export interface RollingPercentileOptions {
  lookback?: number;
  minSamples?: number;
  winsor?: number;
  /** true면 100 - percentile (값이 클수록 공포인 지표) */
  invert?: boolean;
}

/**
 * 시계열 전체에 대해 rolling percentile 점수를 계산한다.
 *
 * i 시점 점수는 [i - lookback + 1, i] 구간(현재 값 포함)의 분포를 기준으로 하며
 * 미래 데이터를 참조하지 않는다 (look-ahead bias 없음).
 * 결측(null/NaN)은 표본에서 제외하며, 해당 시점 점수는 null.
 */
export function rollingPercentile(
  series: readonly (number | null)[],
  options: RollingPercentileOptions = {},
): (number | null)[] {
  const {
    lookback = DEFAULT_LOOKBACK,
    minSamples = MIN_SAMPLES,
    winsor = DEFAULT_WINSOR,
    invert = false,
  } = options;

  const isValid = (v: number | null): v is number =>
    v !== null && Number.isFinite(v);

  const out: (number | null)[] = new Array(series.length).fill(null);
  // 정렬 상태를 유지하는 슬라이딩 윈도우 (삽입/삭제 O(log n) 탐색 + splice)
  const window: number[] = [];
  for (let i = 0; i < series.length; i++) {
    const current = series[i];
    if (isValid(current)) window.splice(lowerBound(window, current), 0, current);

    const leaving = i - lookback >= 0 ? series[i - lookback] : null;
    if (isValid(leaving)) window.splice(lowerBound(window, leaving), 1);

    if (!isValid(current) || window.length < minSamples) continue;

    const clipped = winsorize(current, window, winsor);
    const below = lowerBound(window, clipped);
    const equal = upperBound(window, clipped) - below;
    const pct = ((below + equal * 0.5) / window.length) * 100;
    out[i] = invert ? 100 - pct : pct;
  }
  return out;
}

/** 정렬 배열에서 value 이상이 처음 나오는 위치 */
function lowerBound(sorted: readonly number[], value: number): number {
  let lo = 0;
  let hi = sorted.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (sorted[mid] < value) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/** 정렬 배열에서 value 초과가 처음 나오는 위치 */
function upperBound(sorted: readonly number[], value: number): number {
  let lo = 0;
  let hi = sorted.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (sorted[mid] <= value) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/** 여러 하위 점수의 가중 평균. null인 항목은 제외하고 가중치를 재정규화한다. */
export function combineScores(
  parts: readonly { score: number | null; weight: number }[],
): number | null {
  let total = 0;
  let wsum = 0;
  for (const p of parts) {
    if (p.score === null || !Number.isFinite(p.score)) continue;
    total += p.score * p.weight;
    wsum += p.weight;
  }
  return wsum > 0 ? total / wsum : null;
}

/* ---------------- 시계열 보조 함수 ---------------- */

export function movingAverage(
  values: readonly number[],
  window: number,
): (number | null)[] {
  const out: (number | null)[] = new Array(values.length).fill(null);
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= window) sum -= values[i - window];
    if (i >= window - 1) out[i] = sum / window;
  }
  return out;
}

export function rollingSum(
  values: readonly number[],
  window: number,
): (number | null)[] {
  const out: (number | null)[] = new Array(values.length).fill(null);
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= window) sum -= values[i - window];
    if (i >= window - 1) out[i] = sum;
  }
  return out;
}

/** 일간 로그수익률 기반 연율화 실현 변동성 (%) */
export function realizedVolatility(
  closes: readonly number[],
  window = 20,
): (number | null)[] {
  const rets: number[] = closes.map((c, i) =>
    i === 0 ? 0 : Math.log(c / closes[i - 1]),
  );
  const out: (number | null)[] = new Array(closes.length).fill(null);
  for (let i = window; i < closes.length; i++) {
    const slice = rets.slice(i - window + 1, i + 1);
    const mean = slice.reduce((a, b) => a + b, 0) / window;
    const variance =
      slice.reduce((a, b) => a + (b - mean) ** 2, 0) / (window - 1);
    out[i] = Math.sqrt(variance) * Math.sqrt(252) * 100;
  }
  return out;
}

export function pctChange(
  values: readonly number[],
  lag: number,
): (number | null)[] {
  return values.map((v, i) =>
    i >= lag && values[i - lag] !== 0 ? (v / values[i - lag] - 1) * 100 : null,
  );
}
