import { AppHeader } from "@/components/layout";
import { SlipResultCard } from "@/components/divination/SlipResultCard";
import { SLIPS_SEED } from "@/db/seed/slips";

/**
 * Design lab：SlipResultCard 视觉预览（spec §6 抽签）
 *
 * 仅 dev 用，列出 6 个等级各一张样式，便于和 prompts-all-pages.md §6 对照
 * 不出现在 BottomNav, 不在导航里挂入口；直接访问 /slip-preview 看
 */
export default function SlipPreviewPage() {
  // 每个等级各取第一张
  const samples = ["上上", "上吉", "吉", "平", "渐顺", "慎行"].map((lv) =>
    SLIPS_SEED.find((s) => s.level === lv)!,
  );

  return (
    <>
      <AppHeader title="灵 签 卡 预 览" />
      <div className="flex flex-1 flex-col items-center gap-4 p-4 pb-20">
        <p className="px-2 text-center text-xs text-[var(--color-ink-fade)]">
          design lab · 6 个等级各一张样式（各维度 reading 用『综合』）
        </p>
        {samples.map((s) => (
          <div key={s.number} className="w-full max-w-md">
            <SlipResultCard
              number={s.number}
              level={s.level}
              title={s.title}
              poem={s.poem}
              reading={s.readings.综合}
              dimension="综合"
            />
          </div>
        ))}
      </div>
    </>
  );
}
