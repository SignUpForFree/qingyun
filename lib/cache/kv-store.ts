/**
 * KVStore — 进程内 / Redis 双实现的 KV 抽象
 *
 * 设计目标：
 *   - 单机开发：默认 InProcessKVStore（Map + 过期时间），零依赖
 *   - 上线扩容：通过 createKVStore({ kind: "redis", ... }) 切到 Redis
 *   - 调用方代码只 import KVStore 接口，不感知实现差异
 *
 * 接口选择：
 *   - get / set / del / incr / expire / ttl 已覆盖 OTP / rate-limit / 短期缓存所有场景
 *   - mget / mset 暂不暴露（v1 用不到，避免 fan-out 复杂度）
 *
 * 详见 docs/superpowers/specs/2026-05-06-launch-readiness.md。
 */

export interface KVStoreSetOptions {
  /** 过期秒数；不传 = 永久 */
  ttlSeconds?: number;
  /** SETNX 语义：只在 key 不存在时写入，存在则返回 false */
  ifAbsent?: boolean;
}

export interface KVStore {
  get<T = unknown>(key: string): Promise<T | null>;
  set<T = unknown>(key: string, value: T, options?: KVStoreSetOptions): Promise<boolean>;
  del(key: string): Promise<boolean>;
  /**
   * 原子自增；key 不存在时初始化为 0 再加 by。
   * @returns 自增后的值
   */
  incr(key: string, by?: number): Promise<number>;
  expire(key: string, ttlSeconds: number): Promise<boolean>;
  /** @returns 剩余秒数；-1 = 永久；-2 = 不存在 */
  ttl(key: string): Promise<number>;
}

/**
 * InProcessKVStore — 单进程 Map 实现
 *
 * 限制：
 *   - 多实例 / 重启不持久（OTP / rate-limit 跨重启失效；上线必须切 Redis）
 *   - 不做惰性删除清扫（懒删：get/set 时检查过期）
 */
interface Entry {
  value: unknown;
  /** ms 时间戳，0 = 永不过期 */
  expiresAt: number;
}

export class InProcessKVStore implements KVStore {
  private readonly map = new Map<string, Entry>();

  private isExpired(e: Entry): boolean {
    return e.expiresAt > 0 && Date.now() >= e.expiresAt;
  }

  async get<T = unknown>(key: string): Promise<T | null> {
    const e = this.map.get(key);
    if (!e) return null;
    if (this.isExpired(e)) {
      this.map.delete(key);
      return null;
    }
    return e.value as T;
  }

  async set<T = unknown>(
    key: string,
    value: T,
    options: KVStoreSetOptions = {},
  ): Promise<boolean> {
    if (options.ifAbsent) {
      const existing = this.map.get(key);
      if (existing && !this.isExpired(existing)) return false;
    }
    const expiresAt = options.ttlSeconds && options.ttlSeconds > 0
      ? Date.now() + options.ttlSeconds * 1000
      : 0;
    this.map.set(key, { value, expiresAt });
    return true;
  }

  async del(key: string): Promise<boolean> {
    return this.map.delete(key);
  }

  async incr(key: string, by = 1): Promise<number> {
    const existing = this.map.get(key);
    if (!existing || this.isExpired(existing)) {
      this.map.set(key, { value: by, expiresAt: 0 });
      return by;
    }
    const cur = typeof existing.value === "number" ? existing.value : 0;
    const next = cur + by;
    existing.value = next;
    return next;
  }

  async expire(key: string, ttlSeconds: number): Promise<boolean> {
    const e = this.map.get(key);
    if (!e || this.isExpired(e)) return false;
    e.expiresAt = ttlSeconds > 0 ? Date.now() + ttlSeconds * 1000 : 0;
    return true;
  }

  async ttl(key: string): Promise<number> {
    const e = this.map.get(key);
    if (!e) return -2;
    if (this.isExpired(e)) {
      this.map.delete(key);
      return -2;
    }
    if (e.expiresAt === 0) return -1;
    return Math.ceil((e.expiresAt - Date.now()) / 1000);
  }

  /** 测试辅助：清空所有 entries */
  reset(): void {
    this.map.clear();
  }

  /** 测试辅助：当前 size（含过期未清扫） */
  size(): number {
    return this.map.size;
  }
}

/**
 * createKVStore — 工厂
 *
 * 根据 env 选择实现：
 *   - KV_STORE=memory（默认）→ InProcessKVStore
 *   - KV_STORE=redis（v2）→ TODO，目前抛错提示
 *
 * 调用方应在模块 top-level 拿一次，复用 singleton（见 lib/cache/index.ts）。
 */
export interface CreateKVStoreOptions {
  kind?: "memory" | "redis";
  /** Redis 模式必填 */
  redisUrl?: string;
}

export function createKVStore(options: CreateKVStoreOptions = {}): KVStore {
  const kind = options.kind ?? (process.env.KV_STORE as "memory" | "redis" | undefined) ?? "memory";
  switch (kind) {
    case "memory":
      return new InProcessKVStore();
    case "redis":
      throw new Error(
        "[KVStore] Redis backend not yet implemented. " +
        "Install `ioredis` and add createRedisKVStore in lib/cache/redis-store.ts",
      );
    default:
      throw new Error(`[KVStore] Unknown kind: ${String(kind)}`);
  }
}

/**
 * Redis 实现占位接口 — 上线 v2 时实现
 *
 * 期望签名（参考实现）：
 *
 *   class RedisKVStore implements KVStore {
 *     constructor(private redis: import("ioredis").Redis) {}
 *     async get(key) { const v = await this.redis.get(key); return v ? JSON.parse(v) : null; }
 *     async set(key, value, opts) {
 *       const args: any[] = [key, JSON.stringify(value)];
 *       if (opts?.ttlSeconds) args.push("EX", opts.ttlSeconds);
 *       if (opts?.ifAbsent) args.push("NX");
 *       const res = await this.redis.set(...args);
 *       return res === "OK";
 *     }
 *     ...
 *   }
 */
