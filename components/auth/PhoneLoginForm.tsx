"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const PHONE_RE = /^1[3-9]\d{9}$/;

type PhoneLoginFormLayout = "compact" | "fullscreen";

interface PhoneLoginFormProps {
  /** 登录后跳转目标（onSuccess 未传时用，默认 "/"） */
  redirectTo?: string;
  /**
   * 登录成功后回调（弹窗模式用此，避免 router.replace 整页跳转）。
   * 调用方负责关 Sheet + router.refresh()
   */
  onSuccess?: (info: { isNew: boolean }) => void;
  /** fullscreen：全屏页；compact：底部 Sheet */
  layout?: PhoneLoginFormLayout;
  className?: string;
}

/**
 * PhoneLoginForm — 手机号 + 6 位 OTP 登录表单
 */
export function PhoneLoginForm({
  redirectTo,
  onSuccess,
  layout = "compact",
  className,
}: PhoneLoginFormProps) {
  const router = useRouter();
  const [phone, setPhone] = React.useState("");
  const [code, setCode] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const [verifying, setVerifying] = React.useState(false);
  const [cooldown, setCooldown] = React.useState(0);

  const isFullscreen = layout === "fullscreen";

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

  const inputClass = cn(
    "w-full min-w-0 bg-transparent outline-none focus-visible:ring-0",
    isFullscreen
      ? "h-11 font-[family-name:var(--font-serif)] text-[17px] tracking-wide text-[var(--color-ink-plum)] placeholder:text-[14px] placeholder:font-normal placeholder:text-[var(--color-ink-ghost)]"
      : "h-9 rounded-lg border border-input px-3 text-base placeholder:text-muted-foreground md:text-sm focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
  );

  const labelClass = cn(
    "font-[family-name:var(--font-serif)] text-[var(--color-ink-plum)]",
    isFullscreen ? "text-[16px] font-semibold tracking-ritual" : "text-xs text-[var(--color-ink-fade)]",
  );

  const otpBtnClass = cn(
    "shrink-0 whitespace-nowrap transition-opacity disabled:opacity-40",
    isFullscreen
      ? "text-[15px] font-semibold text-[var(--color-accent-plum)]"
      : "h-9 rounded-lg border border-[var(--color-accent-lavender)]/40 bg-white px-3 text-[11px] text-[var(--color-ink-plum)]",
  );

  const fieldBorder = isFullscreen
    ? "border-b border-[var(--color-accent-lavender)]/35 pb-1"
    : "";

  return (
    <div className={className}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void login();
        }}
        data-testid="phone-login-form"
        className={cn(isFullscreen ? "space-y-6" : "space-y-4")}
      >
        <div className={cn(isFullscreen ? "space-y-6" : "space-y-4")}>
          <div className="space-y-2.5">
            <label htmlFor="phone-input" className={labelClass}>
              {isFullscreen ? "手机号" : "手机号（中国大陆 +86）"}
            </label>
            <div className={cn("flex items-center gap-2", fieldBorder)}>
              <span
                className={cn(
                  "shrink-0 text-[var(--color-ink-mist)]",
                  isFullscreen ? "font-[family-name:var(--font-serif)] text-[17px]" : "text-xs",
                )}
              >
                +86
              </span>
              <input
                id="phone-input"
                inputMode="numeric"
                maxLength={11}
                placeholder={isFullscreen ? "请输入11位手机号" : "请输入手机号"}
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
                data-testid="login-phone-input"
                autoComplete="tel-national"
                className={inputClass}
              />
              {isFullscreen ? (
                <button
                  type="button"
                  disabled={!phoneValid || sending || cooldown > 0}
                  onClick={sendOtp}
                  data-testid="login-send-otp"
                  className={otpBtnClass}
                >
                  {cooldown > 0 ? `${cooldown}s` : sending ? "发送中…" : "获取验证码"}
                </button>
              ) : null}
            </div>
          </div>

          <div className="space-y-2.5">
            {!isFullscreen ? (
              <div className="flex items-end justify-between gap-3">
                <label htmlFor="phone-code" className={labelClass}>
                  验证码（6 位）
                </label>
                <button
                  type="button"
                  disabled={!phoneValid || sending || cooldown > 0}
                  onClick={sendOtp}
                  data-testid="login-send-otp"
                  className={otpBtnClass}
                >
                  {cooldown > 0 ? `${cooldown}s 后重发` : sending ? "发送中…" : "获取验证码"}
                </button>
              </div>
            ) : (
              <label htmlFor="phone-code" className={labelClass}>
                验证码
              </label>
            )}
            <div className={fieldBorder}>
              <input
                id="phone-code"
                inputMode="numeric"
                maxLength={6}
                placeholder={isFullscreen ? "请输入6位验证码" : "6 位数字"}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                data-testid="login-code-input"
                autoComplete="one-time-code"
                className={inputClass}
              />
            </div>
          </div>
        </div>

        <div
          className={cn(
            "space-y-4",
            isFullscreen && "pt-6",
          )}
        >
          <button
            type="submit"
            disabled={!phoneValid || !codeValid || verifying}
            className={cn(
              "w-full font-[family-name:var(--font-serif)] font-bold tracking-ritual text-white transition-all",
              "bg-gradient-to-r from-[#F0B8C8] to-[#C9A1D9] shadow-pill hover:opacity-90 active:scale-[0.99]",
              "disabled:cursor-not-allowed disabled:opacity-45",
              isFullscreen ? "h-14 rounded-full text-[16px]" : "h-12 rounded-[14px] text-[15px]",
            )}
            data-testid="login-submit"
          >
            {verifying ? "登录中…" : "登录"}
          </button>

          <p
            className={cn(
              "text-center leading-relaxed text-[var(--color-ink-fade)]",
              isFullscreen ? "text-[11px]" : "text-[10px]",
            )}
          >
            手机号仅用于账号识别，不用于营销，不展示给其他用户
          </p>
        </div>
      </form>
    </div>
  );
}
