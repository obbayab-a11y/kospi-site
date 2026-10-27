import type { NextRequest } from "next/server";
import { z } from "zod";
import { getFearGreedSnapshot } from "@/lib/data/fear-greed-service";
import { errorResponse, jsonResponse, serializeFactors, snapshotMeta } from "@/lib/data/api";
import { filterByPeriod, PERIODS } from "@/lib/fear-greed/analytics";

const QuerySchema = z.object({
  period: z.enum(PERIODS).default("1y"),
  factors: z
    .enum(["true", "false", "1", "0"])
    .optional()
    .transform((v) => v === "true" || v === "1"),
  format: z.enum(["json", "csv"]).default("json"),
});

const CSV_HEADER =
  "date,score,classification,kospiClose,momentum,volatility,breadth,foreignFlow,marketStrength,putCall,riskAppetite";

/**
 * GET /api/fear-greed/history?period=1y[&factors=true]
 * period: 1m | 3m | 6m | 1y | 3y | all
 * format: json (기본) | csv
 */
export async function GET(request: NextRequest) {
  const parsed = QuerySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) {
    return errorResponse(400, "잘못된 요청 파라미터입니다.", z.flattenError(parsed.error).fieldErrors);
  }
  const { period, factors, format } = parsed.data;

  try {
    const snapshot = await getFearGreedSnapshot();
    if (format === "csv") {
      const n = (v: number | null) => (v === null ? "" : String(v));
      const lines = filterByPeriod(snapshot.series, period).map((d) =>
        [
          d.date,
          d.score,
          d.classification,
          d.kospiClose,
          n(d.momentumScore),
          n(d.volatilityScore),
          n(d.breadthScore),
          n(d.foreignFlowScore),
          n(d.marketStrengthScore),
          n(d.putCallScore),
          n(d.riskAppetiteScore),
        ].join(","),
      );
      return new Response("\uFEFF" + [CSV_HEADER, ...lines].join("\n"), {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="kospi-fear-greed-${period}.csv"`,
          "Cache-Control": "public, s-maxage=600",
        },
      });
    }
    const rows = filterByPeriod(snapshot.series, period).map((d) => ({
      date: d.date,
      score: d.score,
      classification: d.classification,
      kospiClose: d.kospiClose,
      ...(factors ? { factors: serializeFactors(d) } : {}),
    }));
    return jsonResponse({
      period,
      count: rows.length,
      data: rows,
      updatedAt: snapshot.generatedAt,
      ...snapshotMeta(snapshot),
    });
  } catch (err) {
    return errorResponse(503, "과거 데이터를 불러올 수 없습니다.", err instanceof Error ? err.message : undefined);
  }
}
