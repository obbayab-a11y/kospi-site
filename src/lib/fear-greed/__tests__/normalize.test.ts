import { describe, expect, it } from "vitest";
import {
  combineScores,
  movingAverage,
  percentileRank,
  quantile,
  realizedVolatility,
  rollingPercentile,
  winsorize,
} from "../normalize";

describe("percentileRank", () => {
  const sample = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

  it("최솟값 미만은 0, 최댓값 초과는 100", () => {
    expect(percentileRank(0, sample)).toBe(0);
    expect(percentileRank(11, sample)).toBe(100);
  });

  it("mid-rank 방식으로 동일값을 절반만 센다", () => {
    // 3보다 작은 값 2개 + 같은 값 1개 × 0.5 = 2.5 / 10
    expect(percentileRank(3, sample)).toBeCloseTo(25);
    expect(percentileRank(5.5, sample)).toBeCloseTo(50);
  });

  it("모든 값이 같으면 50", () => {
    expect(percentileRank(7, [7, 7, 7, 7])).toBe(50);
  });

  it("빈 표본이나 NaN은 NaN", () => {
    expect(percentileRank(1, [])).toBeNaN();
    expect(percentileRank(Number.NaN, sample)).toBeNaN();
  });
});

describe("quantile / winsorize", () => {
  const sorted = Array.from({ length: 101 }, (_, i) => i); // 0..100

  it("선형 보간 분위수", () => {
    expect(quantile(sorted, 0.5)).toBe(50);
    expect(quantile(sorted, 0.01)).toBeCloseTo(1);
    expect(quantile([0, 10], 0.25)).toBeCloseTo(2.5);
  });

  it("극단값을 분위 범위로 잘라낸다", () => {
    expect(winsorize(1000, sorted, 0.01)).toBeCloseTo(99);
    expect(winsorize(-1000, sorted, 0.01)).toBeCloseTo(1);
    expect(winsorize(42, sorted, 0.01)).toBe(42);
  });
});

describe("rollingPercentile", () => {
  it("단조 증가 시계열은 항상 최고 percentile 근처", () => {
    const series = Array.from({ length: 200 }, (_, i) => i);
    const out = rollingPercentile(series, { lookback: 100, minSamples: 20, winsor: 0 });
    expect(out[10]).toBeNull(); // 표본 부족
    expect(out[150]).toBeCloseTo(99.5);
  });

  it("invert 옵션은 100 − percentile", () => {
    const series = Array.from({ length: 200 }, (_, i) => i);
    const a = rollingPercentile(series, { lookback: 100, minSamples: 20, winsor: 0 });
    const b = rollingPercentile(series, { lookback: 100, minSamples: 20, winsor: 0, invert: true });
    expect((a[150] ?? 0) + (b[150] ?? 0)).toBeCloseTo(100);
  });

  it("naive 구현과 결과가 같다 (결측 포함)", () => {
    let seed = 7;
    const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const series: (number | null)[] = Array.from({ length: 400 }, () =>
      rand() < 0.05 ? null : Math.round(rand() * 50),
    );
    const lookback = 120;
    const fast = rollingPercentile(series, { lookback, minSamples: 30, winsor: 0.01 });
    series.forEach((v, i) => {
      const window = series
        .slice(Math.max(0, i - lookback + 1), i + 1)
        .filter((x): x is number => x !== null)
        .sort((a, b) => a - b);
      if (v === null || window.length < 30) {
        expect(fast[i]).toBeNull();
        return;
      }
      expect(fast[i]).toBeCloseTo(percentileRank(winsorize(v, window, 0.01), window), 8);
    });
  });

  it("결과는 항상 0~100", () => {
    const series = Array.from({ length: 300 }, (_, i) => Math.sin(i / 7) * 100);
    for (const v of rollingPercentile(series, { lookback: 100, minSamples: 10 })) {
      if (v === null) continue;
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(100);
    }
  });
});

describe("시계열 보조 함수", () => {
  it("movingAverage", () => {
    expect(movingAverage([1, 2, 3, 4], 2)).toEqual([null, 1.5, 2.5, 3.5]);
  });

  it("realizedVolatility: 변동 없는 시계열은 0", () => {
    const out = realizedVolatility(Array(30).fill(100), 20);
    expect(out[25]).toBe(0);
  });

  it("combineScores: null 제외 후 재정규화", () => {
    expect(combineScores([{ score: 80, weight: 1 }, { score: null, weight: 3 }])).toBe(80);
    expect(combineScores([{ score: null, weight: 1 }])).toBeNull();
  });
});
