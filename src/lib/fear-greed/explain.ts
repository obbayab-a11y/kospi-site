/**
 * 규칙 기반 시장 심리 설명 생성기 (AI 미사용).
 *
 * 각 Factor의 기여도 = 적용 가중치 × (Factor 점수 − 50)
 * 를 계산해 전체 점수를 중립(50)에서 가장 많이 움직인 3개 Factor를 골라
 * Factor별 템플릿 문장으로 설명한다.
 */
import { formatKrwEok, formatNumber, formatSignedPct } from "../utils/format";
import { FACTOR_META } from "./factor-meta";
import { FACTOR_KEYS, getFactorScore, type FactorKey, type FearGreedDaily } from "./types";

export interface FactorContribution {
  key: FactorKey;
  label: string;
  score: number;
  weight: number;
  /** 중립 대비 기여 포인트 (음수 = 공포 방향) */
  contribution: number;
}

export interface MarketExplanation {
  headline: string;
  paragraphs: string[];
  topContributors: FactorContribution[];
  /** 전체 방향과 반대로 작용한 가장 큰 Factor */
  counterpoint: FactorContribution | null;
}

export function computeContributions(day: FearGreedDaily): FactorContribution[] {
  return FACTOR_KEYS.flatMap((key) => {
    const score = getFactorScore(day, key);
    const weight = day.appliedWeights[key];
    if (score === null || weight === undefined) return [];
    return [
      {
        key,
        label: FACTOR_META[key].label,
        score,
        weight,
        contribution: weight * (score - 50),
      },
    ];
  });
}

type Direction = "fear" | "greed";

function factorSentence(
  key: FactorKey,
  dir: Direction,
  day: FearGreedDaily,
): string {
  const r = day.rawData;
  switch (key) {
    case "momentum": {
      const m = r.momentum;
      if (!m) break;
      if (dir === "fear") {
        if (m.gap20 < 0 && m.gap60 < 0)
          return `KOSPI가 20일선(${formatSignedPct(m.gap20)})과 60일선(${formatSignedPct(m.gap60)})을 모두 밑돌며 단기 모멘텀이 약해졌습니다.`;
        return `KOSPI의 이동평균 대비 상승 폭이 과거 평균보다 작아 상승 탄력이 둔화되었습니다.`;
      }
      return `KOSPI가 120일 이동평균 대비 ${formatSignedPct(m.gap120)} 위에 있어 상승 추세가 이어지고 있습니다.`;
    }
    case "volatility": {
      const v = r.volatility;
      if (!v) break;
      const subject = v.source === "vkospi" ? "VKOSPI" : "KOSPI 20일 실현 변동성";
      const particle = v.source === "vkospi" ? "가" : "이";
      if (dir === "fear") {
        const change =
          v.change20d !== null && v.change20d > 0
            ? ` 최근 한 달 사이 ${formatNumber(v.change20d, 1)}p 상승했습니다.`
            : "";
        return `${subject}(${formatNumber(v.value, 1)})${particle} 과거 대비 높은 수준으로, 시장 변동성이 확대되었습니다.${change}`;
      }
      return `${subject}(${formatNumber(v.value, 1)})${particle} 낮게 유지되며 시장이 비교적 안정적인 흐름을 보이고 있습니다.`;
    }
    case "breadth": {
      const b = r.breadth;
      if (!b) break;
      if (dir === "fear")
        return `최근 20일 평균 상승 종목 비율이 ${formatNumber(b.ratioMa20, 1)}%로, 하락 종목이 상승 종목보다 많아 시장 전반의 투자심리가 위축되었습니다.`;
      return `최근 20일 평균 상승 종목 비율이 ${formatNumber(b.ratioMa20, 1)}%로, 상승세가 시장 전반으로 확산되고 있습니다.`;
    }
    case "foreignFlow": {
      const f = r.foreignFlow;
      if (!f) break;
      if (dir === "fear")
        return f.net20d < 0
          ? `외국인이 최근 20거래일 동안 ${formatKrwEok(Math.abs(f.net20d))}을 순매도하며 매도세가 이어지고 있습니다.`
          : `외국인 순매수 규모가 과거 대비 줄어들며 수급 지지력이 약해졌습니다.`;
      return f.net20d > 0
        ? `외국인이 최근 20거래일 동안 ${formatKrwEok(f.net20d)}을 순매수하며 수급을 뒷받침하고 있습니다.`
        : `외국인 순매도 규모가 과거 대비 줄어들며 수급 부담이 완화되고 있습니다.`;
    }
    case "marketStrength": {
      const s = r.marketStrength;
      if (!s) break;
      if (s.source === "highs-lows") {
        return dir === "fear"
          ? `52주 신저가 종목이 신고가 종목보다 많아 개별 종목의 체력이 약해진 모습입니다.`
          : `52주 신고가 종목이 신저가 종목보다 많아 개별 종목의 강세가 두드러집니다.`;
      }
      return dir === "fear"
        ? `구성 종목의 최근 수익률 분포가 하락 쪽으로 기울어 있습니다.`
        : `구성 종목의 최근 수익률 분포가 상승 쪽으로 기울어 있습니다.`;
    }
    case "putCall": {
      const p = r.putCall;
      if (!p) break;
      return dir === "fear"
        ? `KOSPI200 옵션 Put/Call 비율(5일 평균 ${formatNumber(p.ratioMa5, 2)})이 높아 하락에 대비한 헤지 수요가 늘었습니다.`
        : `KOSPI200 옵션 Put/Call 비율(5일 평균 ${formatNumber(p.ratioMa5, 2)})이 낮아 상승 쪽 베팅이 우세합니다.`;
    }
    case "riskAppetite": {
      const a = r.riskAppetite;
      if (!a) break;
      return dir === "fear"
        ? `코스닥이 코스피 대비 약세(20일 상대강도 ${formatSignedPct(a.kosdaqRelative20d)})를 보이며 위험자산 선호가 약해졌습니다.`
        : `코스닥이 코스피 대비 강세(20일 상대강도 ${formatSignedPct(a.kosdaqRelative20d)})를 보이며 위험자산 선호가 살아나고 있습니다.`;
    }
  }
  const meta = FACTOR_META[key];
  return `${meta.label} 지표가 ${dir === "fear" ? meta.fearMeaning : meta.greedMeaning} 쪽을 가리키고 있습니다.`;
}

