# KOSPI 공포·탐욕지수 (KOSPI Fear & Greed Index)

한국 증시의 투자심리를 **0(극도의 공포) ~ 100(극도의 탐욕)** 점수로 보여주는 웹서비스입니다.
모멘텀, 변동성(VKOSPI), 시장 폭, 외국인 수급, 52주 신고가·신저가, KOSPI200 옵션 Put/Call, 위험선호도
7개 지표를 과거 분포 대비 percentile로 정규화한 뒤 가중 평균해 산출합니다.

> **본 지수는 자체 산출 지표이며 투자 권유가 아닙니다.**
> 한국거래소(KRX)가 공표하는 공식 지수가 아닙니다.

---

## 목차

1. [빠른 시작](#빠른-시작)
2. [기술 스택](#기술-스택)
3. [프로젝트 구조](#프로젝트-구조)
4. [환경변수](#환경변수)
5. [Fear & Greed 계산 공식](#fear--greed-계산-공식)
6. [각 Factor 설명](#각-factor-설명)
7. [데이터 구조](#데이터-구조)
8. [데이터 Provider 구조와 교체 방법](#데이터-provider-구조와-교체-방법)
9. [실제 데이터 연결 현황](#실제-데이터-연결-현황)
10. [API](#api)
11. [캐싱과 장애 대응](#캐싱과-장애-대응)
12. [테스트](#테스트)
13. [배포](#배포)

---

## 빠른 시작

```bash
npm install
npm run dev
```

http://localhost:3000 에서 **Demo 모드**로 바로 실행됩니다. API 키, DB, `.env` 파일 모두 필요 없습니다.

| 명령 | 설명 |
| --- | --- |
| `npm run dev` | 개발 서버 |
| `npm run build` / `npm start` | 프로덕션 빌드 / 실행 |
| `npm test` | 단위 테스트 (Vitest) |
| `npm run lint` / `npm run typecheck` | ESLint / TypeScript 검사 |
| `npm run sync` | 데이터 동기화 (전체 기간 계산 → 저장소 저장) |
| `npm run db:push` | Prisma 스키마를 DB에 반영 |

요구 사항: Node.js 20.9 이상 (22 권장).

## 기술 스택

- **Next.js 16** (App Router, 서버 컴포넌트 기본) · **TypeScript** (strict)
- **Tailwind CSS v4** · **shadcn/ui** (Radix 기반, `src/components/ui`) · **Lucide Icons**
- **Recharts** (추이 차트) · **Zod** (환경변수·API 파라미터 검증) · **date-fns**
- **Prisma + SQLite** (선택, PostgreSQL로 전환 가능) · **Vitest**
- 글꼴: Pretendard (npm 패키지로 self-host)

인터랙션이 필요한 부분(차트, 기간 선택, 히트맵 선택, 상세 Modal, 테마 전환)만 client component이고
나머지는 모두 서버 컴포넌트입니다.

## 프로젝트 구조

```
src/
├── app/
│   ├── page.tsx                  # 메인 대시보드
│   ├── history/page.tsx          # 과거 데이터 탐색 (일별·월별 표, CSV)
│   ├── methodology/page.tsx      # 산출 방법
│   ├── sources/page.tsx          # 데이터 출처 + Provider 상태
│   ├── about/page.tsx            # 소개 및 면책
│   ├── loading.tsx · error.tsx   # Skeleton / 에러 경계
│   ├── sitemap.ts · robots.ts · icon.svg
│   └── api/
│       ├── fear-greed/current/route.ts
│       ├── fear-greed/history/route.ts
│       ├── fear-greed/factors/route.ts
│       └── market/kospi/route.ts
├── components/
│   ├── ui/                       # shadcn/ui 컴포넌트
│   ├── layout/                   # 헤더, 푸터(면책 문구), 테마 토글
│   ├── dashboard/                # 게이지, 히어로, Factor 카드, 설명, 극단 구간 표
│   └── charts/                   # 추이 차트, 캘린더 히트맵 (client)
└── lib/
    ├── fear-greed/               # ★ 계산 엔진 (UI 비의존 순수 함수)
    │   ├── types.ts              #   도메인 타입 (FearGreedDaily, Factor별 interface)
    │   ├── weights.ts            #   가중치 + 결측 재분배
    │   ├── normalize.ts          #   percentile rank, rolling percentile, winsorize
    │   ├── classify.ts           #   점수 → 등급
    │   ├── factors.ts            #   7개 Factor 계산
    │   ├── calculateIndex.ts     #   가중 평균 / 시계열 계산
    │   ├── explain.ts            #   규칙 기반 "왜 오늘 공포인가?"
    │   ├── analytics.ts          #   기간 비교, 극단 구간, 월별 요약
    │   ├── factor-meta.ts        #   Factor 설명 메타데이터
    │   └── __tests__/            #   단위 테스트
    ├── providers/                # ★ 데이터 Provider
    │   ├── types.ts              #   MarketDataProvider<T> 인터페이스
    │   ├── index.ts              #   DATA_MODE에 따른 레지스트리
    │   ├── mock/                 #   결정론적 데모 데이터 생성기
    │   ├── krx/                  #   KRX Open API 클라이언트 + Provider
    │   ├── file/                 #   CSV Provider (외국인 수급)
    │   └── unconfigured.ts       #   미연결 슬롯
    ├── data/                     # 서비스 레이어 (Provider → 엔진 → 캐시/저장소)
    ├── cache/                    # 장중/장후 TTL, 메모리 캐시
    ├── store/                    # 마지막 정상 데이터 저장소 (memory | prisma)
    ├── config/env.ts             # Zod 환경변수 스키마
    └── ui/                       # 색상·뷰모델 (서버→클라이언트 직렬화)
prisma/schema.prisma              # SQLite 스키마 (PostgreSQL 전환 안내 포함)
scripts/sync.ts                   # 동기화 스크립트
```

## 환경변수

모두 선택 사항입니다. `cp .env.example .env.local` 후 수정하세요.

| 변수 | 기본값 | 설명 |
| --- | --- | --- |
| `DATA_MODE` | `demo` | `demo`: 시뮬레이션 데이터 / `live`: 실데이터 |
| `KRX_API_KEY` | – | KRX Open API 인증키 (live 모드) |
| `KRX_API_BASE_URL` | `https://data-dbg.krx.co.kr` | KRX Open API 호출 주소 |
| `KRX_CACHE_DIR` | `.cache/krx` | 과거 KRX 응답 파일 캐시 |
| `FOREIGN_FLOW_CSV` | – | 외국인 순매수 CSV 경로 (`date,netBuy`) |
| `STORE_DRIVER` | `memory` | `memory` 또는 `prisma` |
| `DATABASE_URL` | – | `STORE_DRIVER=prisma`일 때 DB 주소 (`file:./dev.db`) |
| `LOOKBACK_YEARS` | `5` | percentile 정규화 기간 (년) |
| `DEMO_FAIL_FACTORS` | – | 데모에서 장애를 흉내 낼 슬롯 (예: `putCall,foreignFlow`) |
| `NEXT_PUBLIC_SITE_URL` | `http://localhost:3000` | OpenGraph·sitemap 기준 URL |

잘못된 값이 들어와도 Zod 스키마의 기본값으로 안전하게 대체되어 사이트가 멈추지 않습니다.

## Fear & Greed 계산 공식

```
FearGreedIndex =
    Momentum         × 0.20
  + Volatility       × 0.20
  + MarketBreadth    × 0.20
  + ForeignFlow      × 0.15
  + MarketStrength   × 0.10
  + PutCallSentiment × 0.10
  + RiskAppetite     × 0.05

최종 점수 = clamp(Math.round(가중 평균), 0, 100)
```

| 점수 | 상태 |
| --- | --- |
| 0 ~ 20 | 극도의 공포 |
| 21 ~ 40 | 공포 |
| 41 ~ 60 | 중립 |
| 61 ~ 80 | 탐욕 |
| 81 ~ 100 | 극도의 탐욕 |

### 정규화: rolling percentile rank

```
percentile = (현재값보다 작은 표본 수 + 같은 표본 수 × 0.5) / 전체 표본 수 × 100
공포 방향 지표(변동성, Put/Call): score = 100 − percentile
```

- **Lookback**: 최근 5년(1,260거래일). 5년이 안 되면 사용 가능한 가장 긴 기간(최소 60개 표본).
- **Winsorization**: 현재 값을 분포의 1%~99% 분위로 잘라 극단값의 영향을 줄입니다.
- **Look-ahead bias 없음**: 각 날짜 점수는 그날까지의 데이터만 사용합니다 (테스트로 검증).
- 구현은 정렬 상태를 유지하는 슬라이딩 윈도우(이진 탐색)로 O(n·log w) 탐색 — 8년치 7개 지표 계산 ≈ 0.2초.

### 결측 Factor 가중치 재분배

데이터가 없는 Factor는 제외하고 나머지 가중치를 **원래 비율대로** 재분배합니다.
예: Put/Call(10%) 누락 → 모멘텀 0.20 / 0.90 = 22.2%. 기본 가중치 기준 50% 이상의 Factor가 있어야 그날 점수를 산출합니다.

## 각 Factor 설명

| Factor | 가중치 | 원천 지표 | 점수화 |
| --- | --- | --- | --- |
| 시장 모멘텀 | 20% | KOSPI / MA20·MA60·MA120 − 1 (이격도) | 세 이격도 percentile의 평균 |
| 변동성 | 20% | VKOSPI (없으면 KOSPI 20일 실현 변동성 × √252) | 100 − percentile |
| 시장 폭 | 20% | 상승 ÷ (상승 + 하락) 종목 비율 | 20일 평균 percentile 70% + 5일 평균 30% |
| 외국인 수급 | 15% | 외국인 KOSPI 순매수 1·5·20일 누적 | percentile 가중 평균 (20/30/50%) |
| 시장 강도 | 10% | 52주 신고가 ÷ (신고가 + 신저가), 10일 합계 | percentile. 데이터 없으면 구성 종목 20·60일 수익률 중앙값으로 대체 |
| Put/Call | 10% | KOSPI200 옵션 풋 ÷ 콜 거래량, 5일 평균 | 100 − percentile (optional) |
| 위험선호도 | 5% | KOSDAQ/KOSPI 상대강도 20일 변화(50%), 소형/대형 상대강도(25%), KOSDAQ 20일 수익률(25%) | percentile 가중 평균 |

### "왜 오늘 공포인가?" (규칙 기반 설명)

각 Factor의 기여도 `적용 가중치 × (점수 − 50)`를 계산해 전체 방향과 같은 쪽으로 가장 크게 작용한 3개를
템플릿 문장 + 실제 수치로 설명하고, 반대 방향 요인(또는 120일선 위/아래 여부)을 "반면 …"으로 덧붙입니다. AI를 사용하지 않습니다.

## 데이터 구조

핵심 타입은 `src/lib/fear-greed/types.ts`에 있습니다.

```ts
interface FearGreedDaily {
  date: string;                 // KST 거래일 yyyy-MM-dd
  score: number;                // 0~100 정수
  classification: Classification;
  kospiClose: number;

  momentumScore: number | null;
  volatilityScore: number | null;
  breadthScore: number | null;
  foreignFlowScore: number | null;
  marketStrengthScore: number | null;
  putCallScore: number | null;
  riskAppetiteScore: number | null;

  rawData: FactorRawData;       // Factor별 원천 수치 (MomentumRaw, VolatilityRaw, ...)
  appliedWeights: Partial<Record<FactorKey, number>>;  // 재분배 후 가중치
  missingFactors: FactorKey[];
  updatedAt: string;
}
```

Factor별 원천 데이터 interface: `MomentumRaw`, `VolatilityRaw`, `BreadthRaw`, `ForeignFlowRaw`,
`MarketStrengthRaw`, `PutCallRaw`, `RiskAppetiteRaw`.
Provider가 반환하는 일별 관측치: `KospiObservation`, `VolatilityObservation`, `BreadthObservation`,
`ForeignFlowObservation`, `MarketStrengthObservation`, `PutCallObservation`, `RiskAppetiteObservation`.

DB 스키마(`prisma/schema.prisma`)의 `FearGreedDaily` 모델은 위 타입과 1:1로 대응하며, `rawData`와
메타데이터는 DB 간 호환을 위해 JSON 문자열로 저장합니다.

## 데이터 Provider 구조와 교체 방법

모든 Provider는 같은 인터페이스를 구현합니다 (`src/lib/providers/types.ts`).

```ts
interface MarketDataProvider<T extends DailyObservation> {
  readonly info: ProviderInfo;            // 이름, 출처, 유형(live/mock/file/unconfigured)
  getCurrent(): Promise<T>;
  getHistory(start: Date, end: Date): Promise<T[]>;
}
```

| 슬롯 | 타입 | demo | live |
| --- | --- | --- | --- |
| `kospi` | `KospiProvider` | `MockProvider` | `KrxKospiProvider` |
| `volatility` | `VolatilityProvider` | `MockProvider` | `KrxVolatilityProvider` |
| `breadth` | `MarketBreadthProvider` | `MockProvider` | `KrxBreadthProvider` |
| `foreignFlow` | `ForeignFlowProvider` | `MockProvider` | `CsvForeignFlowProvider` 또는 `UnconfiguredProvider` |
| `marketStrength` | `MarketStrengthProvider` | `MockProvider` | `KrxMarketStrengthProvider` |
| `putCall` | `PutCallProvider` | `MockProvider` | `KrxPutCallProvider` |
| `riskAppetite` | `RiskAppetiteProvider` | `MockProvider` | `KrxRiskAppetiteProvider` |

**교체 방법**

1. 새 클래스가 `MarketDataProvider<해당 Observation>`을 구현하도록 작성합니다.
2. `src/lib/providers/index.ts`의 `createLiveProviders()`에서 해당 슬롯에 넣습니다.
3. 끝. 계산 엔진·서비스·UI는 Provider 구현을 모릅니다. `/sources` 페이지에 `info`가 자동 표시됩니다.

각 Provider는 `Promise.allSettled`로 **독립적으로** 호출되므로 하나가 실패해도 다른 Factor 계산에 영향을 주지 않습니다.
데이터를 못 가져오는 Provider는 예외를 던지기만 하면 됩니다 (`ProviderNotConfiguredError`면 "미연결", 그 외는 "지연/오류"로 표시).

## 실제 데이터 연결 현황

> ⚠️ **현재 기본 상태는 Demo(mock) 데이터입니다.** 화면 상단에 "데모 모드" 안내가 표시됩니다.

Live 모드의 데이터 소스는 **한국거래소 KRX Open API**(공식, https://openapi.krx.co.kr)입니다.
회원가입 → 인증키 발급 → **서비스별 이용 신청·승인**이 필요하며, 전 거래일 종가까지의 일별 데이터를 제공합니다.
호출 형식: `GET {KRX_API_BASE_URL}/svc/apis/{서비스}?basDd=YYYYMMDD`, 헤더 `AUTH_KEY`, 응답 `OutBlock_1`.

| Factor | KRX 서비스 | 상태 |
| --- | --- | --- |
| KOSPI 종가 | `idx/kospi_dd_trd` (지수명 `코스피`) | 구현됨 |
| VKOSPI | `idx/drvprod_dd_trd` (지수명 `코스피 200 변동성지수`) | 구현됨 |
| 상승·하락 종목 수 | `sto/stk_bydd_trd` 등락률(`FLUC_RT`) 집계 | 구현됨 |
| 52주 신고가·신저가 | `sto/stk_bydd_trd` 종목별 고가/저가로 250거래일 창 직접 계산 | 구현됨 |
| Put/Call | `drv/opt_bydd_trd` KOSPI200 옵션 콜/풋 거래량 집계 | 구현됨 — **값 표기 검증 필요** |
| KOSDAQ·대형/소형주 | `idx/kosdaq_dd_trd`, `idx/kospi_dd_trd` | 구현됨 |
| **외국인 순매수** | KRX Open API 미제공 | **이 Provider에는 실제 데이터 소스 연결이 필요합니다.** |

연결 시 확인할 점

- 이 저장소의 개발 환경에서는 KRX API에 접근할 수 없어 **실제 응답으로 end-to-end 검증을 하지 못했습니다.**
  엔드포인트·필드명(`BAS_DD`, `IDX_NM`, `CLSPRC_IDX`, `FLUC_RT`, `TDD_HGPRC`, `TDD_LWPRC`, `PROD_NM`,
  `RGHT_TP_NM`, `ACC_TRDVOL`)은 KRX Open API 명세 기준이지만, **지수명·상품명·권리유형의 실제 값 표기**는 첫 연결 시
  응답을 확인하고 `src/lib/providers/krx/providers.ts`의 상수(`KRX_INDEX_NAMES`, Put/Call 정규식)를 조정하세요.
- **외국인 수급**: KRX 정보데이터시스템(data.krx.co.kr) 등에서 이용약관에 따라 직접 내려받은 자료를
  `date,netBuy`(억원) CSV로 저장하고 `FOREIGN_FLOW_CSV`로 지정하거나, 라이선스가 있는 데이터 API로 Provider를 구현하세요.
  연결 전에는 해당 Factor(15%)를 제외하고 가중치를 재분배합니다.
- 무단 크롤링은 하지 않습니다. 과거 응답은 `KRX_CACHE_DIR`에 캐시해 같은 날짜를 다시 호출하지 않습니다.

### Live 모드 실행 절차

```bash
cp .env.example .env.local
# .env.local:
#   DATA_MODE=live
#   KRX_API_KEY=발급받은키
#   STORE_DRIVER=prisma
#   DATABASE_URL="file:./dev.db"

npm run db:push      # SQLite 테이블 생성
npm run sync         # 최초 1회: 약 6년치(5년 lookback + 1년 워밍업) 수집 → 계산 → DB 저장
npm run build && npm start
```

최초 동기화는 거래일 × 서비스 수만큼 API를 호출하므로 시간이 걸립니다(동시 4건). 이후에는 파일 캐시 덕분에 신규 거래일만 호출합니다.
**매 거래일 KRX 데이터 공개 이후(예: 08:30 KST) `npm run sync`를 cron으로 실행**하는 것을 권장합니다.

## API

| 경로 | 설명 |
| --- | --- |
| `GET /api/fear-greed/current` | 현재 점수, 등급, Factor별 점수·가중치·원천 수치, 어제/1주/1개월 비교 |
| `GET /api/fear-greed/history?period=1y` | 기간별 시계열. `period`: `1m` `3m` `6m` `1y` `3y` `all`, `factors=true`, `format=csv` |
| `GET /api/fear-greed/factors` | Factor 상세(데이터·계산 방법) + 규칙 기반 설명 + Provider 상태 |
| `GET /api/market/kospi?period=1y` | KOSPI 종가 시계열 |

```json
// GET /api/fear-greed/current
{
  "score": 24,
  "classification": "공포",
  "date": "2026-10-15",
  "kospiClose": 3188.54,
  "factors": { "momentum": { "label": "시장 모멘텀", "score": 22.7, "weight": 0.2, "appliedWeight": 0.2, "raw": { … } }, … },
  "missingFactors": [],
  "comparisons": [{ "label": "어제", "date": "2026-10-14", "score": 24, "delta": 0 }, …],
  "updatedAt": "2026-10-15T14:44:00.000Z",
  "mode": "demo",
  "stale": false,
  "notices": [],
  "disclaimer": "본 지수는 자체 산출 지표이며 투자 권유가 아닙니다."
}
```

잘못된 파라미터는 400과 Zod 검증 메시지를 반환합니다.

## 캐싱과 장애 대응

**캐싱** — 매 요청마다 외부 API를 호출하지 않습니다.

- 서비스 레이어 메모리 캐시(`TtlCache`, 동시 요청 병합): **장중(09:00~15:30 KST) 10분 / 장 종료 후·휴장일 1시간**
- 페이지: ISR `revalidate = 600`
- API 응답: `Cache-Control: s-maxage={TTL}, stale-while-revalidate`
- KRX 과거 응답: 파일 캐시 (영구)

**장애 대응**

| 상황 | 동작 | 화면 |
| --- | --- | --- |
| 일부 Provider 실패 | 해당 Factor 제외 + 가중치 비례 재분배 | "일부 지표 데이터 업데이트 지연" |
| KOSPI(필수) 또는 전체 실패 | 마지막 정상 데이터(메모리 → DB) 유지 | "마지막 정상 데이터를 표시합니다" |
| live 첫 실행 실패 + 저장 데이터 없음 | 데모 데이터로 대체 | "실시간 데이터 연결에 실패해 데모 데이터를 표시합니다" |

데모 모드에서 `DEMO_FAIL_FACTORS=putCall npm run dev`로 재분배 동작을 직접 확인할 수 있습니다.

## 테스트

```bash
npm test
```

`src/lib/fear-greed/__tests__/` — 점수 0 미만/100 초과 방지, 가중치 합계(모든 결측 조합에서 1), 결측 Factor 재분배,
percentile 계산(증분 구현 ↔ naive 구현 일치), winsorization, 등급 경계값, look-ahead bias 없음, VKOSPI·신고가 대체지표,
규칙 기반 설명, 극단 구간의 미래 데이터 처리, CSV 파서, 장중/장후 캐시 TTL.

## 배포

**Vercel (demo 모드)** — 저장소를 연결하면 추가 설정 없이 배포됩니다. `NEXT_PUBLIC_SITE_URL`만 실제 도메인으로 지정하세요.

**Live 모드** — 서버리스 환경은 파일시스템이 휘발성이므로:

1. `prisma/schema.prisma`의 `provider`를 `"postgresql"`로 바꾸고 `DATABASE_URL`을 관리형 PostgreSQL로 지정
2. `STORE_DRIVER=prisma`, `DATA_MODE=live`, `KRX_API_KEY` 설정 후 `npx prisma db push`
3. 별도 워커/cron(GitHub Actions, 서버 cron 등)에서 매 거래일 `npm run sync` 실행 (KRX 캐시 디렉터리를 보존할 수 있는 환경 권장)
4. 웹 서버가 KRX 호출에 실패하면 DB의 마지막 정상 데이터를 표시합니다.

**자체 서버 / Docker** — `npm ci && npm run build && npm start` (포트 3000). 영구 디스크에 `.cache/krx`와 SQLite 파일을 두면 됩니다.

---

본 지수는 자체 산출 지표이며 투자 권유가 아닙니다.
