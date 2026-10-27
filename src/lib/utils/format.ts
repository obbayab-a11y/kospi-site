/** 숫자/금액/날짜 표시 포맷터 (UI·설명문 공용) */

const numberFmt = new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 2 });
const intFmt = new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 0 });

export function formatNumber(v: number, digits = 2): string {
  return new Intl.NumberFormat("ko-KR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(v);
}

export function formatInt(v: number): string {
  return intFmt.format(v);
}

export function formatPlain(v: number): string {
  return numberFmt.format(v);
}

/** +3.2% / −1.5% */
export function formatSignedPct(v: number, digits = 1): string {
  const sign = v > 0 ? "+" : v < 0 ? "−" : "";
  return `${sign}${Math.abs(v).toFixed(digits)}%`;
}

/** +4 / −15 / 0 */
export function formatSignedInt(v: number): string {
  if (v === 0) return "0";
  return `${v > 0 ? "+" : "−"}${Math.abs(Math.round(v))}`;
}

/** 억원 단위 금액 → "1.2조원" / "3,450억원" (부호 포함 선택) */
export function formatKrwEok(eok: number, signed = false): string {
  const sign = signed ? (eok > 0 ? "+" : eok < 0 ? "−" : "") : eok < 0 ? "−" : "";
  const abs = Math.abs(eok);
  if (abs >= 10000) return `${sign}${(abs / 10000).toFixed(1)}조원`;
  return `${sign}${intFmt.format(Math.round(abs))}억원`;
}

/** "2026-10-15" → "2026.10.15" */
export function formatDateDot(iso: string): string {
  return iso.replaceAll("-", ".");
}

/** "2026-10-15" → "26.10.15" */
export function formatDateShort(iso: string): string {
  return iso.slice(2).replaceAll("-", ".");
}
