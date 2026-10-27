"use client";

import { useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from "recharts";
import type { NameType, ValueType } from "recharts/types/component/DefaultTooltipContent";
import { classify } from "@/lib/fear-greed/classify";
import { PERIOD_LABELS, PERIODS, periodStartDate, type Period } from "@/lib/fear-greed/analytics";
import type { ChartPoint } from "@/lib/ui/view-models";
import { SENTIMENT_BANDS, sentimentColor } from "@/lib/ui/sentiment";
import { formatDateDot, formatInt, formatNumber } from "@/lib/utils/format";
import { cn } from "@/lib/utils";

const MAX_POINTS = 520;

/** 긴 기간은 균등 간격으로 샘플링 (마지막 데이터는 항상 포함) */
function downsample(points: ChartPoint[]): ChartPoint[] {
  if (points.length <= MAX_POINTS) return points;
  const step = Math.ceil(points.length / MAX_POINTS);
  const out = points.filter((_, i) => i % step === 0);
  if (out.at(-1) !== points.at(-1)) out.push(points[points.length - 1]);
  return out;
}

/** 경계(월/분기/연) 첫 거래일을 눈금으로 사용해 라벨 중복을 막는다 */
function boundaryTicks(data: ChartPoint[], period: Period): string[] {
  const key = (d: string) => {
    if (period === "1m") return d.slice(0, 10); // 매 거래일 → minTickGap으로 솎음
    if (period === "3m" || period === "6m" || period === "1y") return d.slice(0, 7);
    if (period === "3y") {
      const q = Math.floor((Number(d.slice(5, 7)) - 1) / 3);
      return `${d.slice(0, 4)}-${q}`;
    }
    return d.slice(0, 4);
  };
  const ticks: string[] = [];
  let prev = "";
  for (const p of data) {
    const k = key(p.d);
    if (k !== prev) {
      if (prev !== "") ticks.push(p.d); // 잘린 첫 구간은 제외
      prev = k;
    }
  }
  return ticks;
}

function tickFormatter(period: Period) {
  return (d: string) =>
    period === "1m"
      ? `${d.slice(5, 7)}.${d.slice(8, 10)}`
      : period === "all"
        ? d.slice(0, 4)
        : `${d.slice(2, 4)}.${d.slice(5, 7)}`;
}

function ChartTooltip({ active, payload }: TooltipContentProps<ValueType, NameType>) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload as ChartPoint;
  return (
    <div className="bg-popover text-popover-foreground min-w-40 rounded-md border px-3 py-2 text-xs shadow-md">
      <p className="text-muted-foreground mb-1.5 font-medium">{formatDateDot(p.d)}</p>
      <div className="flex items-center justify-between gap-4">
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full" style={{ backgroundColor: sentimentColor(p.s) }} aria-hidden />
          공포·탐욕
        </span>
        <span className="tabular font-semibold">{p.s}</span>
      </div>
      <div className="flex items-center justify-between gap-4">
        <span className="text-muted-foreground pl-3.5">등급</span>
        <span>{classify(p.s)}</span>
      </div>
      <div className="mt-1 flex items-center justify-between gap-4 border-t pt-1">
        <span>KOSPI 종가</span>
        <span className="tabular font-semibold">{formatNumber(p.k, 2)}</span>
      </div>
    </div>
  );
}

export function HistoryChart({
  points,
  defaultPeriod = "1y",
  syncId = "fg-history",
}: {
  points: ChartPoint[];
  defaultPeriod?: Period;
  syncId?: string;
}) {
  const [period, setPeriod] = useState<Period>(defaultPeriod);

  const data = useMemo(() => {
    const latest = points.at(-1);
    if (!latest) return [];
    const start = periodStartDate(latest.d, period);
    return downsample(start ? points.filter((p) => p.d > start) : points);
  }, [points, period]);

  const fmt = tickFormatter(period);
  const ticks = useMemo(() => boundaryTicks(data, period), [data, period]);
  const axisTick = { fill: "var(--chart-axis)", fontSize: 11 };

  return (
    <div className="flex flex-col gap-3">
      <div role="radiogroup" aria-label="기간 선택" className="bg-muted inline-flex w-full rounded-lg p-[3px] sm:w-fit">
        {PERIODS.map((p) => (
          <button
            key={p}
            type="button"
            role="radio"
            aria-checked={period === p}
            onClick={() => setPeriod(p)}
            className={cn(
              "text-muted-foreground flex-1 rounded-md px-3 py-1 text-sm font-medium transition-colors sm:flex-none",
              period === p && "bg-background text-foreground shadow-sm",
            )}
          >
            {PERIOD_LABELS[p]}
          </button>
        ))}
      </div>

      {/* 상단: 공포·탐욕지수 (0~100) + 구간 배경 */}
      <div>
        <p className="text-muted-foreground mb-1 text-xs font-medium">공포·탐욕지수 (0~100)</p>
        <div className="h-[220px] sm:h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} syncId={syncId} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
              {SENTIMENT_BANDS.map((b, i) => (
                <ReferenceArea
                  key={b.key}
                  y1={i === 0 ? 0 : b.min - 0.5}
                  y2={i === SENTIMENT_BANDS.length - 1 ? 100 : b.max + 0.5}
                  fill={b.color}
                  fillOpacity={0.13}
                  stroke="none"
                  ifOverflow="visible"
                  label={{
                    value: b.label,
                    position: "insideTopRight",
                    fill: "var(--chart-axis)",
                    fontSize: 10,
                  }}
                />
              ))}
              <CartesianGrid vertical={false} stroke="var(--chart-grid)" strokeDasharray="0" strokeOpacity={0.6} />
              <XAxis dataKey="d" ticks={ticks} hide />
              <YAxis
                domain={[0, 100]}
                ticks={[0, 20, 40, 60, 80, 100]}
                tick={axisTick}
                tickLine={false}
                axisLine={false}
                width={52}
              />
              <Tooltip
                content={ChartTooltip}
                cursor={{ stroke: "var(--chart-axis)", strokeWidth: 1 }}
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="s"
                name="공포·탐욕지수"
                stroke="var(--chart-line)"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, stroke: "var(--card)", strokeWidth: 2 }}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 하단: KOSPI 지수 (동일 X축, 별도 스케일) */}
      <div>
        <p className="text-muted-foreground mb-1 text-xs font-medium">KOSPI 종가</p>
        <div className="h-[120px] sm:h-[140px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} syncId={syncId} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid vertical={false} stroke="var(--chart-grid)" strokeOpacity={0.6} />
              <XAxis
                dataKey="d"
                ticks={ticks}
                interval="preserveStartEnd"
                tickFormatter={fmt}
                tick={axisTick}
                tickLine={false}
                axisLine={false}
                minTickGap={28}
              />
              <YAxis
                domain={["auto", "auto"]}
                tick={axisTick}
                tickLine={false}
                axisLine={false}
                width={52}
                tickFormatter={(v: number) => formatInt(v)}
                tickCount={4}
              />
              <Tooltip content={() => null} cursor={{ stroke: "var(--chart-axis)", strokeWidth: 1 }} />
              <Line
                type="monotone"
                dataKey="k"
                name="KOSPI"
                stroke="var(--chart-secondary-line)"
                strokeWidth={1.5}
                dot={false}
                activeDot={{ r: 3, stroke: "var(--card)", strokeWidth: 2 }}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
