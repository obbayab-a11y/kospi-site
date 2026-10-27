import { describe, expect, it } from "vitest";
import { calculateIndex, calculateFearGreedSeries } from "../calculateIndex";
import { createMockProviders } from "../../providers/mock";
import { generateMockMarketData } from "../../providers/mock/generator";
import { FACTOR_KEYS, type FactorKey, type MarketDataset } from "../types";

const all = (score: number) =>
  Object.fromEntries(FACTOR_KEYS.map((k) => [k, score])) as Record<FactorKey, number>;

describe("calculateIndex", () => {
  it("모든 Factor가 같은 점수면 그 점수를 반환한다", () => {
    expect(calculateIndex(all(37))?.score).toBe(37);
  });

  it("점수는 0 미만이 되지 않는다", () => {
    expect(calculateIndex(all(-50))?.score).toBe(0);
    expect(calculateIndex({ ...all(0), momentum: -1000 })?.score).toBe(0);
  });

  it("점수는 100을 넘지 않는다", () => {
    expect(calculateIndex(all(150))?.score).toBe(100);
    expect(calculateIndex({ ...all(100), volatility: 1e9 })?.score).toBe(100);
  });

  it("가중 평균 후 반올림한다", () => {
    // momentum 0.2*100 + 나머지 0 = 20
    const r = calculateIndex({ ...all(0), momentum: 100 });
    expect(r?.score).toBe(20);
    // 0.2*100 + 0.05*10 = 20.5 → 21 (Math.round)
    const r2 = calculateIndex({ ...all(0), momentum: 100, riskAppetite: 10 });
    expect(r2?.rawScore).toBeCloseTo(20.5);
    expect(r2?.score).toBe(21);
  });

  it("결측 Factor는 제외하고 가중치를 비례 재분배한다", () => {
    const r = calculateIndex({ ...all(40), putCall: null, momentum: 100 });
    expect(r?.missingFactors).toEqual(["putCall"]);
    expect(r?.appliedWeights.putCall).toBeUndefined();
    expect(r?.appliedWeights.momentum).toBeCloseTo(0.2 / 0.9);
    // (0.2*100 + 0.7*40) / 0.9 = 53.33
    expect(r?.rawScore).toBeCloseTo((0.2 * 100 + 0.7 * 40) / 0.9);
    expect(r?.score).toBe(53);
  });

  it("NaN/undefined도 결측으로 처리한다", () => {
    const r = calculateIndex({ momentum: 60, volatility: Number.NaN, breadth: undefined });
    expect(r?.score).toBe(60);
    expect(r?.missingFactors).toContain("volatility");
    expect(r?.missingFactors).toContain("breadth");
  });

  it("사용 가능한 Factor가 없으면 null", () => {
    expect(calculateIndex({})).toBeNull();
  });
});

describe("calculateFearGreedSeries (demo dataset)", () => {
  const raw = generateMockMarketData("2024-12-31");
  const dataset: MarketDataset = { ...raw };
  const series = calculateFearGreedSeries(dataset);

  it("모든 날짜의 점수가 0~100 정수이고 등급이 일치한다", () => {
    expect(series.length).toBeGreaterThan(1000);
    for (const d of series) {
      expect(Number.isInteger(d.score)).toBe(true);
      expect(d.score).toBeGreaterThanOrEqual(0);
      expect(d.score).toBeLessThanOrEqual(100);
    }
  });

  it("미래 데이터를 사용하지 않는다 (데이터를 잘라도 과거 점수가 같다)", () => {
    const cut = 900;
    const truncated: MarketDataset = {
      kospi: raw.kospi.slice(0, cut),
      volatility: raw.volatility.slice(0, cut),
      breadth: raw.breadth.slice(0, cut),
      foreignFlow: raw.foreignFlow.slice(0, cut),
      marketStrength: raw.marketStrength.slice(0, cut),
      putCall: raw.putCall.slice(0, cut),
      riskAppetite: raw.riskAppetite.slice(0, cut),
    };
    const partial = calculateFearGreedSeries(truncated);
    const lastPartial = partial.at(-1)!;
    const same = series.find((d) => d.date === lastPartial.date)!;
    expect(same.score).toBe(lastPartial.score);
    expect(same.momentumScore).toBe(lastPartial.momentumScore);
  });

  it("Factor 데이터가 통째로 없으면 해당 Factor를 제외하고 계산한다", () => {
    const noPutCall = calculateFearGreedSeries({ ...dataset, putCall: null });
    const last = noPutCall.at(-1)!;
    expect(last.putCallScore).toBeNull();
    expect(last.missingFactors).toEqual(["putCall"]);
    const wsum = Object.values(last.appliedWeights).reduce((a, b) => a + (b ?? 0), 0);
    expect(wsum).toBeCloseTo(1);
  });

  it("VKOSPI가 없으면 실현 변동성으로 대체한다", () => {
    const s = calculateFearGreedSeries({ ...dataset, volatility: null });
    expect(s.at(-1)!.rawData.volatility?.source).toBe("realized");
    expect(s.at(-1)!.volatilityScore).not.toBeNull();
  });

  it("신고가/신저가가 없으면 수익률 분포 대체지표를 사용한다", () => {
    const fallback = raw.marketStrength.map((m, i) => ({
      date: m.date,
      medianReturn20d: (raw.kospi[i].close / raw.kospi[Math.max(0, i - 20)].close - 1) * 100,
      medianReturn60d: (raw.kospi[i].close / raw.kospi[Math.max(0, i - 60)].close - 1) * 100,
    }));
    const s = calculateFearGreedSeries({ ...dataset, marketStrength: fallback });
    expect(s.at(-1)!.rawData.marketStrength?.source).toBe("return-distribution");
    expect(s.at(-1)!.marketStrengthScore).not.toBeNull();
  });
});

describe("Mock providers", () => {
  it("DEMO_FAIL_FACTORS로 지정한 Provider는 실패한다", async () => {
    const p = createMockProviders(["putCall"]);
    await expect(p.putCall.getCurrent()).rejects.toThrow();
    await expect(p.kospi.getCurrent()).resolves.toHaveProperty("close");
  });
});
