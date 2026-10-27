/**
 * KRX Open API 클라이언트 (한국거래소 공식 Open API).
 *
 *  - 포털: https://openapi.krx.co.kr  (회원가입 → API 인증키 발급 → 서비스별 이용 신청/승인)
 *  - 호출: GET {KRX_API_BASE_URL}/svc/apis/{category}/{service}?basDd=YYYYMMDD
 *  - 인증: 요청 헤더 `AUTH_KEY: <발급키>`
 *  - 응답: { "OutBlock_1": [ { ...문자열 필드 } ] }
 *  - 데이터는 일 단위(전 거래일 종가까지)로 제공되며 실시간 시세는 제공하지 않는다.
 *
 * 과거 날짜의 응답은 변하지 않으므로 파일 캐시에 저장해 호출 횟수를 최소화한다.
 * (이용약관상 호출 한도를 지키고, 동일 데이터를 반복 요청하지 않기 위함)
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { IsoDate } from "../../fear-greed/types";
import { kstParts, toBasDd } from "../../utils/date";

export type KrxRow = Record<string, string>;

export const KRX_ENDPOINTS = {
  /** KOSPI 시리즈 지수 일별시세 (코스피, 코스피 대형주/중형주/소형주 등) */
  kospiIndex: "idx/kospi_dd_trd",
  /** KOSDAQ 시리즈 지수 일별시세 */
  kosdaqIndex: "idx/kosdaq_dd_trd",
  /** 파생상품지수 일별시세 (코스피 200 변동성지수 = VKOSPI 포함) */
  derivativeIndex: "idx/drvprod_dd_trd",
  /** 유가증권(KOSPI) 종목 일별매매정보 */
  kospiStocks: "sto/stk_bydd_trd",
  /** 옵션 일별매매정보 (KOSPI200 옵션 포함) */
  options: "drv/opt_bydd_trd",
} as const;

export type KrxEndpoint = (typeof KRX_ENDPOINTS)[keyof typeof KRX_ENDPOINTS];

export interface KrxClientOptions {
  apiKey: string;
  baseUrl: string;
  cacheDir: string;
  timeoutMs?: number;
  concurrency?: number;
}

export class KrxApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "KrxApiError";
  }
}

/** "2,345.67" / "-" / "" → number | NaN */
export function parseKrxNumber(v: string | undefined): number {
  if (v === undefined) return NaN;
  const cleaned = v.replaceAll(",", "").trim();
  if (cleaned === "" || cleaned === "-") return NaN;
  return Number(cleaned);
}

export class KrxClient {
  private readonly timeoutMs: number;
  readonly concurrency: number;

  constructor(private readonly opts: KrxClientOptions) {
    this.timeoutMs = opts.timeoutMs ?? 15_000;
    this.concurrency = opts.concurrency ?? 4;
  }

  private cachePath(endpoint: KrxEndpoint, date: IsoDate) {
    return path.join(this.opts.cacheDir, endpoint.replace("/", "_"), `${toBasDd(date)}.json`);
  }

  /** 하루치 데이터 조회. 휴장일이면 빈 배열. */
  async fetchDaily(endpoint: KrxEndpoint, date: IsoDate): Promise<KrxRow[]> {
    const file = this.cachePath(endpoint, date);
    const cacheable = date < kstParts().date; // 오늘 데이터는 확정 전일 수 있어 캐시하지 않음

    if (cacheable) {
      try {
        return JSON.parse(await readFile(file, "utf8")) as KrxRow[];
      } catch {
        /* cache miss */
      }
    }

    if (!this.opts.apiKey) throw new KrxApiError("KRX_API_KEY가 설정되지 않았습니다.");

    const url = `${this.opts.baseUrl}/svc/apis/${endpoint}?basDd=${toBasDd(date)}`;
    const request = () =>
      fetch(url, {
        headers: { AUTH_KEY: this.opts.apiKey, Accept: "application/json" },
        signal: AbortSignal.timeout(this.timeoutMs),
        cache: "no-store",
      });
    // 일시적 네트워크 오류·5xx는 한 번 재시도
    let res = await request().catch(() => null);
    if (!res || res.status >= 500) {
      await new Promise((r) => setTimeout(r, 800));
      res = await request();
    }
    if (!res.ok) {
      throw new KrxApiError(`KRX ${endpoint} ${toBasDd(date)} HTTP ${res.status}`);
    }
    const body = (await res.json()) as { OutBlock_1?: KrxRow[]; respMsg?: string };
    if (!Array.isArray(body.OutBlock_1)) {
      throw new KrxApiError(`KRX ${endpoint} 응답 형식 오류${body.respMsg ? `: ${body.respMsg}` : ""}`);
    }

    if (cacheable) {
      await mkdir(path.dirname(file), { recursive: true }).catch(() => undefined);
      await writeFile(file, JSON.stringify(body.OutBlock_1)).catch(() => undefined);
    }
    return body.OutBlock_1;
  }

  /**
   * 여러 날짜를 동시성 제한을 두고 조회한다.
   * 휴장일(빈 응답)은 결과에서 제외된다.
   */
  async fetchRange(endpoint: KrxEndpoint, dates: readonly IsoDate[]): Promise<Map<IsoDate, KrxRow[]>> {
    const result = new Map<IsoDate, KrxRow[]>();
    let cursor = 0;
    const worker = async () => {
      while (cursor < dates.length) {
        const date = dates[cursor++];
        const rows = await this.fetchDaily(endpoint, date);
        if (rows.length > 0) result.set(date, rows);
      }
    };
    await Promise.all(Array.from({ length: Math.min(this.concurrency, dates.length) }, worker));
    return new Map([...result.entries()].sort(([a], [b]) => a.localeCompare(b)));
  }
}
