/**
 * CSV 파일 기반 외국인 순매수 Provider.
 *
 * KRX Open API는 투자자별 매매동향을 제공하지 않는다. 대신 KRX 정보데이터시스템
 * (data.krx.co.kr) 등에서 이용약관에 따라 직접 내려받은 자료를 아래 형식의 CSV로
 * 저장하고 FOREIGN_FLOW_CSV 환경변수로 경로를 지정하면 이 Provider가 사용된다.
 *
 *   date,netBuy
 *   2026-10-14,-1234
 *   2026-10-15,567
 *
 * - date: yyyy-MM-dd 또는 yyyyMMdd
 * - netBuy: 외국인 KOSPI 순매수 금액 (억원, 순매도는 음수)
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import type { ForeignFlowObservation } from "../../fear-greed/types";
import { fromBasDd, toIsoDate } from "../../utils/date";
import { ProviderFetchError, type ForeignFlowProvider, type ProviderInfo } from "../types";

const RowSchema = z.object({
  date: z
    .string()
    .trim()
    .transform((v) => (/^\d{8}$/.test(v) ? fromBasDd(v) : v))
    .pipe(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
  netBuy: z.coerce.number().finite(),
});

export function parseForeignFlowCsv(text: string): ForeignFlowObservation[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return [];
  const header = lines[0].split(",").map((h) => h.trim());
  const di = header.indexOf("date");
  const ni = header.indexOf("netBuy");
  if (di < 0 || ni < 0) throw new Error("CSV 헤더에 date,netBuy 컬럼이 필요합니다.");

  const rows: ForeignFlowObservation[] = [];
  for (const line of lines.slice(1)) {
    const cols = line.split(",");
    const parsed = RowSchema.safeParse({ date: cols[di], netBuy: cols[ni]?.replaceAll('"', "") });
    if (parsed.success) rows.push(parsed.data);
  }
  return rows.sort((a, b) => a.date.localeCompare(b.date));
}

export class CsvForeignFlowProvider implements ForeignFlowProvider {
  readonly info: ProviderInfo;

  constructor(private readonly filePath: string) {
    this.info = {
      id: "csv-foreign-flow",
      name: "외국인 순매수 (CSV)",
      kind: "file",
      source: `사용자 제공 CSV (${path.basename(filePath)})`,
      note: "KRX 정보데이터시스템 등에서 이용약관에 따라 직접 내려받은 자료",
    };
  }

  private async rows(): Promise<ForeignFlowObservation[]> {
    try {
      return parseForeignFlowCsv(await readFile(this.filePath, "utf8"));
    } catch (err) {
      throw new ProviderFetchError(this.info.name, err);
    }
  }

  async getCurrent() {
    const last = (await this.rows()).at(-1);
    if (!last) throw new ProviderFetchError(this.info.name, "데이터 없음");
    return last;
  }

  async getHistory(start: Date, end: Date) {
    const s = toIsoDate(start);
    const e = toIsoDate(end);
    return (await this.rows()).filter((r) => r.date >= s && r.date <= e);
  }
}
