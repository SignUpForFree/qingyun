"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { GlassCard, Sparkle } from "@/components/su";
import { Label } from "@/components/ui/label";

const PHONE_RE = /^1[3-9]\d{9}$/;

interface PhoneLoginFormProps {
  /** 登录后跳转目标（onSuccess 未传时用，默认 "/"） */
  redirectTo?: string;
  /**
   * 登录成功后回调（弹窗模式用此，避免 router.replace 整页跳转）。
   * 调用方负责关 Sheet + router.refresh()
   */
  onSuccess?: (info: { isNew: boolean }) => void;
}

/**
 * PhoneLoginForm — 手机号 + 6 位 OTP 登录表单
 *
 * 用作 LoginGate / LoginSheet 内容；登录前组件，不需要 cookie。
 */
export function PhoneLoginForm({ redirectTo, onSuccess }: PhoneLoginFormProps) {
  const router = useRouter();
  const [phone, setPhone] = React.useState("");
  const [code, setCode] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const [verifying, setVerifying] = React.useState(false);
  const [cooldown, setCooldown] = React.useState(0);

  React.useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const phoneValid = PHONE_RE.test(phone.trim());
  const codeValid = /^\d{6}$/.test(code.trim());

  async function sendOtp() {
    if (!phoneValid || sending || cooldown > 0) return;
    setSending(true);
    try {
      const e164 = `+86${phone.trim()}`;
      const res = await fetch("/api/auth/phone/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: e164 }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        if (err?.error === "rate_limited") {
          const sec = Math.ceil(((err.cooldownMs as number) ?? 60_000) / 1000);
          toast.error(`太频繁，${sec}s 后再发`);
          setCooldown(sec);
          return;
        }
        toast.error(err?.error ?? "验证码送不出去，稍候再试");
        return;
      }
      const ok = (await res.json().catch(() => ({}))) as { mock?: boolean; fixedCode?: string };
      if (ok.mock) {
        toast.success("Mock 模式 · 输任意 6 位数字即可登录");
      } else if (ok.fixedCode) {
        toast.success(`验证码已发送 · 开发模式固定验证码：${ok.fixedCode}`);
      } else {
        toast.success("验证码已发送");
      }
      setCooldown(60);
    } catch (e) {
      if (process.env.NODE_ENV !== "production") console.error("phone login fetch failed", e);
      toast.error("网络一时不通，稍候再试");
    } finally {
      setSending(false);
    }
  }

  async function login() {
    if (!phoneValid || !codeValid || verifying) return;
    setVerifying(true);
    try {
      const e164 = `+86${phone.trim()}`;
      const res = await fetch("/api/auth/phone/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: e164, code: code.trim() }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const reason = err?.error;
        const msg =
          reason === "expired"
            ? "验证码过期，请重新发送"
            : reason === "wrong"
              ? "验证码不对"
              : reason === "too_many_attempts"
                ? "尝试次数过多，请重新发送"
                : reason ?? "登录一时不通，请再试一次";
        toast.error(msg);
        return;
      }
      const data = (await res.json()) as { isNew: boolean };
      toast.success(data.isNew ? "欢迎，先填份档案" : "登录成功");
      if (onSuccess) {
        onSuccess({ isNew: data.isNew });
        return;
      }
      const target = data.isNew ? "/onboarding" : (redirectTo ?? "/");
      router.replace(target);
    } catch (e) {
      if (process.env.NODE_ENV !== "production") console.error("phone login fetch failed", e);
      toast.error("网络一时不通，稍候再试");
    } finally {
      setVerifying(false);
    }
  }

  return (
    <GlassCard className="w-full max-w-md space-y-4 p-5" shadow="none">
      <header className="flex items-center justify-center gap-2">
        <Sparkle size={9} variant="asterisk" />
        <h2 className="font-[family-name:var(--font-serif)] text-[14px] tracking-ritual2 text-[var(--color-ink-plum)]">
          手 机 号 登 录
        </h2>
        <Sparkle size={9} variant="asterisk" />
      </header>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void login();
        }}
        data-testid="phone-login-form"
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="phone-input" className="text-xs text-[var(--color-ink-fade)]">
              手机号（中国大陆 +86）
            </Label>
            <div className="flex items-center gap-2">
              <span className="text-xs text-[var(--color-ink-mist)]">+86</span>
              <input
                id="phone-input"
                inputMode="numeric"
                maxLength={11}
                placeholder="请输入手机号"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
                data-testid="login-phone-input"
                className="h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone-code" className="text-xs text-[var(--color-ink-fade)]">
              验证码（6 位）
            </Label>
            <div className="flex items-center gap-2">
              <input
                id="phone-code"
                inputMode="numeric"
                maxLength={6}
                placeholder="6 位数字"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                data-testid="login-code-input"
                className="h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm"
              />
              <button
                type="button"
                disabled={!phoneValid || sending || cooldown > 0}
                onClick={sendOtp}
                className="h-10 shrink-0 rounded-lg border border-[var(--color-accent-lavender)]/40 bg-white px-3 text-[11px] text-[var(--color-ink-plum)] disabled:opacity-50"
                data-testid="login-send-otp"
              >
                {cooldown > 0 ? `${cooldown}s` : sending ? "发送中…" : "发送验证码"}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={!phoneValid || !codeValid || verifying}
            className="h-12 w-full rounded-[14px] bg-gradient-to-r from-[#F0B8C8] to-[#C9A1D9] font-[family-name:var(--font-serif)] text-[15px] font-bold tracking-ritual text-white shadow-pill hover:opacity-90 disabled:opacity-50"
            data-testid="login-submit"
          >
            {verifying ? "登录中…" : "登 录"}
          </button>

          <p className="text-center text-[10px] leading-relaxed text-[var(--color-ink-fade)]">
            手机号仅用于账号识别 · 不会用于营销 · 不会展示给其他用户
          </p>
        </div>
      </form>
    </GlassCard>
  );
}
