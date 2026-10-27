"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { FactorCardModel } from "@/lib/ui/view-models";
import { deltaArrow, deltaColorClass, sentimentColor } from "@/lib/ui/sentiment";
import { formatSignedInt } from "@/lib/utils/format";
import { cn } from "@/lib/utils";

const pct = (w: number) => `${Math.round(w * 1000) / 10}%`;

function ScoreBar({ score }: { score: number }) {
  return (
    <div className="relative h-1.5 w-full rounded-full" aria-hidden>
      <div className="absolute inset-0 flex gap-[2px] overflow-hidden rounded-full opacity-35">
        {["extreme-fear", "fear", "neutral", "greed", "extreme-greed"].map((k) => (
          <div key={k} className="h-full flex-1" style={{ backgroundColor: `var(--sentiment-${k})` }} />
        ))}
      </div>
      <div
        className="border-card absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2"
        style={{ left: `${score}%`, backgroundColor: sentimentColor(score) }}
      />
    </div>
  );
}

function WeightLabel({ card }: { card: FactorCardModel }) {
  if (card.appliedWeight === null) return <span>가중치 {pct(card.baseWeight)} · 제외됨</span>;
  const changed = Math.abs(card.appliedWeight - card.baseWeight) > 0.0005;
  return (
    <span>
      가중치 {pct(card.baseWeight)}
      {changed && <> → {pct(card.appliedWeight)}</>}
    </span>
  );
}

function FactorCard({ card }: { card: FactorCardModel }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          className={cn(
            "bg-card hover:border-foreground/25 focus-visible:ring-ring/50 group flex h-full flex-col gap-3 rounded-xl border p-3 text-left sm:p-4 transition-colors outline-none focus-visible:ring-[3px]",
            !card.available && "opacity-70",
          )}
          aria-label={`${card.label} 상세 계산 방법 보기`}
        >
          <div className="flex w-full items-start justify-between gap-2">
            <span className="text-sm font-medium">{card.label}</span>
            <ChevronRight className="text-muted-foreground group-hover:text-foreground size-4 shrink-0 transition-colors" aria-hidden />
          </div>

          {card.available && card.score !== null ? (
            <>
              <div className="flex flex-wrap items-baseline gap-x-2">
                <span className="tabular text-3xl font-bold tracking-tight">{card.score}</span>
                <span className="text-muted-foreground text-xs sm:text-sm">{card.classification}</span>
                {card.change5d !== null && (
                  <span className={cn("tabular ml-auto text-xs font-medium whitespace-nowrap", deltaColorClass(card.change5d))}>
                    <span className="text-muted-foreground mr-1 font-normal">1주</span>
                    <span className="sr-only">전 대비 </span>
                    <span aria-hidden>{deltaArrow(card.change5d)}</span>
                    {formatSignedInt(card.change5d)}
                  </span>
                )}
              </div>
              <ScoreBar score={card.score} />
              <dl className="mt-1 hidden flex-col gap-1 text-xs sm:flex">
                {card.lines.slice(0, 4).map((l) => (
                  <div key={l.label} className="flex justify-between gap-2">
                    <dt className="text-muted-foreground">{l.label}</dt>
                    <dd className="tabular font-medium">{l.value}</dd>
                  </div>
                ))}
              </dl>
            </>
          ) : (
            <p className="text-muted-foreground text-sm">데이터 없음 — 이번 산출에서 제외</p>
          )}

          <div className="text-muted-foreground mt-auto flex items-center justify-between border-t pt-2 text-xs">
            <WeightLabel card={card} />
          </div>
        </button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <DialogTitle>{card.label}</DialogTitle>
            <Badge variant="secondary">가중치 {pct(card.baseWeight)}</Badge>
          </div>
          <DialogDescription>{card.summary}</DialogDescription>
        </DialogHeader>

        {card.score !== null && (
          <div className="bg-muted/50 flex items-center gap-4 rounded-lg p-3">
            <span className="tabular text-2xl font-bold">{card.score}</span>
            <div className="flex flex-1 flex-col gap-1.5">
              <span className="text-sm">{card.classification}</span>
              <ScoreBar score={card.score} />
            </div>
          </div>
        )}

        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold">계산 방법</h3>
          <ol className="text-muted-foreground list-decimal space-y-1 pl-5 text-sm">
            {card.method.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ol>
        </section>

        <section className="grid gap-2 text-sm sm:grid-cols-2">
          <div className="rounded-lg border p-3">
            <p className="text-muted-foreground mb-1 flex items-center gap-1.5 text-xs">
              <span className="size-2 rounded-full bg-[var(--sentiment-fear)]" aria-hidden />
              낮은 점수 (공포)
            </p>
            <p>{card.fearMeaning}</p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-muted-foreground mb-1 flex items-center gap-1.5 text-xs">
              <span className="size-2 rounded-full bg-[var(--sentiment-greed)]" aria-hidden />
              높은 점수 (탐욕)
            </p>
            <p>{card.greedMeaning}</p>
          </div>
        </section>

        {card.lines.length > 0 && (
          <section className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold">현재 데이터</h3>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
              {card.lines.map((l) => (
                <div key={l.label} className="flex justify-between gap-2 border-b py-1">
                  <dt className="text-muted-foreground">{l.label}</dt>
                  <dd className="tabular font-medium">{l.value}</dd>
                </div>
              ))}
            </dl>
          </section>
        )}

        <p className="text-muted-foreground text-xs leading-relaxed">
          모든 원천 지표는 과거 최대 5년 분포 대비 percentile(양쪽 1% winsorization)로 0~100 정규화됩니다.{" "}
          {card.fallback}
        </p>
      </DialogContent>
    </Dialog>
  );
}

export function FactorCards({ cards }: { cards: FactorCardModel[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {cards.map((c) => (
        <FactorCard key={c.key} card={c} />
      ))}
      <Link
        href="/methodology"
        className="bg-muted/40 hover:border-foreground/25 group flex h-full flex-col justify-between gap-3 rounded-xl border border-dashed p-3 text-left transition-colors sm:p-4"
      >
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium">종합 점수 산출</span>
          <ul className="text-muted-foreground flex flex-col gap-0.5 text-xs">
            {cards.map((c) => (
              <li key={c.key} className="flex justify-between gap-2">
                <span>{c.label}</span>
                <span className="tabular">{pct(c.baseWeight)}</span>
              </li>
            ))}
          </ul>
        </div>
        <span className="text-muted-foreground group-hover:text-foreground flex items-center gap-1 text-xs">
          산출 방법 자세히 <ChevronRight className="size-3.5" aria-hidden />
        </span>
      </Link>
    </div>
  );
}
