import { getMarketSession } from "../utils/date";

/** 장중 캐시 TTL: 10분 */
export const INTRADAY_TTL_SECONDS = 10 * 60;
/** 장 마감 후/휴장일 캐시 TTL: 1시간 */
export const AFTER_HOURS_TTL_SECONDS = 60 * 60;

/** 장중에는 짧게, 장 종료 후에는 길게 캐시한다. */
export function getCacheTtlSeconds(now: Date = new Date()): number {
  const session = getMarketSession(now);
  return session === "open" ? INTRADAY_TTL_SECONDS : AFTER_HOURS_TTL_SECONDS;
}

/** API 응답용 Cache-Control 헤더 */
export function cacheControlHeader(now: Date = new Date()): string {
  const ttl = getCacheTtlSeconds(now);
  return `public, s-maxage=${ttl}, stale-while-revalidate=${ttl * 2}`;
}
