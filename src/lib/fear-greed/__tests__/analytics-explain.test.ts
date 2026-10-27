import { describe, expect, it } from "vitest";
import { findExtremes, filterByPeriod, getComparisons, FORWARD_DAYS } from "../analytics";
import { calculateFearGreedSeries } from "../calculateIndex";
import { explainDay, computeContributions } from "../explain";
import { generateMockMarketData } from "../../providers/mock/generator";
import { parseForeignFlowCsv } from "../../providers/file/csv-foreign-flow";
import { getMarketSession } from "../../utils/date";
import { getCacheTtlSeconds, INTRADAY_TTL_SECONDS, AFTER_HOURS_TTL_SECONDS } from "../../cache/ttl";

const series = calculateFearGreedSeries(generateMockMarketData("2025-06-30"));

describe("analytics", () => {
  it("어제/1주 전/1개월 전 비교값", () => {
    const c = getComparisons(series);
    expect(c.map((x) => x.label)).toEqual(["어제", "1주 전", "1개월 전"]);
    const latest = series.at(-1)!;
    for (const p of c) expect(p.delta).toBe(latest.score - p.score);
  });

  it("극단 구간: 미래 데이터가 없는 기간의 수익률은 null", () => {
    const fear = findExtremes(series, "fear", 10);
    expect(fear).toHaveLength(10);
    for (const e of fear) {
      const idx = series.findIndex((d) => d.date === e.date);
      expect(e.return6m === null).toBe(idx + FORWARD_DAYS["6m"] >= series.length);
    }
    // 정렬: 점수 오름차순
    for (let i = 1; i < fear.length; i++) expect(fear[i].score).toBeGreaterThanOrEqual(fear[i - 1].score);
  });

  it("기간 필터", () => {
    const y = filterByPeriod(series, "1y");
    expect(y.length).toBeGreaterThan(230);
    expect(y.length).toBeLessThan(270);
    expect(filterByPeriod(series, "all")).toHaveLength(series.length);
  });
});

describe("explainDay", () => {
  it("헤드라인과 최대 3개의 주요 요인을 생성한다", () => {
    const day = series.at(-1)!;
    const ex = explainDay(day);
    expect(ex.headline).toContain(String(day.score));
    expect(ex.headline).toContain(day.classification);
    expect(ex.topContributors.length).toBeLessThanOrEqual(3);
    expect(ex.paragraphs.length).toBeGreaterThan(0);
  });

  it("기여도의 합은 (점수 − 50)과 같다", () => {
    const day = series.at(-1)!;
    const total = computeContributions(day).reduce((s, c) => s + c.contribution, 0);
    // 개별 점수 반올림(소수 1자리) 오차 허용
    expect(total + 50).toBeCloseTo(day.score, 0);
  });
});

describe("CSV foreign flow provider", () => {
  it("date,netBuy CSV를 파싱한다", () => {
    const rows = parseForeignFlowCsv("date,netBuy\n20261015,-1200\n2026-10-14,350\nbad,row\n");
    expect(rows).toEqual([
      { date: "2026-10-14", netBuy: 350 },
      { date: "2026-10-15", netBuy: -1200 },
    ]);
  });
});

describe("market session cache TTL", () => {
  it("장중 10분, 장 종료 후 1시간", () => {
    const intraday = new Date("2026-10-15T01:30:00Z"); // 목 10:30 KST
    const evening = new Date("2026-10-15T12:00:00Z"); // 목 21:00 KST
    const weekend = new Date("2026-10-17T03:00:00Z"); // 토
    expect(getMarketSession(intraday)).toBe("open");
    expect(getCacheTtlSeconds(intraday)).toBe(INTRADAY_TTL_SECONDS);
    expect(getCacheTtlSeconds(evening)).toBe(AFTER_HOURS_TTL_SECONDS);
    expect(getMarketSession(weekend)).toBe("closed");
  });
});
