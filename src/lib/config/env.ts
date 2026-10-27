import { z } from "zod";

/**
 * 서버 환경변수 스키마.
 * 값이 없거나 잘못되어도 데모 모드로 안전하게 동작하도록 기본값을 둔다.
 */
const EnvSchema = z.object({
  DATA_MODE: z.enum(["demo", "live"]).catch("demo").default("demo"),
  KRX_API_KEY: z.string().trim().min(1).optional().catch(undefined),
  KRX_API_BASE_URL: z.string().url().default("https://data-dbg.krx.co.kr").catch("https://data-dbg.krx.co.kr"),
  KRX_CACHE_DIR: z.string().default(".cache/krx"),
  FOREIGN_FLOW_CSV: z.string().trim().min(1).optional().catch(undefined),
  STORE_DRIVER: z.enum(["memory", "prisma"]).catch("memory").default("memory"),
  LOOKBACK_YEARS: z.coerce.number().int().min(1).max(15).catch(5).default(5),
  /** 데모 모드에서 장애를 흉내 낼 Provider 슬롯 (쉼표 구분) */
  DEMO_FAIL_FACTORS: z
    .string()
    .optional()
    .transform((v) => (v ? v.split(",").map((s) => s.trim()).filter(Boolean) : [])),
  NEXT_PUBLIC_SITE_URL: z.string().url().default("http://localhost:3000").catch("http://localhost:3000"),
});

export type AppEnv = z.infer<typeof EnvSchema>;

let cached: AppEnv | null = null;

export function getEnv(): AppEnv {
  if (!cached) cached = EnvSchema.parse(process.env);
  return cached;
}

/** 테스트용 */
export function resetEnvCache(): void {
  cached = null;
}

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
