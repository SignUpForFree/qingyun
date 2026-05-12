import Link from "next/link";
import { AppHeader } from "@/components/layout";
import { GlassCard, Sparkle, Divider } from "@/components/su";
import { FeedbackForm } from "./_FeedbackForm";

/**
 * /feedback 吐槽反馈页（spec §9 我的页入口）
 *
 * 含：
 *   - FeedbackForm（client component，POST /api/feedback）
 *   - mailto 兜底（防某些用户提交失败后想直接写邮件）
 *   - 反馈类型说明 + 体验承诺
 */
export const metadata = {
  title: "吐槽反馈 · 轻运 AI",
};

const MAIL = "feedback@qingyun-ai.example";

export default function FeedbackPage() {
  return (
    <>
      <AppHeader title="吐槽反馈" />
      <div className="flex flex-1 flex-col gap-4 p-4 pb-safe-bottom">
        <GlassCard className="space-y-3 p-5 text-center">
          <h2 className="font-[family-name:var(--font-serif)] text-[18px] tracking-ritual text-[var(--color-ink-plum)]">
            欢迎讲讲哪不对劲 <Sparkle size={11} variant="diamond" />
          </h2>
          <p className="text-xs leading-relaxed text-[var(--color-ink-fade)]">
            轻运 AI 是小团队做出来的 MVP，肯定有不少粗糙地方。
            <br />
            写一行也算，吐槽不会丢。
          </p>
        </GlassCard>

        <FeedbackForm />

        <GlassCard className="space-y-3 p-5 text-center">
          <Divider />
          <a
            href={`mailto:${MAIL}?subject=轻运 AI 反馈`}
            className="inline-block rounded-[8px] bg-white/60 px-5 py-2 text-xs tracking-ritual text-[var(--color-ink-plum)] hover:bg-white"
          >
            或直接写邮件 →
          </a>
          <p className="break-all text-[10px] tracking-ritual2 text-[var(--color-ink-fade)]">
            {MAIL}
          </p>
        </GlassCard>

        <GlassCard className="space-y-3 p-5">
          <h3 className="text-xs tracking-ritual2 text-[var(--color-ink-fade)]">
            可以聊点什么
          </h3>
          <ul className="space-y-2 text-sm leading-relaxed text-[var(--color-ink-plum)]">
            <li>
              <span className="tracking-ritual text-[var(--color-accent-plum)]">建议</span>
              ：哪个功能想要 / 哪个细节不顺
            </li>
            <li>
              <span className="tracking-ritual text-[var(--color-accent-plum)]">缺陷</span>
              ：哪一步报错了，最好能附截图
            </li>
            <li>
              <span className="tracking-ritual text-[var(--color-accent-plum)]">内容偏离</span>
              ：AI 解读哪里不对、文案哪里别扭
            </li>
          </ul>
        </GlassCard>

        <GlassCard className="space-y-2 p-5">
          <h3 className="text-xs tracking-ritual2 text-[var(--color-ink-fade)]">
            一些承诺
          </h3>
          <p className="text-xs leading-relaxed text-[var(--color-ink-mist)]">
            · 反馈邮件作者会看完每一条，不会自动归档
            <br />
            · 不向第三方共享你的反馈内容
            <br />· 如需删除已发送内容，回信『请删除』即可
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
