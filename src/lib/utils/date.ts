/**
 * KST(UTC+9) 기준 날짜 유틸.
 * 한국은 서머타임이 없으므로 고정 오프셋으로 계산한다.
 */
import { addDays, format, parseISO } from "date-fns";
import type { IsoDate } from "../fear-greed/types";

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

export interface KstParts {
  date: IsoDate;
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  /** 0=일 ... 6=토 */
  weekday: number;
}

export function kstParts(now: Date = new Date()): KstParts {
  const k = new Date(now.getTime() + KST_OFFSET_MS);
  const year = k.getUTCFullYear();
  const month = k.getUTCMonth() + 1;
  const day = k.getUTCDate();
  return {
    date: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
    year,
    month,
    day,
    hour: k.getUTCHours(),
    minute: k.getUTCMinutes(),
    weekday: k.getUTCDay(),
  };
}

/** "2026.10.15 23:10" (KST) */
export function formatKstDateTime(iso: string | Date): string {
  const p = kstParts(typeof iso === "string" ? new Date(iso) : iso);
  return `${p.date.replaceAll("-", ".")} ${String(p.hour).padStart(2, "0")}:${String(p.minute).padStart(2, "0")}`;
}

export function formatKstTime(iso: string | Date): string {
  const p = kstParts(typeof iso === "string" ? new Date(iso) : iso);
  return `${String(p.hour).padStart(2, "0")}:${String(p.minute).padStart(2, "0")}`;
}

/** 고정 휴장일(양력). 음력 명절·임시공휴일은 live provider가 빈 응답으로 판별한다. */
const FIXED_HOLIDAYS = new Set(["01-01", "03-01", "05-05", "06-06", "08-15", "10-03", "10-09", "12-25", "12-31"]);

export function isWeekday(iso: IsoDate): boolean {
  const d = parseISO(iso).getDay();
  return d !== 0 && d !== 6;
}

export function isLikelyTradingDay(iso: IsoDate): boolean {
  return isWeekday(iso) && !FIXED_HOLIDAYS.has(iso.slice(5));
}

/** start~end(포함) 사이의 영업일 후보 목록 */
export function tradingDaysBetween(start: IsoDate, end: IsoDate): IsoDate[] {
  const out: IsoDate[] = [];
  let d = parseISO(start);
  const last = parseISO(end);
  while (d <= last) {
    const iso = format(d, "yyyy-MM-dd");
    if (isLikelyTradingDay(iso)) out.push(iso);
    d = addDays(d, 1);
  }
  return out;
}

export function toIsoDate(d: Date): IsoDate {
  return kstParts(d).date;
}

/** "2026-10-15" → "20261015" (KRX basDd) */
export function toBasDd(iso: IsoDate): string {
  return iso.replaceAll("-", "");
}

export function fromBasDd(basDd: string): IsoDate {
  return `${basDd.slice(0, 4)}-${basDd.slice(4, 6)}-${basDd.slice(6, 8)}`;
}

/* ---------------- 장 운영 시간 ---------------- */

export type MarketSession = "pre" | "open" | "post" | "closed";

/** KRX 정규장 09:00~15:30 (KST) */
export function getMarketSession(now: Date = new Date()): MarketSession {
  const p = kstParts(now);
  if (!isLikelyTradingDay(p.date)) return "closed";
  const minutes = p.hour * 60 + p.minute;
  if (minutes < 9 * 60) return "pre";
  if (minutes <= 15 * 60 + 30) return "open";
  return "post";
}

/** 장 마감 데이터가 확정되었다고 보는 시각 이후인지 (15:40 KST) */
export function isAfterClose(now: Date = new Date()): boolean {
  const p = kstParts(now);
  return p.hour * 60 + p.minute >= 15 * 60 + 40;
}

/** 오늘 이전(또는 마감 후라면 오늘)의 마지막 거래일 */
export function lastCompletedTradingDay(now: Date = new Date()): IsoDate {
  const p = kstParts(now);
  let d = parseISO(p.date);
  if (!(isLikelyTradingDay(p.date) && isAfterClose(now))) d = addDays(d, -1);
  for (let i = 0; i < 10; i++) {
    const iso = format(d, "yyyy-MM-dd");
    if (isLikelyTradingDay(iso)) return iso;
    d = addDays(d, -1);
  }
  return format(d, "yyyy-MM-dd");
}
