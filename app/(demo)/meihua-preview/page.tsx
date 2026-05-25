import { AppHeader } from "@/components/layout";
import { MeihuaResultCard } from "@/components/divination/MeihuaResultCard";
import { castByNumbers } from "@/lib/meihua/cast";
import { interpretMeihua } from "@/lib/meihua/interpret";

/**
 * Design lab：MeihuaResultCard 视觉预览
 *
 * 跑 5 个不同 relation 的卦让设计校对每种 verdict 的颜色 + 4 宫格 layout
 * 仅 dev 用，访问 /meihua-preview 看
 */
const SAMPLES: ReadonlyArray<{ args: [number, number, number] | [number, number]; label: string }> = [
  { args: [1, 2, 3], label: "天泽履 · 动 3" },
  { args: [3, 5], label: "离巽 · 互动 0→6（数字 2 入口）" },
  { args: [4, 8, 5], label: "震坤 · 动 5（用克体测试）" },
  { args: [6, 6, 1], label: "坎为水 · 动 1（比和）" },
  { args: [2, 4, 6], label: "兑震 · 动 6（用生体）" },
];

export default function MeihuaPreviewPage() {
  const relationVerdict: Record<string, string> = {
    ti_ke_yong: "体克用 · 吉",
    yong_ke_ti: "用克体 · 需留神",
    ti_sheng_yong: "体生用 · 略耗心力",
    yong_sheng_ti: "用生体 · 大吉",
    bi_he: "比和 · 平顺",
  };

  const samples = SAMPLES.map((s) => {
    const cast = castByNumbers(...s.args);
    const r = interpretMeihua(cast);
    return { label: s.label, r };
  });

  return (
    <>
      <AppHeader title="梅 花 卦 卡 预 览" />
      <div className="flex flex-1 flex-col items-center gap-4 p-4 pb-safe-bottom">
        <p className="px-2 text-center text-xs text-[var(--color-ink-fade)]">
          design lab · 5 个不同 relation 的卦
        </p>
        {samples.map(({ label, r }, i) => (
          <div key={i} className="w-full max-w-md space-y-1">
            <p className="px-2 text-[10px] tracking-ritual2 text-[var(--color-ink-fade)]">
              {label}
            </p>
            <MeihuaResultCard
              ben={r.ben}
              hu={r.hu}
              bian={r.bian}
              dongYao={r.dongYao}
              ti={r.tiYong.ti}
              yong={r.tiYong.yong}
              relation={r.tiYong.relation}
              verdict={relationVerdict[r.tiYong.relation] ?? r.tiYong.relation}
              speed={r.yingQi.speed}
              timeHint={r.yingQi.timeHint}
              branchHour={r.yingQi.branchHour}
            />
          </div>
        ))}
      </div>
    </>
  );
}
