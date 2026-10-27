import { getFearGreedSnapshot } from "@/lib/data/fear-greed-service";
import { errorResponse, jsonResponse, snapshotMeta } from "@/lib/data/api";
import { explainDay } from "@/lib/fear-greed/explain";
import { toFactorCards } from "@/lib/ui/view-models";

/** GET /api/fear-greed/factors — 7개 Factor 상세 + 규칙 기반 설명 */
export async function GET() {
  try {
    const snapshot = await getFearGreedSnapshot();
    const explanation = explainDay(snapshot.latest);
    return jsonResponse({
      date: snapshot.latest.date,
      score: snapshot.latest.score,
      factors: toFactorCards(snapshot.series).map((c) => ({
        key: c.key,
        label: c.label,
        score: c.score,
        classification: c.classification,
        weight: c.baseWeight,
        appliedWeight: c.appliedWeight,
        change1w: c.change5d,
        data: c.lines,
        method: c.method,
        available: c.available,
      })),
      explanation,
      providers: snapshot.providers.map((p) => ({
        slot: p.slot,
        name: p.info.name,
        kind: p.info.kind,
        source: p.info.source,
        state: p.state,
        lastDate: p.lastDate,
      })),
      updatedAt: snapshot.generatedAt,
      ...snapshotMeta(snapshot),
    });
  } catch (err) {
    return errorResponse(503, "지표 데이터를 불러올 수 없습니다.", err instanceof Error ? err.message : undefined);
  }
}
