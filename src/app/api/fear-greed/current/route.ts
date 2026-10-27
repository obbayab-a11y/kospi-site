import { getFearGreedSnapshot } from "@/lib/data/fear-greed-service";
import { errorResponse, jsonResponse, serializeFactors, snapshotMeta } from "@/lib/data/api";
import { getComparisons } from "@/lib/fear-greed/analytics";

export async function GET() {
  try {
    const snapshot = await getFearGreedSnapshot();
    const { latest } = snapshot;
    return jsonResponse({
      score: latest.score,
      classification: latest.classification,
      date: latest.date,
      kospiClose: latest.kospiClose,
      factors: serializeFactors(latest),
      missingFactors: latest.missingFactors,
      comparisons: getComparisons(snapshot.series),
      updatedAt: snapshot.generatedAt,
      ...snapshotMeta(snapshot),
    });
  } catch (err) {
    return errorResponse(503, "공포·탐욕지수 데이터를 불러올 수 없습니다.", err instanceof Error ? err.message : undefined);
  }
}
