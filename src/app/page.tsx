import Link from "next/link";
import { HistoryChart } from "@/components/charts/history-chart";
import { SentimentHeatmap } from "@/components/charts/sentiment-heatmap";
import { ExtremesTable } from "@/components/dashboard/extremes-table";
import { FactorCards } from "@/components/dashboard/factor-cards";
import { MarketExplanation } from "@/components/dashboard/market-explanation";
import { NoticeBanner } from "@/components/dashboard/notice-banner";
import { ScoreHero } from "@/components/dashboard/score-hero";
import { Panel, Section } from "@/components/dashboard/section";
import { getFearGreedSnapshot } from "@/lib/data/fear-greed-service";
import { explainDay, findExtremes, getComparisons } from "@/lib/fear-greed";
import { toChartPoints, toFactorCards, toHeatmapDays } from "@/lib/ui/view-models";
import { DISCLAIMER } from "@/lib/site";

/** ISR: 최대 10분마다 재생성 (서비스 레이어가 장중/장후 TTL을 별도로 관리) */
export const revalidate = 600;

function explanationTitle(score: number) {
  if (score <= 40) return "왜 오늘 공포인가?";
  if (score <= 60) return "왜 오늘 중립인가?";
  return "왜 오늘 탐욕인가?";
}

export default async function HomePage() {
  const snapshot = await getFearGreedSnapshot();
  const { series, latest } = snapshot;
  const explanation = explainDay(latest);

  return (
    <>
      <NoticeBanner snapshot={snapshot} />

      {/* 1. 현재 점수 · 상태 · 전일 대비 (모바일 첫 화면) */}
      <ScoreHero
        latest={latest}
        comparisons={getComparisons(series)}
        generatedAt={snapshot.generatedAt}
        headline={explanation.headline}
      />

      {/* 2. 역사 차트 */}
      <Section
        id="history"
        title="KOSPI 공포·탐욕지수 추이"
        description="공포·탐욕지수와 KOSPI 종가를 같은 기간으로 비교합니다. 차트 위에 마우스를 올리거나 터치하면 상세 값을 볼 수 있습니다."
      >
        <Panel>
          <HistoryChart points={toChartPoints(series)} />
        </Panel>
      </Section>

      {/* 3. 세부 지표 */}
      <Section
        id="factors"
        title="오늘의 시장 심리"
        description="7개 지표를 각각 0~100으로 정규화한 뒤 가중 평균합니다. 카드를 누르면 계산 방법을 볼 수 있습니다."
      >
        <FactorCards cards={toFactorCards(series)} />
      </Section>

      {/* 4. 시장 설명 */}
      <Section id="explanation" title={explanationTitle(latest.score)}>
        <Panel>
          <MarketExplanation explanation={explanation} />
        </Panel>
      </Section>

      {/* 5. 과거 극단 구간 */}
      <Section
        id="extremes"
        title="역대 공포·탐욕 구간"
        description="지수가 가장 낮았던(높았던) 날과 이후 KOSPI 수익률"
      >
        <Panel>
          <ExtremesTable fear={findExtremes(series, "fear")} greed={findExtremes(series, "greed")} />
        </Panel>
      </Section>

      {/* 6. 히트맵 */}
      <Section
        id="heatmap"
        title="시장 심리 히트맵"
        description="최근 1년 일별 공포·탐욕 구간. 날짜를 선택하면 그날의 세부 지표를 볼 수 있습니다."
        action={
          <Link href="/history" className="text-muted-foreground hover:text-foreground text-sm underline-offset-4 hover:underline">
            과거 데이터 전체 보기 →
          </Link>
        }
      >
        <Panel>
          <SentimentHeatmap days={toHeatmapDays(series)} />
        </Panel>
      </Section>

      <p className="text-muted-foreground mt-10 text-center text-xs">{DISCLAIMER}</p>
    </>
  );
}
