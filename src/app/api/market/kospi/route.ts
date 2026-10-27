import type { NextRequest } from "next/server";
import { z } from "zod";
import { getFearGreedSnapshot } from "@/lib/data/fear-greed-service";
import { errorResponse, jsonResponse, snapshotMeta } from "@/lib/data/api";
import { filterByPeriod, PERIODS } from "@/lib/fear-greed/analytics";

const QuerySchema = z.object({ period: z.enum(PERIODS).default("1y") });

/** GET /api/market/kospi?period=1y — KOSPI 종가 시계열 */
export async function GET(request: NextRequest) {
  const parsed = QuerySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) {
    return errorResponse(400, "잘못된 요청 파라미터입니다.", z.flattenError(parsed.error).fieldErrors);
  }

  try {
    const snapshot = await getFearGreedSnapshot();
    const rows = filterByPeriod(snapshot.series, parsed.data.period);
    const first = rows[0];
    const last = rows.at(-1);
    return jsonResponse({
      period: parsed.data.period,
      latest: last ? { date: last.date, close: last.kospiClose } : null,
      change:
        first && last
          ? Math.round((last.kospiClose / first.kospiClose - 1) * 10000) / 100
          : null,
      data: rows.map((d) => ({ date: d.date, close: d.kospiClose })),
      updatedAt: snapshot.generatedAt,
      ...snapshotMeta(snapshot),
    });
  } catch (err) {
    return errorResponse(503, "KOSPI 데이터를 불러올 수 없습니다.", err instanceof Error ? err.message : undefined);
  }
}
