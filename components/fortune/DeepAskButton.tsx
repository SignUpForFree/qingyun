import Link from "next/link";

interface DeepAskButtonProps {
  /** 用作 chat ?prefill=<text> — 进入 chat 后默认填一段问题 */
  prefill?: string;
  label?: string;
}

/**
 * 深入追问按钮 (M4.6, image3)
 *
 * 点击跳 /chat，可选 prefill query 让对话开头自动填一句"针对今日运势深入追问"。
 * Chat router 不分发 intent（让 AI 走 chat 模式自由聊）。
 */
export function DeepAskButton({ prefill, label = "深入追问 →" }: DeepAskButtonProps) {
  const href = prefill ? `/chat?prefill=${encodeURIComponent(prefill)}` : "/chat";
  return (
    <Link
      href={href}
      data-testid="deep-ask-button"
      data-prefill={prefill ?? ""}
      className="block rounded-full bg-gradient-to-r from-[#F0B8C8] to-[#C9A1D9] px-5 py-3 text-center font-[family-name:var(--font-serif)] text-[13px] tracking-ritual text-white shadow-pill hover:opacity-90"
    >
      {label}
    </Link>
  );
}
