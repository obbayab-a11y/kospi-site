/**
 * 프로세스 메모리 TTL 캐시 + 동시 요청 병합(single-flight).
 *
 * 동일 키에 대한 동시 refresh는 하나의 Promise로 합쳐
 * 외부 데이터 소스를 중복 호출하지 않는다.
 */
interface Entry<T> {
  value: T;
  expiresAt: number;
}

export class TtlCache<T> {
  private entries = new Map<string, Entry<T>>();
  private inflight = new Map<string, Promise<T>>();

  get(key: string, now = Date.now()): T | undefined {
    const e = this.entries.get(key);
    return e && e.expiresAt > now ? e.value : undefined;
  }

  set(key: string, value: T, ttlSeconds: number, now = Date.now()): void {
    this.entries.set(key, { value, expiresAt: now + ttlSeconds * 1000 });
  }

  async getOrLoad(key: string, ttlSeconds: number, loader: () => Promise<T>): Promise<T> {
    const hit = this.get(key);
    if (hit !== undefined) return hit;

    const running = this.inflight.get(key);
    if (running) return running;

    const p = loader()
      .then((value) => {
        this.set(key, value, ttlSeconds);
        return value;
      })
      .finally(() => this.inflight.delete(key));
    this.inflight.set(key, p);
    return p;
  }

  clear(): void {
    this.entries.clear();
  }
}
