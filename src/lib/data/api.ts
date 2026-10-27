import { NextResponse } from "next/server";
import { cacheControlHeader } from "../cache/ttl";
import { FACTOR_META, FACTOR_ORDER } from "../fear-greed/factor-meta";
import { getFactorScore, type FearGreedDaily } from "../fear-greed/types";
import { classify } from "../fear-greed/classify";
import type { FearGreedSnapshot } from "./fear-greed-service";

/** 공통 JSON 응답: 장중/장후 TTL에 맞춘 CDN 캐시 헤더 포함 */
export function jsonResponse(body: unknown, init?: { status?: number }) {
  return NextResponse.json(body, {
    status: init?.status ?? 200,
    headers: { "Cache-Control": cacheControlHeader() },
  });
}

export function errorResponse(status: number, message: string, details?: unknown) {
  return NextResponse.json(
    { error: message, details },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

export function serializeFactors(day: FearGreedDaily) {
  return Object.fromEntries(
    FACTOR_ORDER.map((key) => {
      const score = getFactorScore(day, key);
      return [
        key,
        {
          label: FACTOR_META[key].label,
          score,
          classification: score === null ? null : classify(score),
          weight: FACTOR_META[key].weight,
          appliedWeight: day.appliedWeights[key] ?? null,
          raw: day.rawData[key],
        },
      ];
    }),
  );
}

export function snapshotMeta(snapshot: FearGreedSnapshot) {
  return {
    mode: snapshot.effectiveMode,
    stale: snapshot.stale,
    notices: snapshot.notices,
    disclaimer: "본 지수는 자체 산출 지표이며 투자 권유가 아닙니다.",
  };
}
