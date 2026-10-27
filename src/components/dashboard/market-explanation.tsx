import type { MarketExplanation as Explanation } from "@/lib/fear-greed/explain";
import { cn } from "@/lib/utils";

/** "왜 오늘 공포인가?" — 규칙 기반 설명 + 주요 영향 요인 */
export function MarketExplanation({ explanation }: { explanation: Explanation }) {
  const maxAbs = Math.max(1, ...explanation.topContributors.map((c) => Math.abs(c.contribution)));

  return (
    <div className="grid gap-6 md:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
      <div className="flex flex-col gap-3 leading-relaxed">
        <p className="font-medium">{explanation.headline}</p>
        {explanation.paragraphs.map((p) => (
          <p key={p} className="text-muted-foreground">
            {p}
          </p>
        ))}
      </div>

      <div className="flex flex-col gap-3">
        <p className="text-muted-foreground text-xs font-medium">점수에 가장 큰 영향을 준 요인 (중립 50 대비 기여 포인트)</p>
        <ul className="flex flex-col gap-3">
          {explanation.topContributors.map((c) => {
            const negative = c.contribution < 0;
            const width = `${(Math.abs(c.contribution) / maxAbs) * 50}%`;
            return (
              <li key={c.key} className="flex flex-col gap-1">
                <div className="flex justify-between text-sm">
                  <span>{c.label}</span>
                  <span className="tabular font-medium">
                    {c.contribution > 0 ? "+" : c.contribution < 0 ? "−" : ""}
                    {Math.abs(c.contribution).toFixed(1)}p
                  </span>
                </div>
                {/* 가운데(0)를 기준으로 왼쪽=공포 방향, 오른쪽=탐욕 방향 */}
                <div className="bg-muted relative h-2 rounded-full" aria-hidden>
                  <div className="bg-border absolute top-[-2px] left-1/2 h-3 w-px" />
                  <div
                    className={cn("absolute top-0 h-2", negative ? "right-1/2 rounded-l-full" : "left-1/2 rounded-r-full")}
                    style={{
                      width,
                      backgroundColor: negative ? "var(--sentiment-extreme-fear)" : "var(--sentiment-extreme-greed)",
                    }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
        <div className="text-muted-foreground flex justify-between text-[11px]">
          <span>← 공포 방향</span>
          <span>탐욕 방향 →</span>
        </div>
      </div>
    </div>
  );
}