/** 공포 국면이라도 장기 추세가 살아 있으면 이를 별도로 언급 */
function trendCaveat(day: FearGreedDaily, dir: Direction): string | null {
  const m = day.rawData.momentum;
  if (!m) return null;
  if (dir === "fear" && m.gap120 > 0)
    return "KOSPI는 120일 이동평균 위에 있어 장기 추세는 아직 완전히 훼손되지 않았습니다.";
  if (dir === "greed" && m.gap120 < 0)
    return "다만 KOSPI는 아직 120일 이동평균 아래에 있어 장기 추세 회복은 확인이 필요합니다.";
  return null;
}

const CONNECTORS = ["", "또한 ", "아울러 "];

export function explainDay(day: FearGreedDaily): MarketExplanation {
  const contributions = computeContributions(day);
  const dir: Direction = day.score < 50 ? "fear" : "greed";
  const sign = dir === "fear" ? -1 : 1;

  const headline = `오늘 KOSPI 공포·탐욕지수는 ${day.score}로 '${day.classification}' 구간입니다.`;

  // 전체 방향과 같은 쪽으로 움직인 Factor 중 기여도 상위 3개
  const sameDir = contributions
    .filter((c) => Math.sign(c.contribution) === sign && Math.abs(c.contribution) >= 0.25)
    .sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution));
  const opposite = contributions
    .filter((c) => Math.sign(c.contribution) === -sign && Math.abs(c.contribution) >= 0.5)
    .sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution));

  const top = sameDir.slice(0, 3);
  const topContributors = [...contributions]
    .sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution))
    .slice(0, 3);

  const paragraphs: string[] = [];
  if (day.score >= 45 && day.score <= 55 && top.length === 0) {
    paragraphs.push("지표들이 공포와 탐욕 어느 한쪽으로도 뚜렷하게 기울지 않아 관망 심리가 우세합니다.");
  }
  top.forEach((c, i) => {
    paragraphs.push(CONNECTORS[i] + factorSentence(c.key, dir, day));
  });

  const counterpoint = opposite[0] ?? null;
  const caveat = trendCaveat(day, dir);
  if (caveat && !top.some((c) => c.key === "momentum")) {
    paragraphs.push(`반면 ${caveat}`);
  } else if (counterpoint) {
    paragraphs.push(
      `반면 ${factorSentence(counterpoint.key, dir === "fear" ? "greed" : "fear", day)}`,
    );
  }

  if (day.missingFactors.length > 0) {
    const names = day.missingFactors.map((k) => FACTOR_META[k].label).join(", ");
    paragraphs.push(
      `(${names} 데이터는 이번 산출에서 제외되었으며, 해당 가중치는 다른 지표에 비례 재분배되었습니다.)`,
    );
  }

  return { headline, paragraphs, topContributors, counterpoint };
}
