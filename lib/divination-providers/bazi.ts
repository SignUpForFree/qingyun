/**
 * BaziProvider — 八字排盘的提供方抽象（Strategy Pattern）
 *
 * 当前实现：
 *   - LocalBaziProvider：调本地 lib/bazi/chart 的 buildChartV2（lunar-javascript 算法）
 *
 * 占位实现（v2 启用）：
 *   - RemoteApiBaziProvider：调第三方 API（如开源八字排盘 SaaS）；切换通过 env BAZI_PROVIDER=api
 *
 * 切换原则：
 *   - 输入：BuildChartInput（出生时间 + 经度 + 性别 + 历法）
 *   - 输出：BaziChartV2（统一形态，下游 prompt / fortune 不感知 provider 切换）
 *   - 任何 provider 必须保证字段完整性；缺失字段时抛错由调用方降级
 */
import type { BuildChartInput } from "@/types/domain";
import { buildChartV2, type BaziChartV2 } from "@/lib/bazi/chart";

export interface BaziProvider {
  readonly name: string;
  buildChart(input: BuildChartInput, opts?: { centerYear?: number }): Promise<BaziChartV2>;
}

export class LocalBaziProvider implements BaziProvider {
  readonly name = "local";

  async buildChart(
    input: BuildChartInput,
    opts?: { centerYear?: number },
  ): Promise<BaziChartV2> {
    return buildChartV2(input, opts);
  }
}

/**
 * RemoteApiBaziProvider — 占位，未实现
 *
 * 实现指引：
 *   1. env：BAZI_API_BASE / BAZI_API_KEY
 *   2. 返回结构需映射到 BaziChartV2（pillars / dayMaster / fiveElements / luckPillars / shensha / yongShen）
 *   3. 缺字段时抛错（不要默默填 null，否则 fortune 计算会错位）
 *   4. 失败时由 createBaziProvider 工厂降级到 LocalBaziProvider（dev 提示）
 */
export class RemoteApiBaziProvider implements BaziProvider {
  readonly name = "api";

  async buildChart(
    _input: BuildChartInput,
    _opts?: { centerYear?: number },
  ): Promise<BaziChartV2> {
    throw new Error(
      "[bazi-provider] RemoteApiBaziProvider not yet implemented. " +
      "Implement adapter or switch BAZI_PROVIDER=local",
    );
  }
}

export interface CreateBaziProviderOptions {
  kind?: "local" | "api";
}

export function createBaziProvider(options: CreateBaziProviderOptions = {}): BaziProvider {
  const kind = options.kind ?? (process.env.BAZI_PROVIDER as "local" | "api" | undefined) ?? "local";
  switch (kind) {
    case "local":
      return new LocalBaziProvider();
    case "api":
      return new RemoteApiBaziProvider();
    default:
      throw new Error(`[bazi-provider] Unknown kind: ${String(kind)}`);
  }
}

declare global {
  var __qingyun_bazi_provider__: BaziProvider | undefined;
}

export const baziProvider: BaziProvider =
  globalThis.__qingyun_bazi_provider__ ?? createBaziProvider();
if (!globalThis.__qingyun_bazi_provider__) {
  globalThis.__qingyun_bazi_provider__ = baziProvider;
}
