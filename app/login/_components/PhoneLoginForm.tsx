"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { GlassCard, Sparkle } from "@/components/su";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

const PHONE_RE = /^1[3-9]\d{9}$/;

interface PhoneLoginFormProps {
  /** 登录后跳转目标（middleware 没传时默认 "/"） */
  redirectTo?: string;
}

/**
 * PhoneLoginForm — 浏览器手机号登录表单（M5 mock 阶段）
 *
 * 与 PhoneBindCard 区别：这个是登录前（无 cookie），那个是登录后绑定。
 *
 * 流程：
 *   1. 输入 11 位中国大陆手机号
 *   2. 点 发送验证码 → POST /api/auth/phone/send-otp
 *      （dev 模式：服务器 console.info；prod mock 阶段同样走 console.info，
 *        M5 接 SMS gateway 时统一替换）
 *   3. 60s 倒计时
 *   4. 输入 6 位 OTP，点 登录 → POST /api/auth/phone/verify
 *      返回 { userId, isNew }
 *   5. isNew=true → 跳 /onboarding；false → 跳 redirectTo
 */
export function PhoneLoginForm({ redirectTo }: PhoneLoginFormProps) {
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
        toast.error(err?.error ?? `发送失败 (${res.status})`);
        return;
      }
      toast.success("验证码已发送 · 当前 mock 阶段，看服务器日志取码");
      setCooldown(60);
    } catch (e) {
      toast.error(`网络异常：${e instanceof Error ? e.message : "未知错误"}`);
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
                : reason ?? `登录失败 (${res.status})`;
        toast.error(msg);
        return;
      }
      const data = (await res.json()) as { isNew: boolean };
      toast.success(data.isNew ? "欢迎，先填份档案" : "登录成功");
      const target = data.isNew ? "/onboarding" : redirectTo ?? "/";
      router.replace(target);
    } catch (e) {
      toast.error(`网络异常：${e instanceof Error ? e.message : "未知错误"}`);
    } finally {
      setVerifying(false);
    }
  }

  return (
    <GlassCard className="space-y-4 p-5" data-testid="phone-login-form">
      <header className="flex items-center justify-center gap-2">
        <Sparkle size={9} variant="asterisk" />
        <h2 className="font-[family-name:var(--font-serif)] text-[14px] tracking-ritual2 text-[var(--color-ink-plum)]">
          手 机 号 登 录
        </h2>
        <Sparkle size={9} variant="asterisk" />
      </header>

      <div className="space-y-2">
        <Label htmlFor="phone-input" className="text-xs text-[var(--color-ink-fade)]">
          手机号（中国大陆 +86）
        </Label>
        <div className="flex items-center gap-2">
          <span className="text-xs text-[var(--color-ink-mist)]">+86</span>
          <Input
            id="phone-input"
            inputMode="numeric"
            maxLength={11}
            placeholder="1XX XXXX XXXX"
            value={phone}
            onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
            data-testid="login-phone-input"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="phone-code" className="text-xs text-[var(--color-ink-fade)]">
          验证码（6 位）
        </Label>
        <div className="flex items-center gap-2">
          <Input
            id="phone-code"
            inputMode="numeric"
            maxLength={6}
            placeholder="6 位数字"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            data-testid="login-code-input"
          />
          <Button
            type="button"
            variant="outline"
            disabled={!phoneValid || sending || cooldown > 0}
            onClick={sendOtp}
            className="h-10 shrink-0 px-3 text-[11px]"
            data-testid="login-send-otp"
          >
            {cooldown > 0 ? `${cooldown}s` : sending ? "发送中…" : "发送验证码"}
          </Button>
        </div>
      </div>

      <Button
        type="button"
        disabled={!phoneValid || !codeValid || verifying}
        onClick={login}
        className="h-12 w-full rounded-[14px] bg-gradient-to-r from-[#F0B8C8] to-[#C9A1D9] font-[family-name:var(--font-serif)] text-[15px] tracking-ritual text-white shadow-pill hover:opacity-90 disabled:opacity-50"
        data-testid="login-submit"
      >
        {verifying ? "登录中…" : "登 录"}
      </Button>

      <p className="text-center text-[10px] leading-relaxed text-[var(--color-ink-fade)]">
        手机号仅用于账号识别 · 不会用于营销 · 不会展示给其他用户
        <br />
        微信内打开走微信授权，浏览器走手机号验证码
      </p>
    </GlassCard>
  );
}
