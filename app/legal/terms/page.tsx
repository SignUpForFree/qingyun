import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "用户协议 · 福小运",
  description: "福小运 用户协议",
};

export const dynamic = "force-static";

/**
 * /legal/terms — 公开可访（M0.5）
 *
 * 必含：服务说明 / 18 岁以上声明 / 算命解读不构成医学/法律建议免责。
 */
export default function TermsPage() {
  return (
    <article className="prose mx-auto max-w-2xl p-6 text-[var(--color-ink-plum)]">
      <h1 className="text-2xl font-semibold">用户协议</h1>

      <p className="mt-4 text-sm text-[var(--color-ink-fade)]">
        最后更新：2026-04-27
      </p>

      <h2 className="mt-6 text-lg font-medium">1. 服务说明</h2>
      <p>
        福小运（以下简称「本服务」）是一款基于传统命理文化与 AI 技术的国学陪伴应用，提供运势查询、抽签、解梦、八字解读、梅花易数等功能。本服务面向有兴趣了解传统命理文化的用户。
      </p>

      <h2 className="mt-6 text-lg font-medium">2. 用户资格</h2>
      <p>
        使用本服务，你需年满 18 周岁，或在监护人指导下使用。点击「同意并继续」即表示你确认满足上述条件。
      </p>

      <h2 className="mt-6 text-lg font-medium">3. 重要免责</h2>
      <p>
        <strong>本服务提供的解读、建议仅供娱乐与文化体验参考，不构成任何医学、法律、金融或专业建议。</strong>请勿将解读结果作为重大决策的唯一依据。如遇身心不适或重要决定，请咨询相应领域的专业人士。
      </p>

      <h2 className="mt-6 text-lg font-medium">4. 使用规范</h2>
      <p>使用本服务时，你同意不会：</p>
      <ul className="list-disc pl-5">
        <li>提交违法、违规、暴力、淫秽、仇恨、虚假信息</li>
        <li>使用本服务从事任何形式的算命收费、迷信传销活动</li>
        <li>试图入侵、破坏服务器或干扰其他用户使用</li>
        <li>逆向工程、爬取或滥用 API</li>
      </ul>
      <p>
        违反规范的账号将被限制使用或注销。
      </p>

      <h2 className="mt-6 text-lg font-medium">5. 内容版权</h2>
      <p>
        AI 生成的解读文本归属于本服务运营方与你共同所有，你可自由保存、分享，但不得用于商业用途或冒充专业咨询。
      </p>

      <h2 className="mt-6 text-lg font-medium">6. 服务变更与终止</h2>
      <p>
        我们有权根据政策、法规或运营需要调整、暂停或终止服务，会提前通过站内通知或模板消息告知。
      </p>

      <h2 className="mt-6 text-lg font-medium">7. 限流与公平使用</h2>
      <p>
        为保证服务质量，我们对每位用户的 API 调用频次有合理上限（具体见服务号菜单内说明）。超限会显示「今天比 AI 还忙」提示，请稍后重试。
      </p>

      <h2 className="mt-6 text-lg font-medium">8. 风险提示</h2>
      <p>
        命理文化是一种文化体验，不能替代科学与理性思考。请保持平和心态，将解读视为生活的小调剂，而非真理本身。
      </p>

      <p className="mt-8 text-xs text-[var(--color-ink-fade)]">
        本协议与<a href="/legal/privacy" className="underline">隐私政策</a>共同适用。
      </p>
    </article>
  );
}
