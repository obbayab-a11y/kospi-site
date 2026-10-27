import type { Metadata } from "next";
import Link from "next/link";
import { Download } from "lucide-react";
import { HistoryChart } from "@/components/charts/history-chart";
import { SentimentHeatmap } from "@/components/charts/sentiment-heatmap";
import { NoticeBanner } from "@/components/dashboard/notice-banner";
import { Panel, Section } from "@/components/dashboard/section";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getFearGreedSnapshot } from "@/lib/data/fear-greed-service";
import { filterByPeriod, monthlySummary, PERIOD_LABELS, type Period } from "@/lib/fear-greed/analytics";
import { classify } from "@/lib/fear-greed/classify";
import { FACTOR_META, FACTOR_ORDER } from "@/lib/fear-greed/factor-meta";
import { getFactorScore } from "@/lib/fear-greed/types";
import { deltaColorClass, sentimentColor } from "@/lib/ui/sentiment";
import { toChartPoints, toHeatmapDays } from "@/lib/ui/view-models";
import { formatDateDot, formatNumber, formatSignedPct } from "@/lib/utils/format";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "과거 데이터",
  description: "KOSPI 공포·탐욕지수의 일별·월별 과거 데이터와 세부 지표 점수를 탐색합니다.",
  alternates: { canonical: "/history" },
};

/** 일별 표는 길이를 제한한다 (긴 기간은 월별 요약과 CSV 다운로드 이용) */
const TABLE_PERIODS: Period[] = ["1m", "3m", "6m", "1y"];

function ScoreDot({ score }: { score: number }) {
  return (
    <span className="tabular inline-flex items-center gap-1.5 font-semibold">
      <span className="size-2 rounded-full" style={{ backgroundColor: sentimentColor(score) }} aria-hidden />
      {score}
    </span>
  );
}

export default async function HistoryPage({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  const { period: raw } = await searchParams;
  const period: Period = TABLE_PERIODS.includes(raw as Period) ? (raw as Period) : "1m";

  const snapshot = await getFearGreedSnapshot();
  const { series } = snapshot;
  const daily = filterByPeriod(series, period).reverse();
  const months = monthlySummary(series).reverse();

  return (
    <>
      <NoticeBanner snapshot={snapshot} />
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">과거 데이터</h1>
        <p className="text-muted-foreground tabular text-sm">
          {formatDateDot(series[0].date)} ~ {formatDateDot(series[series.length - 1].date)} · 총{" "}
          {series.length.toLocaleString("ko-KR")}거래일
        </p>
      </div>

      <Section id="chart" title="지수 추이" className="mt-8">
        <Panel>
          <HistoryChart points={toChartPoints(series)} defaultPeriod="all" />
        </Panel>
      </Section>

      <Section id="daily" title="일별 데이터" description="세부 지표 점수는 0~100 (높을수록 탐욕)">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <nav aria-label="표 기간" className="bg-muted inline-flex rounded-lg p-[3px]">
            {TABLE_PERIODS.map((p) => (
              <Link
                key={p}
                href={`/history?period=${p}#daily`}
                scroll={false}
                aria-current={p === period ? "page" : undefined}
                className={cn(
                  "text-muted-foreground rounded-md px-3 py-1 text-sm font-medium",
                  p === period && "bg-background text-foreground shadow-sm",
                )}
              >
                {PERIOD_LABELS[p]}
              </Link>
            ))}
          </nav>
          <div className="flex flex-wrap gap-2">
            {(["1y", "all"] as const).map((p) => (
              <Button key={p} variant="outline" size="sm" asChild>
                <a href={`/api/fear-greed/history?period=${p}&format=csv`} download>
                  <Download aria-hidden />
                  CSV ({PERIOD_LABELS[p]})
                </a>
              </Button>
            ))}
          </div>
        </div>
        <Panel className="p-0 sm:p-2">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">날짜</TableHead>
                <TableHead className="text-right">지수</TableHead>
                <TableHead>등급</TableHead>
                <TableHead className="text-right">KOSPI</TableHead>
                {FACTOR_ORDER.map((k) => (
                  <TableHead key={k} className="text-right">
                    {FACTOR_META[k].shortLabel}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {daily.map((d) => (
                <TableRow key={d.date}>
                  <TableCell className="tabular pl-4">{formatDateDot(d.date)}</TableCell>
                  <TableCell className="text-right">
                    <ScoreDot score={d.score} />
                  </TableCell>
                  <TableCell className="text-muted-foreground">{d.classification}</TableCell>
                  <TableCell className="tabular text-right">{formatNumber(d.kospiClose, 2)}</TableCell>
                  {FACTOR_ORDER.map((k) => {
                    const v = getFactorScore(d, k);
                    return (
                      <TableCell key={k} className="tabular text-muted-foreground text-right">
                        {v === null ? "–" : Math.round(v)}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Panel>
      </Section>

      <Section id="monthly" title="월별 요약">
        <Panel className="p-0 sm:p-2">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">월</TableHead>
                <TableHead className="text-right">평균</TableHead>
                <TableHead>평균 등급</TableHead>
                <TableHead className="text-right">최저</TableHead>
                <TableHead className="text-right">최고</TableHead>
                <TableHead className="text-right">월말 KOSPI</TableHead>
                <TableHead className="text-right">월간 수익률</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {months.map((m) => (
                <TableRow key={m.month}>
                  <TableCell className="tabular pl-4">{m.month.replace("-", ".")}</TableCell>
                  <TableCell className="text-right">
                    <ScoreDot score={m.avg} />
                  </TableCell>
                  <TableCell className="text-muted-foreground">{classify(m.avg)}</TableCell>
                  <TableCell className="tabular text-right">{m.min}</TableCell>
                  <TableCell className="tabular text-right">{m.max}</TableCell>
                  <TableCell className="tabular text-right">{formatNumber(m.kospiClose, 2)}</TableCell>
                  <TableCell
                    className={cn("tabular text-right", m.kospiReturn !== null && deltaColorClass(m.kospiReturn))}
                  >
                    {m.kospiReturn === null ? "–" : formatSignedPct(m.kospiReturn)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Panel>
      </Section>

      <Section id="heatmap" title="최근 1년 히트맵">
        <Panel>
          <SentimentHeatmap days={toHeatmapDays(series)} />
        </Panel>
      </Section>
    </>
  );
}
