import { Card } from "@/components/ui/card";
import type { ComparisonPoint } from "@/lib/fear-greed/analytics";
import { classify } from "@/lib/fear-greed/classify";
import type { FearGreedDaily } from "@/lib/fear-greed/types";
import { formatKstDateTime } from "@/lib/utils/date";
import { formatDateDot, formatNumber, formatSignedInt } from "@/lib/utils/format";
import { deltaArrow, deltaColorClass, sentimentColor } from "@/lib/ui/sentiment";
import { cn } from "@/lib/utils";
import { FearGreedGauge } from "./fear-greed-gauge";

function Delta({ value, className }: { value: number; className?: string }) {
  return (
    <span className={cn("tabular inline-flex items-center gap-0.5 font-medium", deltaColorClass(value), className)}>
      <span aria-hidden className="text-[0.7em]">
        {deltaArrow(value)}
      </span>
      {formatSignedInt(value)}
    </span>
  );
}

export function ScoreHero({
  latest,
  comparisons,
  generatedAt,
  headline,
}: {
  latest: FearGreedDaily;
  comparisons: ComparisonPoint[];
  generatedAt: string;
  headline: string;
}) {
  const yesterday = comparisons.find((c) => c.label === "어제");

  return (
    <section aria-labelledby="hero-title" className="flex flex-col gap-4">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <h1 id="hero-title" className="text-2xl font-bold tracking-tight sm:text-3xl">
          KOSPI 공포·탐욕지수
        </h1>
        <p className="text-muted-foreground tabular text-sm">
          {formatDateDot(latest.date)} 장 마감 기준 · {formatKstDateTime(generatedAt)} 업데이트
        </p>
      </div>

      <Card className="gap-0 overflow-hidden py-0">
        <div className="grid md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
          {/* 현재 점수 */}
          <div className="flex flex-col items-center px-6 pt-6 pb-6 sm:pt-8">
            <FearGreedGauge score={latest.score} />
            <div className="-mt-2 flex flex-col items-center gap-1">
              <div className="flex items-center gap-2">
                <span
                  className="size-3 rounded-full"
                  style={{ backgroundColor: sentimentColor(latest.score) }}
                  aria-hidden
                />
                <span className="text-lg font-semibold sm:text-xl">{latest.classification}</span>
              </div>
              <p className="tabular text-6xl leading-none font-bold tracking-tight sm:text-7xl" aria-label={`현재 점수 ${latest.score}`}>
                {latest.score}
              </p>
              {yesterday && (
                <p className="text-muted-foreground mt-2 text-sm">
                  전일 대비 <Delta value={yesterday.delta} className="text-base" />
                </p>
              )}
            </div>
          </div>

          {/* 비교 */}
          <div className="bg-muted/40 flex flex-col justify-center gap-4 border-t px-6 py-6 md:border-t-0 md:border-l">
            <ul className="grid grid-cols-3 gap-2 md:grid-cols-1 md:gap-0 md:divide-y">
              {comparisons.map((c) => (
                <li
                  key={c.label}
                  className="bg-card flex flex-col items-start gap-1 rounded-lg border p-3 md:flex-row md:items-center md:justify-between md:rounded-none md:border-0 md:bg-transparent md:px-0 md:py-3"
                >
                  <div className="flex flex-col">
                    <span className="text-muted-foreground text-xs md:text-sm">{c.label}</span>
                    <span className="text-muted-foreground hidden text-xs md:inline">{formatDateDot(c.date)}</span>
                  </div>
                  <div className="flex items-baseline gap-2 md:gap-3">
                    <span className="tabular text-xl font-semibold md:text-2xl">{c.score}</span>
                    <span className="text-muted-foreground hidden text-sm sm:inline">{classify(c.score)}</span>
                  </div>
                  <span className="text-xs md:w-16 md:text-right md:text-sm">
                    <Delta value={c.delta} />
                  </span>
                </li>
              ))}
            </ul>
            <p className="text-muted-foreground text-sm leading-relaxed">{headline}</p>
            <p className="text-muted-foreground tabular text-xs">
              KOSPI 종가 <span className="text-foreground font-medium">{formatNumber(latest.kospiClose, 2)}</span>
            </p>
          </div>
        </div>
      </Card>
    </section>
  );
}
