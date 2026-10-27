/**
 * 데이터 동기화 스크립트
 *
 *   npm run sync
 *
 * - 설정된 Provider(DATA_MODE)로 전체 기간 데이터를 가져와 지수를 계산하고
 *   STORE_DRIVER=prisma 이면 DB에 저장한다.
 * - live 모드에서는 KRX 응답이 파일 캐시(KRX_CACHE_DIR)에 쌓이므로,
 *   최초 1회 실행 후에는 신규 거래일만 API를 호출한다.
 * - 권장: 매 거래일 KRX 데이터 공개 이후(예: 08:30 KST) cron으로 실행.
 */
import { computeFreshSnapshot } from "../src/lib/data/fear-greed-service";
import { getSnapshotStore } from "../src/lib/store/snapshot-store";
import { getEnv } from "../src/lib/config/env";

async function main() {
  const env = getEnv();
  const started = Date.now();
  console.log(`[sync] DATA_MODE=${env.DATA_MODE} STORE_DRIVER=${env.STORE_DRIVER}`);

  const snapshot = await computeFreshSnapshot();
  for (const p of snapshot.providers) {
    console.log(
      `[sync] ${p.slot.padEnd(15)} ${p.state.padEnd(12)} ${String(p.observations).padStart(5)}건  ${p.lastDate ?? "-"}  ${p.error ?? ""}`,
    );
  }

  if (snapshot.stale) {
    console.error("[sync] 갱신 실패 — 마지막 정상 데이터 또는 데모 데이터가 반환되었습니다.", snapshot.notices);
    process.exitCode = 1;
    return;
  }

  const store = await getSnapshotStore();
  await store.save(snapshot.series);
  const { latest } = snapshot;
  console.log(
    `[sync] ${snapshot.series.length}일 저장 (${store.driver}) · 최신 ${latest.date} 점수 ${latest.score} (${latest.classification}) · ${Date.now() - started}ms`,
  );
}

main()
  .catch((err: unknown) => {
    console.error("[sync] 실패", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (getEnv().STORE_DRIVER === "prisma") {
      const { PrismaClient } = await import("@prisma/client");
      await new PrismaClient().$disconnect();
    }
  });
