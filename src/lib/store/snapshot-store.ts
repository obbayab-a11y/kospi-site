/**
 * 계산된 공포·탐욕지수 시계열의 영속 저장소.
 *
 * - memory: 프로세스 메모리 (기본값, 설정 불필요)
 * - prisma: Prisma + SQLite (schema.prisma의 provider를 postgresql로 바꾸면 PostgreSQL)
 *
 * 데이터 업데이트가 실패하면 서비스는 여기 저장된 "마지막 정상 데이터"를 사용한다.
 */
import { getEnv } from "../config/env";
import type { FearGreedDaily } from "../fear-greed/types";

export interface SnapshotStore {
  readonly driver: "memory" | "prisma";
  load(): Promise<FearGreedDaily[] | null>;
  save(series: readonly FearGreedDaily[]): Promise<void>;
}

class MemorySnapshotStore implements SnapshotStore {
  readonly driver = "memory" as const;
  private data: FearGreedDaily[] | null = null;

  async load() {
    return this.data;
  }

  async save(series: readonly FearGreedDaily[]) {
    this.data = [...series];
  }
}

let instance: SnapshotStore | null = null;

export async function getSnapshotStore(): Promise<SnapshotStore> {
  if (instance) return instance;
  if (getEnv().STORE_DRIVER === "prisma") {
    // Prisma 엔진은 필요한 경우에만 로드한다 (데모 모드는 DB 없이 실행)
    const { PrismaSnapshotStore } = await import("./prisma-store");
    instance = new PrismaSnapshotStore();
  } else {
    instance = new MemorySnapshotStore();
  }
  return instance;
}
