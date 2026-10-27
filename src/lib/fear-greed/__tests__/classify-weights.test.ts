import { describe, expect, it } from "vitest";
import { classify, classificationKey, clampScore, CLASSIFICATION_BANDS } from "../classify";
import { DEFAULT_WEIGHTS, redistributeWeights, sumWeights } from "../weights";
import { FACTOR_KEYS } from "../types";

describe("classify", () => {
  it.each([
    [0, "극도의 공포"],
    [20, "극도의 공포"],
    [21, "공포"],
    [40, "공포"],
    [41, "중립"],
    [60, "중립"],
    [61, "탐욕"],
    [80, "탐욕"],
    [81, "극도의 탐욕"],
    [100, "극도의 탐욕"],
  ] as const)("%i → %s", (score, label) => {
    expect(classify(score)).toBe(label);
  });

  it("경계 소수는 반올림 후 판정한다", () => {
    expect(classify(20.4)).toBe("극도의 공포");
    expect(classify(20.6)).toBe("공포");
  });

  it("범위 밖 점수도 안전하게 처리한다", () => {
    expect(classify(-10)).toBe("극도의 공포");
    expect(classify(250)).toBe("극도의 탐욕");
    expect(classificationKey(Number.NaN)).toBe("neutral");
  });

  it("구간이 0~100을 빈틈없이 덮는다", () => {
    for (let s = 0; s <= 100; s++) {
      expect(CLASSIFICATION_BANDS.filter((b) => s >= b.min && s <= b.max)).toHaveLength(1);
    }
  });

  it("clampScore", () => {
    expect(clampScore(-1)).toBe(0);
    expect(clampScore(101)).toBe(100);
    expect(clampScore(55.5)).toBe(55.5);
  });
});

describe("weights", () => {
  it("기본 가중치 합계는 1", () => {
    expect(sumWeights(DEFAULT_WEIGHTS)).toBeCloseTo(1, 10);
  });

  it("명세의 가중치를 따른다", () => {
    expect(DEFAULT_WEIGHTS).toEqual({
      momentum: 0.2,
      volatility: 0.2,
      breadth: 0.2,
      foreignFlow: 0.15,
      marketStrength: 0.1,
      putCall: 0.1,
      riskAppetite: 0.05,
    });
  });

  it("재분배 후에도 합계는 1이고 비율은 유지된다", () => {
    const w = redistributeWeights(["momentum", "volatility", "riskAppetite"]);
    expect(sumWeights(w)).toBeCloseTo(1, 10);
    expect(w.momentum).toBeCloseTo(0.2 / 0.45);
    expect(w.riskAppetite).toBeCloseTo(0.05 / 0.45);
    expect((w.momentum ?? 0) / (w.riskAppetite ?? 1)).toBeCloseTo(4);
  });

  it("어떤 조합에서도 합계가 1", () => {
    for (let mask = 1; mask < 1 << FACTOR_KEYS.length; mask++) {
      const keys = FACTOR_KEYS.filter((_, i) => mask & (1 << i));
      expect(sumWeights(redistributeWeights(keys))).toBeCloseTo(1, 10);
    }
  });

  it("빈 목록이면 빈 가중치", () => {
    expect(redistributeWeights([])).toEqual({});
  });
});
