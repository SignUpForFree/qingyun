/**
 * MeihuaProvider — 梅花易数的提供方抽象（Strategy Pattern）
 *
 * 当前实现：
 *   - LocalMeihuaProvider：调本地 lib/divination/meihua-v2.ts 的 meihuaV2
 *
 * 占位实现（v2 启用）：
 *   - RemoteApiMeihuaProvider：第三方梅花排盘 API 接入点
 *
 * 切换原则与 bazi 相同：输入 args → 统一 MeihuaV2Result。
 */
import { meihuaV2, type MeihuaV2Args, type MeihuaV2Result } from "@/lib/divination/meihua-v2";

export interface MeihuaProvider {
  readonly name: string;
  cast(args: MeihuaV2Args): Promise<MeihuaV2Result>;
}

export class LocalMeihuaProvider implements MeihuaProvider {
  readonly name = "local";

  async cast(args: MeihuaV2Args): Promise<MeihuaV2Result> {
    return meihuaV2(args);
  }
}

/**
 * RemoteApiMeihuaProvider — 占位，未实现
 *
 * 实现指引：
 *   1. env：MEIHUA_API_BASE / MEIHUA_API_KEY
 *   2. 远端起卦后映射到 MeihuaV2Result（ben/hu/bian + tiYong + dongYao + yingQi 等）
 *   3. timeEnergy / sunYi 优先本地补算，避免远端缺字段
 */
export class RemoteApiMeihuaProvider implements MeihuaProvider {
  readonly name = "api";

  async cast(_args: MeihuaV2Args): Promise<MeihuaV2Result> {
    throw new Error(
      "[meihua-provider] RemoteApiMeihuaProvider not yet implemented. " +
      "Implement adapter or switch MEIHUA_PROVIDER=local",
    );
  }
}

export interface CreateMeihuaProviderOptions {
  kind?: "local" | "api";
}

export function createMeihuaProvider(
  options: CreateMeihuaProviderOptions = {},
): MeihuaProvider {
  const kind =
    options.kind ?? (process.env.MEIHUA_PROVIDER as "local" | "api" | undefined) ?? "local";
  switch (kind) {
    case "local":
      return new LocalMeihuaProvider();
    case "api":
      return new RemoteApiMeihuaProvider();
    default:
      throw new Error(`[meihua-provider] Unknown kind: ${String(kind)}`);
  }
}

declare global {
  var __qingyun_meihua_provider__: MeihuaProvider | undefined;
}

export const meihuaProvider: MeihuaProvider =
  globalThis.__qingyun_meihua_provider__ ?? createMeihuaProvider();
if (!globalThis.__qingyun_meihua_provider__) {
  globalThis.__qingyun_meihua_provider__ = meihuaProvider;
}
