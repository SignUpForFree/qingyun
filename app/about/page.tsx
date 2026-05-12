import Link from "next/link";
import { AppHeader } from "@/components/layout";
import { GlassCard, Sparkle, Divider } from "@/components/su";

/**
 * /about 关于轻运（spec §9 我的页入口）
 *
 * 静态：项目介绍 + 数据声明 + 技术栈
 */
export const metadata = {
  title: "关于轻运 · 轻运 AI",
};

export default function AboutPage() {
  return (
    <>
      <AppHeader title="关于轻运" />
      <div className="flex flex-1 flex-col gap-4 p-4 pb-safe-bottom">
        <GlassCard className="space-y-3 p-5">
          <h2 className="font-[family-name:var(--font-serif)] text-[18px] tracking-ritual text-[var(--color-ink-plum)]">
            轻运 AI <Sparkle size={11} variant="diamond" />
          </h2>
          <p className="text-sm leading-relaxed text-[var(--color-ink-mist)]">
            一个温和的国学陪伴工具：抽签、解梦、八字、梅花易数、每日运势。
          </p>
          <p className="text-sm leading-relaxed text-[var(--color-ink-mist)]">
            初衷不是让你信什么，而是给你一个看见自己的角度。
          </p>
        </GlassCard>

        <GlassCard className="space-y-3 p-5">
          <h3 className="text-xs tracking-ritual2 text-[var(--color-ink-fade)]">
            数据怎么处理
          </h3>
          <Divider />
          <ul className="space-y-2 text-sm leading-relaxed text-[var(--color-ink-plum)]">
            <li>
              你的档案、对话、抽签记录都
              <span className="tracking-ritual text-[var(--color-accent-plum)]">仅自己可见</span>
            </li>
            <li>
              我们不会
              <span className="tracking-ritual text-[var(--color-accent-plum)]">
                向第三方共享
              </span>
              你的占卜内容
            </li>
            <li>
              AI 解读由 DeepSeek 模型生成，输入会
              <span className="tracking-ritual text-[var(--color-accent-plum)]">
                按服务商策略缓存
              </span>
              ，但不与你的账号挂钩
            </li>
            <li>需要导出 / 删除全部数据，请通过反馈页联系我们</li>
          </ul>
        </GlassCard>

        <GlassCard className="space-y-3 p-5">
          <h3 className="text-xs tracking-ritual2 text-[var(--color-ink-fade)]">
            技术与版本
          </h3>
          <Divider />
          <ul className="space-y-1.5 text-xs leading-relaxed text-[var(--color-ink-mist)]">
            <li>· Next.js 16 App Router + Tailwind 4 + shadcn/Base UI</li>
            <li>· SQLite + drizzle-orm + FTS5 历史搜索</li>
            <li>· lunar-javascript 真太阳时排盘 + 30+ 神煞 + 大运流年</li>
            <li>· DeepSeek deepseek-v4-pro 流式生成（ofox 网关）</li>
            <li>· 当前版本：v2.0（多档案 / 八字 V2 / 100 签 / 64 卦）</li>
          </ul>
        </GlassCard>

        <GlassCard className="space-y-2 p-5 text-center">
          <p className="text-xs leading-relaxed text-[var(--color-ink-mist)]">
            一个善意的提醒：
          </p>
          <p className="text-sm leading-relaxed text-[var(--color-ink-plum)]">
            占卜不是命中注定，建议不构成医疗 / 法律 / 投资意见。
            <br />
            真正难的事，要找专业的人或专业的资源。
          </p>
        </GlassCard>

        <p className="text-center text-[10px] text-[var(--color-ink-fade)]">
          <Link href="/me" className="hover:text-[var(--color-ink-plum)]">
            ← 回我的
          </Link>
        </p>
      </div>
    </>
  );
}
