import type { FactorKey } from "./types";
import { DEFAULT_WEIGHTS } from "./weights";

export interface FactorMeta {
  key: FactorKey;
  label: string;
  shortLabel: string;
  weight: number;
  /** 한 줄 요약 */
  summary: string;
  /** 높은 점수(탐욕)의 의미 */
  greedMeaning: string;
  /** 낮은 점수(공포)의 의미 */
  fearMeaning: string;
  /** 계산 방법 단계 설명 */
  method: string[];
  /** 데이터가 없을 때의 대체/처리 방식 */
  fallback: string;
}

export const FACTOR_META: Record<FactorKey, FactorMeta> = {
  momentum: {
    key: "momentum",
    label: "시장 모멘텀",
    shortLabel: "모멘텀",
    weight: DEFAULT_WEIGHTS.momentum,
    summary: "KOSPI가 20·60·120일 이동평균 대비 어디에 있는지",
    greedMeaning: "지수가 이동평균보다 크게 위에 있음 (상승 추세)",
    fearMeaning: "지수가 이동평균 아래로 밀려남 (하락 추세)",
    method: [
      "이격도 = (KOSPI 종가 ÷ N일 이동평균 − 1) × 100, N = 20, 60, 120",
      "각 이격도를 과거 5년 분포 대비 percentile rank로 변환",
      "세 percentile의 단순 평균을 점수로 사용",
    ],
    fallback: "KOSPI 종가는 필수 데이터이며 대체하지 않습니다.",
  },
  volatility: {
    key: "volatility",
    label: "변동성",
    shortLabel: "변동성",
    weight: DEFAULT_WEIGHTS.volatility,
    summary: "VKOSPI(코스피200 변동성지수) 수준",
    greedMeaning: "변동성이 낮아 시장이 안정적",
    fearMeaning: "변동성이 높아 불안 심리 확대",
    method: [
      "VKOSPI 종가의 과거 5년 분포 대비 percentile 계산",
      "변동성은 높을수록 공포이므로 점수 = 100 − percentile",
    ],
    fallback:
      "VKOSPI를 확보하지 못하면 KOSPI 20일 실현 변동성(일간 로그수익률 표준편차 × √252)을 사용합니다.",
  },
  breadth: {
    key: "breadth",
    label: "시장 폭",
    shortLabel: "시장 폭",
    weight: DEFAULT_WEIGHTS.breadth,
    summary: "상승 종목 수 ÷ (상승 + 하락 종목 수)",
    greedMeaning: "대부분의 종목이 함께 상승",
    fearMeaning: "하락 종목이 상승 종목보다 많음",
    method: [
      "일별 상승 비율 = 상승 종목 ÷ (상승 + 하락) × 100",
      "20일 이동평균 상승 비율 percentile × 70% + 5일 평균 percentile × 30%",
    ],
    fallback: "데이터가 없으면 이 Factor를 제외하고 가중치를 재분배합니다.",
  },
  foreignFlow: {
    key: "foreignFlow",
    label: "외국인 수급",
    shortLabel: "외국인",
    weight: DEFAULT_WEIGHTS.foreignFlow,
    summary: "외국인 KOSPI 순매수 금액 (1·5·20일 누적)",
    greedMeaning: "외국인이 강하게 순매수",
    fearMeaning: "외국인이 강하게 순매도",
    method: [
      "외국인 순매수 금액의 1일 / 5일 / 20일 누적값 계산",
      "각 누적값을 과거 5년 분포 대비 percentile로 변환",
      "가중 평균: 1일 20% · 5일 30% · 20일 50%",
    ],
    fallback: "데이터가 없으면 이 Factor를 제외하고 가중치를 재분배합니다.",
  },
  marketStrength: {
    key: "marketStrength",
    label: "시장 강도",
    shortLabel: "시장 강도",
    weight: DEFAULT_WEIGHTS.marketStrength,
    summary: "52주 신고가 종목 수 vs 신저가 종목 수",
    greedMeaning: "신고가 종목이 신저가 종목보다 많음",
    fearMeaning: "신저가 종목이 신고가 종목보다 많음",
    method: [
      "노이즈를 줄이기 위해 최근 10거래일 신고가·신저가 합계를 사용",
      "강도 = 신고가 ÷ (신고가 + 신저가) × 100",
      "과거 5년 분포 대비 percentile을 점수로 사용",
    ],
    fallback:
      "신고가·신저가 데이터가 없으면 KOSPI 구성 종목 20일·60일 수익률 중앙값의 percentile 평균으로 대체합니다.",
  },
  putCall: {
    key: "putCall",
    label: "Put/Call 비율",
    shortLabel: "Put/Call",
    weight: DEFAULT_WEIGHTS.putCall,
    summary: "KOSPI200 옵션 풋 거래량 ÷ 콜 거래량",
    greedMeaning: "콜옵션 수요 우위 (상승 베팅)",
    fearMeaning: "풋옵션 수요 우위 (하락 헤지 증가)",
    method: [
      "Put/Call 거래량 비율의 5일 이동평균 계산",
      "높을수록 공포이므로 점수 = 100 − percentile",
    ],
    fallback:
      "선택(optional) Factor입니다. 데이터가 없으면 제외하고 나머지 Factor에 가중치를 비례 재분배합니다.",
  },
  riskAppetite: {
    key: "riskAppetite",
    label: "위험선호도",
    shortLabel: "위험선호",
    weight: DEFAULT_WEIGHTS.riskAppetite,
    summary: "코스닥·소형주의 상대강도",
    greedMeaning: "코스닥·소형주가 상대적으로 강세",
    fearMeaning: "대형주·안전자산 선호",
    method: [
      "KOSDAQ ÷ KOSPI 상대강도의 20일 변화율 (50%)",
      "코스피 소형주 ÷ 대형주 상대강도의 20일 변화율 (25%)",
      "KOSDAQ 20일 수익률 (25%)",
      "각 항목 percentile의 가중 평균 (결측 항목은 제외 후 재정규화)",
    ],
    fallback: "데이터가 없으면 이 Factor를 제외하고 가중치를 재분배합니다.",
  },
};

export const FACTOR_ORDER: readonly FactorKey[] = [
  "momentum",
  "volatility",
  "breadth",
  "foreignFlow",
  "marketStrength",
  "putCall",
  "riskAppetite",
];
