/**
 * KV 单例 — 全应用共享一个 KVStore 实例
 *
 * 默认走进程内 Map；切 Redis 只需 env KV_STORE=redis（实现见 kv-store.ts 的 TODO）。
 *
 * 用法：
 *   import { kv } from "@/lib/cache";
 *   await kv.set("rate:user:abc", 1, { ttlSeconds: 60 });
 */
import { createKVStore, type KVStore } from "./kv-store";

declare global {
  // 防热更新重载时多次实例化（dev 下 next.js HMR）
  var __qingyun_kv__: KVStore | undefined;
}

export const kv: KVStore = globalThis.__qingyun_kv__ ?? createKVStore();
if (!globalThis.__qingyun_kv__) {
  globalThis.__qingyun_kv__ = kv;
}

export type { KVStore, KVStoreSetOptions } from "./kv-store";
export { InProcessKVStore, createKVStore } from "./kv-store";
