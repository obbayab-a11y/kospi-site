import type { Metadata } from "next";
import { Panel, Section } from "@/components/dashboard/section";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CLASSIFICATION_BANDS } from "@/lib/fear-greed/classify";
import { FACTOR_META, FACTOR_ORDER } from "@/lib/fear-greed/factor-meta";
import { SENTIMENT_COLOR } from "@/lib/ui/sentiment";
import { DISCLAIMER } from "@/lib/site";

export const metadata: Metadata = {
  title: "산출 방법",
  description: "KOSPI 공포·탐욕지수를 구성하는 7개 지표와 정규화·가중 평균 계산 방법을 설명합니다.",
  alternates: { canonical: "/methodology" },
};

const pct = (w: number) => `${Math.round(w * 100)}%`;

export default function MethodologyPage() {
  return (
    <article className="flex max-w-3xl flex-col">
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">산출 방법</h1>
      <p className="text-muted-foreground mt-3 leading-relaxed">
        KOSPI 공포·탐욕지수는 한국 증시의 투자심리를 7개 지표로 측정해 0(극도의 공포)~100(극도의 탐욕) 점수로
        나타낸 자체 산출 지표입니다. 각 지표는 고정된 임계값이 아니라 <strong>과거 데이터 분포 대비 현재 위치</strong>로
        평가하므로, 시장 레짐이 바뀌어도 일관된 해석이 가능합니다.
      </p>

      <Section id="formula" title="최종 점수 공식">
        <Panel className="bg-muted/40 overflow-x-auto font-mono text-sm leading-7">
          <p>FearGreedIndex =</p>
          {FACTOR_ORDER.map((k, i) => (
            <p key={k} className="pl-4">
              {i > 0 ? "+ " : "  "}
              {FACTOR_META[k].label} × {FACTOR_META[k].weight.toFixed(2)}
            </p>
          ))}
          <p className="text-muted-foreground mt-2">→ Math.round() 후 0~100 범위로 clamp</p>
        </Panel>
        <ul className="text-muted-foreground list-disc space-y-1 pl-5 text-sm leading-relaxed">
          <li>
            데이터를 확보하지 못한 지표는 제외하고, 나머지 지표의 가중치를 <strong>원래 비율대로 재분배</strong>합니다.
            예를 들어 Put/Call(10%)이 빠지면 시장 모멘텀 가중치는 20% ÷ 90% ≈ 22.2%가 됩니다.
          </li>
          <li>기본 가중치 기준으로 50% 이상의 지표가 있어야 그날의 지수를 산출합니다.</li>
        </ul>
      </Section>

      <Section id="normalize" title="정규화: Rolling Percentile Rank">
        <div className="text-muted-foreground flex flex-col gap-3 text-sm leading-relaxed">
          <p>
            각 원천 지표의 현재 값이 <strong>최근 5년(1,260거래일)</strong> 분포에서 몇 번째 백분위에 위치하는지를 계산해
            점수로 사용합니다. 5년 데이터가 없으면 사용 가능한 가장 긴 기간을 사용하며, 최소 60개 표본이 필요합니다.
          </p>
          <Panel className="bg-muted/40 font-mono text-sm text-foreground">
            percentile = (현재값보다 작은 표본 수 + 같은 표본 수 × 0.5) ÷ 전체 표본 수 × 100
            <br />
            공포 방향 지표(변동성, Put/Call): score = 100 − percentile
          </Panel>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <strong>Winsorization</strong>: 현재 값을 분포의 1%~99% 분위 범위로 잘라 극단값 하나에 점수가 과도하게 흔들리지
              않도록 합니다.
            </li>
            <li>
              <strong>Look-ahead bias 없음</strong>: 각 날짜의 점수는 그날까지의 데이터만 사용해 계산하므로, 과거 점수가
              이후 데이터에 의해 바뀌지 않습니다.
            </li>
          </ul>
        </div>
      </Section>

      <Section id="bands" title="점수 구간">
        <Panel className="p-0 sm:p-2">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">점수</TableHead>
                <TableHead>상태</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {CLASSIFICATION_BANDS.map((b) => (
                <TableRow key={b.key}>
                  <TableCell className="tabular pl-4">
                    {b.min} ~ {b.max}
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex items-center gap-2">
                      <span className="size-2.5 rounded-full" style={{ backgroundColor: SENTIMENT_COLOR[b.key] }} aria-hidden />
                      {b.label}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Panel>
      </Section>

      <Section id="factors" title="7개 구성 지표">
        <div className="flex flex-col gap-4">
          {FACTOR_ORDER.map((k, i) => {
            const m = FACTOR_META[k];
            return (
              <Panel key={k} className="flex flex-col gap-3">
                <div className="flex items-baseline justify-between gap-2">
                  <h3 className="font-semibold">
                    {i + 1}. {m.label}
                  </h3>
                  <span className="text-muted-foreground tabular text-sm">가중치 {pct(m.weight)}</span>
                </div>
                <p className="text-muted-foreground text-sm">{m.summary}</p>
                <ol className="list-decimal space-y-1 pl-5 text-sm">
                  {m.method.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ol>
                <div className="grid gap-2 text-sm sm:grid-cols-2">
                  <p>
                    <span className="text-muted-foreground">탐욕 신호: </span>
                    {m.greedMeaning}
                  </p>
                  <p>
                    <span className="text-muted-foreground">공포 신호: </span>
                    {m.fearMeaning}
                  </p>
                </div>
                <p className="text-muted-foreground border-t pt-3 text-xs">{m.fallback}</p>
              </Panel>
            );
          })}
        </div>
      </Section>

      <Section id="explain" title="“왜 오늘 공포인가?” 설명 생성 방식">
        <p className="text-muted-foreground text-sm leading-relaxed">
          AI를 사용하지 않는 규칙 기반 설명입니다. 각 지표의 기여도를 <code>적용 가중치 × (지표 점수 − 50)</code>로
          계산하고, 전체 점수와 같은 방향으로 가장 크게 작용한 3개 지표를 골라 지표별 문장 템플릿과 실제 수치로 설명합니다.
          반대 방향으로 작용한 지표나 장기 추세(120일선) 정보가 있으면 “반면 …” 문장으로 덧붙입니다.
        </p>
      </Section>

      <p className="text-muted-foreground mt-12 text-sm">{DISCLAIMER}</p>
    </article>
  );
}
