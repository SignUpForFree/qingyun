import { AppHeader } from "@/components/layout";
import { SlipResultCard } from "@/components/divination/SlipResultCard";
import { SLIPS_V2 as SLIPS_SEED, type SlipLevel } from "@/db/seed/slips-v2";

/**
 * Design lab：SlipResultCard 视觉预览（spec §6 抽签 + design §7）
 *
 * 仅 dev 用，列出 production seed 实际 5 等级各一张样式，便于和
 * prompts-all-pages.md §7 对照。第一张含 6 维 readings 演示 tabs 切换。
 * 不出现在 BottomNav，不在导航里挂入口；直接访问 /slip-preview。
 */
export default function SlipPreviewPage() {
  // production 数据 5 级 + 兼容历史 4 级
  const wanted: SlipLevel[] = [
    "上上",
    "上吉",
    "中吉",
    "中平",
    "下下",
  ];
  const samples = wanted
    .map((lv) => SLIPS_SEED.find((s) => s.level === lv))
    .filter(Boolean) as Array<(typeof SLIPS_SEED)[number]>;

  // 抽签 6 维 tab 字段映射（与 qianwen route 一致）
  const SLIP_DIM_MAP: Record<string, string> = {
    综合运势: "综合",
    事业学业: "事业",
    财运: "财运",
    感情姻缘: "感情",
    人际贵人: "人际",
    平安健康: "健康",
  };

  return (
    <>
      <AppHeader title="灵 签 卡 预 览" />
      <div className="flex flex-1 flex-col items-center gap-4 p-4 pb-20">
        <p className="px-2 text-center text-xs text-[var(--color-ink-fade)]">
          design lab · production 5 等级各一张样式（首张含 6 维 tabs 演示）
        </p>
        {samples.map((s, idx) => {
          const fullReadings: Record<string, string> = {};
          for (const [k, v] of Object.entries(s.readings)) {
            const short = SLIP_DIM_MAP[k] ?? k;
            if (typeof v === "string" && v.trim()) fullReadings[short] = v;
          }
          return (
            <div key={s.number} className="w-full max-w-md">
              <SlipResultCard
                number={s.number}
                level={s.level}
                title={s.title}
                poem={s.poem}
                reading={s.readings.综合运势}
                dimension="综合运势"
                readings={idx === 0 ? fullReadings : undefined}
              />
            </div>
          );
        })}
      </div>
    </>
  );
}
