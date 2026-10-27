"use client";

import { useMemo, useState } from "react";
import { classify } from "@/lib/fear-greed/classify";
import { FACTOR_META, FACTOR_ORDER } from "@/lib/fear-greed/factor-meta";
import type { HeatmapDay } from "@/lib/ui/view-models";
import { SENTIMENT_BANDS, sentimentColor } from "@/lib/ui/sentiment";
import { formatDateDot, formatNumber } from "@/lib/utils/format";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["월", "화", "수", "목", "금"];

interface MonthBlock {
  key: string;
  label: string;
  /** 주 단위 행, 각 행은 월~금 5칸 */
  weeks: (HeatmapDay | "empty" | null)[][];
}

/** 날짜 문자열의 요일 (0=일) — 타임존 영향을 받지 않도록 UTC로 계산 */
function weekday(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

function daysInMonth(y: number, m: number) {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

function buildMonths(days: HeatmapDay[]): MonthBlock[] {
  const byDate = new Map(days.map((d) => [d.d, d]));
  const first = days[0]?.d ?? "";
  const last = days.at(-1)?.d ?? "";
  const months = Array.from(new Set(days.map((d) => d.d.slice(0, 7))));
  return months.map((ym) => {
    const [y, m] = ym.split("-").map(Number);
    const weeks: (HeatmapDay | "empty" | null)[][] = [];
    let row: (HeatmapDay | "empty" | null)[] = Array(5).fill(null);
    for (let day = 1; day <= daysInMonth(y, m); day++) {
      const iso = `${ym}-${String(day).padStart(2, "0")}`;
      const wd = weekday(iso);
      if (wd === 0 || wd === 6) continue;
      // 데이터 범위 밖(시작 이전·오늘 이후)은 빈 칸, 범위 안의 결측은 휴장일
      row[wd - 1] = iso < first || iso > last ? null : (byDate.get(iso) ?? "empty");
      if (wd === 5) {
        weeks.push(row);
        row = Array(5).fill(null);
      }
    }
    if (row.some((c) => c !== null)) weeks.push(row);
    return { key: ym, label: `${y}.${String(m).padStart(2, "0")}`, weeks };
  });
}

export function SentimentHeatmap({ days }: { days: HeatmapDay[] }) {
  const months = useMemo(() => buildMonths(days), [days]);
  const [selected, setSelected] = useState<HeatmapDay | null>(days.at(-1) ?? null);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs" aria-label="범례">
        {SENTIMENT_BANDS.map((b) => (
          <span key={b.key} className="text-muted-foreground flex items-center gap-1.5">
            <span className="size-3 rounded-[3px]" style={{ backgroundColor: b.color }} aria-hidden />
            {b.label}
            <span className="tabular opacity-70">
              {b.min}–{b.max}
            </span>
          </span>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="grid grid-cols-3 gap-x-3 gap-y-4 sm:grid-cols-4 sm:gap-x-4 md:grid-cols-6 lg:grid-cols-4 xl:grid-cols-6">
          {months.map((month) => (
            <div key={month.key} className="flex flex-col gap-1.5">
              <p className="text-muted-foreground tabular text-xs font-medium">{month.label}</p>
              <div className="grid grid-cols-5 gap-[3px]">
                {WEEKDAYS.map((w) => (
                  <span key={w} className="text-muted-foreground text-center text-[9px] leading-3">
                    {w}
                  </span>
                ))}
                {month.weeks.flatMap((week, wi) =>
                  week.map((cell, ci) => {
                    const k = `${month.key}-${wi}-${ci}`;
                    if (cell === null) return <span key={k} className="aspect-square" />;
                    if (cell === "empty")
                      return <span key={k} className="bg-muted/60 aspect-square rounded-[3px]" title="휴장/데이터 없음" />;
                    const isSel = selected?.d === cell.d;
                    return (
                      <button
                        key={k}
                        type="button"
                        onClick={() => setSelected(cell)}
                        aria-label={`${formatDateDot(cell.d)} ${cell.s}점 ${classify(cell.s)}`}
                        aria-pressed={isSel}
                        className={cn(
                          "focus-visible:ring-ring aspect-square rounded-[3px] outline-none focus-visible:ring-2",
                          isSel && "ring-foreground ring-2 ring-offset-1 ring-offset-[var(--card)]",
                        )}
                        style={{ backgroundColor: sentimentColor(cell.s) }}
                        title={`${formatDateDot(cell.d)} · ${cell.s} ${classify(cell.s)}`}
                      />
                    );
                  }),
                )}
              </div>
            </div>
          ))}
        </div>

        <aside aria-live="polite" className="bg-muted/40 order-first h-fit rounded-lg border p-4 lg:sticky lg:top-20 lg:order-none">
          {selected ? (
            <div className="flex flex-col gap-3">
              <div>
                <p className="text-muted-foreground tabular text-xs">{formatDateDot(selected.d)}</p>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="tabular text-3xl font-bold">{selected.s}</span>
                  <span className="flex items-center gap-1.5 text-sm">
                    <span className="size-2.5 rounded-full" style={{ backgroundColor: sentimentColor(selected.s) }} aria-hidden />
                    {classify(selected.s)}
                  </span>
                </div>
                <p className="text-muted-foreground mt-1 text-sm">
                  KOSPI <span className="text-foreground tabular font-medium">{formatNumber(selected.k, 2)}</span>
                </p>
              </div>
              <dl className="flex flex-col gap-1.5 border-t pt-3 text-sm">
                {FACTOR_ORDER.map((key, i) => {
                  const v = selected.f[i];
                  return (
                    <div key={key} className="flex items-center gap-2">
                      <dt className="text-muted-foreground w-20 shrink-0 text-xs">{FACTOR_META[key].shortLabel}</dt>
                      <dd className="flex flex-1 items-center gap-2">
                        <div className="bg-muted h-1.5 flex-1 overflow-hidden rounded-full" aria-hidden>
                          {v !== null && (
                            <div className="h-full rounded-full" style={{ width: `${v}%`, backgroundColor: sentimentColor(v) }} />
                          )}
                        </div>
                        <span className="tabular w-8 text-right text-xs font-medium">
                          {v === null ? "–" : Math.round(v)}
                        </span>
                      </dd>
                    </div>
                  );
                })}
              </dl>
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">날짜를 선택하세요.</p>
          )}
        </aside>
      </div>
    </div>
  );
}
