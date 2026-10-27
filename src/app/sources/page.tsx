import type { Metadata } from "next";
import { Panel, Section } from "@/components/dashboard/section";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getFearGreedSnapshot, type ProviderState } from "@/lib/data/fear-greed-service";
import { FACTOR_META } from "@/lib/fear-greed/factor-meta";
import type { ProviderKind } from "@/lib/providers/types";
import { formatKstDateTime } from "@/lib/utils/date";
import { formatDateDot } from "@/lib/utils/format";

export const metadata: Metadata = {
  title: "데이터 출처",
  description: "KOSPI 공포·탐욕지수 산출에 사용하는 데이터 출처와 연결 상태",
  alternates: { canonical: "/sources" },
};

export const revalidate = 600;

const KIND_LABEL: Record<ProviderKind, string> = {
  live: "실데이터",
  mock: "데모",
  file: "파일",
  unconfigured: "미연결",
};

const STATE_LABEL: Record<ProviderState, string> = {
  ok: "정상",
  error: "지연/오류",
  unconfigured: "미연결",
};

/** live 모드에서 사용하는 공식 데이터 소스 (README와 동일) */
const LIVE_SOURCES = [
  {
    factor: "시장 모멘텀 (KOSPI 종가)",
    source: "KRX Open API — KOSPI 시리즈 일별시세",
    endpoint: "idx/kospi_dd_trd",
    status: "구현됨",
  },
  {
    factor: "변동성 (VKOSPI)",
    source: "KRX Open API — 파생상품지수 일별시세",
    endpoint: "idx/drvprod_dd_trd",
    status: "구현됨",
  },
  {
    factor: "시장 폭 (상승·하락 종목 수)",
    source: "KRX Open API — 유가증권 일별매매정보 등락률 집계",
    endpoint: "sto/stk_bydd_trd",
    status: "구현됨",
  },
  {
    factor: "외국인 수급",
    source: "KRX Open API 미제공 — CSV 파일(FOREIGN_FLOW_CSV) 또는 라이선스 데이터 API",
    endpoint: "—",
    status: "실제 데이터 소스 연결 필요",
  },
  {
    factor: "시장 강도 (52주 신고가·신저가)",
    source: "KRX Open API — 유가증권 일별매매정보 종목별 고가/저가로 직접 집계",
    endpoint: "sto/stk_bydd_trd",
    status: "구현됨",
  },
  {
    factor: "Put/Call 비율",
    source: "KRX Open API — 옵션 일별매매정보 (KOSPI200 옵션 거래량)",
    endpoint: "drv/opt_bydd_trd",
    status: "구현됨 (응답 값 표기 검증 필요)",
  },
  {
    factor: "위험선호도 (KOSDAQ·규모별 지수)",
    source: "KRX Open API — KOSDAQ/KOSPI 시리즈 일별시세",
    endpoint: "idx/kosdaq_dd_trd, idx/kospi_dd_trd",
    status: "구현됨",
  },
];

export default async function SourcesPage() {
  const snapshot = await getFearGreedSnapshot();

  return (
    <article className="flex flex-col">
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">데이터 출처</h1>
      <p className="text-muted-foreground mt-3 max-w-3xl leading-relaxed">
        현재 모드:{" "}
        <strong className="text-foreground">
          {snapshot.effectiveMode === "demo" ? "데모 (시뮬레이션 데이터)" : "라이브 (실데이터)"}
        </strong>
        {" · "}마지막 계산 {formatKstDateTime(snapshot.generatedAt)}
      </p>

      <Section id="status" title="현재 사용 중인 데이터">
        <Panel className="p-0 sm:p-2">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">지표</TableHead>
                <TableHead>Provider</TableHead>
                <TableHead>유형</TableHead>
                <TableHead>상태</TableHead>
                <TableHead>최근 데이터</TableHead>
                <TableHead>출처</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {snapshot.providers.map((p) => (
                <TableRow key={p.slot}>
                  <TableCell className="pl-4 font-medium">{FACTOR_META[p.factor].label}</TableCell>
                  <TableCell>{p.info.name}</TableCell>
                  <TableCell>
                    <Badge variant={p.info.kind === "live" ? "default" : "secondary"}>{KIND_LABEL[p.info.kind]}</Badge>
                  </TableCell>
                  <TableCell className={p.state === "ok" ? "" : "text-muted-foreground"}>{STATE_LABEL[p.state]}</TableCell>
                  <TableCell className="tabular">{p.lastDate ? formatDateDot(p.lastDate) : "–"}</TableCell>
                  <TableCell className="text-muted-foreground max-w-[360px] whitespace-normal">
                    {p.info.sourceUrl ? (
                      <a href={p.info.sourceUrl} className="underline underline-offset-4" rel="noopener noreferrer" target="_blank">
                        {p.info.source}
                      </a>
                    ) : (
                      p.info.source
                    )}
                    {p.info.note && <span className="block text-xs">{p.info.note}</span>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Panel>
        {snapshot.providers.length === 0 && (
          <p className="text-muted-foreground text-sm">저장된 마지막 정상 데이터를 표시 중이라 Provider 상태 정보가 없습니다.</p>
        )}
      </Section>

      <Section
        id="live-sources"
        title="라이브 모드 데이터 소스"
        description="DATA_MODE=live 일 때 사용하는 공식·합법적 데이터 소스입니다."
      >
        <Panel className="p-0 sm:p-2">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">지표</TableHead>
                <TableHead>출처</TableHead>
                <TableHead>KRX 서비스</TableHead>
                <TableHead>상태</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {LIVE_SOURCES.map((s) => (
                <TableRow key={s.factor}>
                  <TableCell className="pl-4 font-medium">{s.factor}</TableCell>
                  <TableCell className="text-muted-foreground whitespace-normal">{s.source}</TableCell>
                  <TableCell className="font-mono text-xs">{s.endpoint}</TableCell>
                  <TableCell className="whitespace-normal">{s.status}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Panel>
        <ul className="text-muted-foreground list-disc space-y-1 pl-5 text-sm leading-relaxed">
          <li>
            한국거래소 KRX Open API(
            <a href="https://openapi.krx.co.kr" className="underline underline-offset-4" rel="noopener noreferrer" target="_blank">
              openapi.krx.co.kr
            </a>
            )는 회원가입 후 발급한 인증키로 서비스별 이용 신청·승인을 받아 사용하는 공식 API입니다. 전 거래일 종가까지의 일별
            데이터를 제공합니다.
          </li>
          <li>이용약관을 위반하는 무단 크롤링은 하지 않으며, 과거 응답은 로컬에 캐시해 호출 횟수를 최소화합니다.</li>
          <li>데모 모드의 데이터는 결정론적 시뮬레이션으로 생성되며 실제 시장 데이터가 아닙니다.</li>
        </ul>
      </Section>
    </article>
  );
}
