import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "隐私政策 · 轻运 AI",
  description: "轻运 AI 隐私政策",
};

export const dynamic = "force-static";

/**
 * /legal/privacy — 公开可访（M0.5）
 *
 * middleware 白名单：/legal/* 不需登录。
 *
 * 内容要素（合规要求）：
 *   - 收集信息（昵称 / 头像 / 出生时间 / 出生地）
 *   - 使用范围
 *   - 第三方共享（仅微信 OAuth）
 *   - 用户权利（删除 / 导出）
 *   - 联系方式
 *   - 18 岁以下使用须监护人同意
 */
export default function PrivacyPage() {
  return (
    <article className="prose mx-auto max-w-2xl p-6 text-[var(--color-ink-plum)]">
      <h1 className="text-2xl font-semibold">隐私政策</h1>

      <p className="mt-4 text-sm text-[var(--color-ink-fade)]">
        最后更新：2026-04-27
      </p>

      <h2 className="mt-6 text-lg font-medium">1. 我们收集的信息</h2>
      <p>使用轻运 AI 时，我们仅在你授权的范围内收集以下信息：</p>
      <ul className="list-disc pl-5">
        <li>微信公开信息：昵称、头像（通过微信网页授权获取，scope 为 snsapi_userinfo）</li>
        <li>档案信息：性别、出生时间、出生地（用于八字排盘 / 运势计算）</li>
        <li>对话内容：你与 AI 的问答记录（用于改善服务质量、提供历史回顾）</li>
        <li>手机号（可选）：仅在你主动绑定时收集，用于账号找回</li>
      </ul>

      <h2 className="mt-6 text-lg font-medium">2. 使用范围</h2>
      <p>收集的信息仅用于：</p>
      <ul className="list-disc pl-5">
        <li>为你提供个性化的运势解读 / 抽签 / 解梦 / 八字 / 梅花易数服务</li>
        <li>每日通过服务号模板消息向你推送当日运势（你可以取关公众号停止接收）</li>
        <li>服务质量改进（聚合、匿名分析）</li>
      </ul>
      <p>我们不会将你的个人信息用于广告投放或转售给第三方。</p>

      <h2 className="mt-6 text-lg font-medium">3. 第三方服务</h2>
      <p>
        我们使用以下第三方服务：
      </p>
      <ul className="list-disc pl-5">
        <li>微信开放平台：用于网页授权登录与模板消息推送</li>
        <li>AI 服务网关（ofox.ai / DeepSeek）：用于自然语言理解与解读生成。我们将你输入的对话片段发送至 AI 模型，但不附带可识别的身份信息</li>
      </ul>

      <h2 className="mt-6 text-lg font-medium">4. 你的权利</h2>
      <ul className="list-disc pl-5">
        <li>查看：在「我的」页面查看所有已存的档案与对话</li>
        <li>修改：随时在「我的 → 编辑信息」修改档案字段</li>
        <li>删除：「我的 → 设置 → 注销账号」一键删除全部数据（不可恢复）</li>
        <li>导出：通过 GET /api/me/export 接口下载你的全量数据 JSON</li>
      </ul>

      <h2 className="mt-6 text-lg font-medium">5. 数据安全</h2>
      <p>
        所有数据存储在境内服务器，传输使用 HTTPS 加密。微信 access_token 与 jsapi_ticket 加密存储。
      </p>

      <h2 className="mt-6 text-lg font-medium">6. 未成年人保护</h2>
      <p>
        本服务面向 18 岁及以上用户。若你未满 18 岁，请在监护人指导下使用。
      </p>

      <h2 className="mt-6 text-lg font-medium">7. 政策变更</h2>
      <p>
        我们可能会更新本隐私政策。重大变更将通过模板消息或站内提示通知。
      </p>

      <h2 className="mt-6 text-lg font-medium">8. 联系方式</h2>
      <p>
        若你有任何隐私相关问题，可通过服务号留言联系我们。
      </p>

      <p className="mt-8 text-xs text-[var(--color-ink-fade)]">
        本政策与<a href="/legal/terms" className="underline">用户协议</a>共同适用。
      </p>
    </article>
  );
}
