import type { ExtremeEntry } from "@/lib/fear-greed/analytics";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { deltaColorClass, sentimentColor } from "@/lib/ui/sentiment";
import { formatDateDot, formatNumber, formatSignedPct } from "@/lib/utils/format";
import { cn } from "@/lib/utils";

function ReturnCell({ value }: { value: number | null }) {
  if (value === null)
    return (
      <TableCell className="text-muted-foreground text-right" title="이후 데이터가 아직 없음">
        –
      </TableCell>
    );
  return <TableCell className={cn("tabular text-right", deltaColorClass(value))}>{formatSignedPct(value)}</TableCell>;
}

function ExtremesList({ rows }: { rows: ExtremeEntry[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-10">#</TableHead>
          <TableHead>날짜</TableHead>
          <TableHead className="text-right">지수</TableHead>
          <TableHead className="text-right">KOSPI</TableHead>
          <TableHead className="text-right">1개월 후</TableHead>
          <TableHead className="text-right">3개월 후</TableHead>
          <TableHead className="text-right">6개월 후</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r, i) => (
          <TableRow key={r.date}>
            <TableCell className="text-muted-foreground tabular">{i + 1}</TableCell>
            <TableCell className="tabular">{formatDateDot(r.date)}</TableCell>
            <TableCell className="text-right">
              <span className="tabular inline-flex items-center gap-1.5 font-semibold">
                <span className="size-2 rounded-full" style={{ backgroundColor: sentimentColor(r.score) }} aria-hidden />
                {r.score}
              </span>
            </TableCell>
            <TableCell className="tabular text-right">{formatNumber(r.kospiClose, 2)}</TableCell>
            <ReturnCell value={r.return1m} />
            <ReturnCell value={r.return3m} />
            <ReturnCell value={r.return6m} />
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export function ExtremesTable({ fear, greed }: { fear: ExtremeEntry[]; greed: ExtremeEntry[] }) {
  return (
    <Tabs defaultValue="fear" className="gap-3">
      <TabsList>
        <TabsTrigger value="fear">극도의 공포였던 날</TabsTrigger>
        <TabsTrigger value="greed">극도의 탐욕이었던 날</TabsTrigger>
      </TabsList>
      <TabsContent value="fear">
        <ExtremesList rows={fear} />
      </TabsContent>
      <TabsContent value="greed">
        <ExtremesList rows={greed} />
      </TabsContent>
      <p className="text-muted-foreground text-xs leading-relaxed">
        이후 수익률은 해당일 KOSPI 종가 대비 21·63·126거래일 뒤 종가 기준이며, 아직 그 기간이 지나지 않은 경우 “–”로
        표시합니다. 같은 국면이 반복 집계되지 않도록 선택된 날짜 전후 20거래일은 제외했습니다. 과거 성과는 미래 수익을
        보장하지 않습니다.
      </p>
    </Tabs>
  );
}
