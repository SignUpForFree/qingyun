"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { GlassCard, Sparkle } from "@/components/su";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

interface PhoneBindCardProps {
  /** 已绑定的 E.164 号码（已脱敏后端给的字段：+86 138****1234） */
  currentPhone?: string | null;
  /** 成功绑定/换绑后的回调（page-level refresh） */
  onBound?: () => void;
}

const PHONE_RE = /^1[3-9]\d{9}$/;

/**
 * PhoneBindCard — 手机号绑定/换绑卡（spec §3.5 / plan §M1.10）
 *
 * 流程：
 *   1. 输入 11 位手机号 → POST /api/me/phone/verify 发 OTP（dev mode console.info 出码）
 *   2. 60s 倒计时再发
 *   3. 输入 6 位 OTP → POST /api/me/phone/change 验码 + upsert phone_bind
 *   4. 成功 toast → onBound()
 *
 * stub 模式：M5 接入 SMS 网关前，sendOtp 仅在开发模式 console.info OTP 码，
 * 生产 NODE_ENV=production 仍可走通流程（自驱测试），但实际不会发短信。
 */
export function PhoneBindCard({ currentPhone, onBound }: PhoneBindCardProps) {
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
      const res = await fetch("/api/me/phone/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: e164 }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err?.error ?? `发送失败 (${res.status})`);
        return;
      }
      toast.success("验证码已发送，开发模式可在服务器日志查看");
      setCooldown(60);
    } catch (e) {
      toast.error(`网络异常：${e instanceof Error ? e.message : "未知错误"}`);
    } finally {
      setSending(false);
    }
  }

  async function bindPhone() {
    if (!phoneValid || !codeValid || verifying) return;
    setVerifying(true);
    try {
      const e164 = `+86${phone.trim()}`;
      const res = await fetch("/api/me/phone/change", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: e164, code: code.trim() }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err?.error ?? `绑定失败 (${res.status})`);
        return;
      }
      toast.success(currentPhone ? "手机号已换绑" : "手机号已绑定");
      setPhone("");
      setCode("");
      onBound?.();
      router.refresh();
    } catch (e) {
      toast.error(`网络异常：${e instanceof Error ? e.message : "未知错误"}`);
    } finally {
      setVerifying(false);
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void bindPhone();
      }}
      data-testid="phone-bind-card"
    >
      <GlassCard className="space-y-4 p-5">
      <header className="flex items-center justify-center gap-2">
        <Sparkle size={9} variant="asterisk" />
        <h2 className="font-[family-name:var(--font-serif)] text-[14px] tracking-ritual2 text-[var(--color-ink-plum)]">
          {currentPhone ? "换 绑 手 机 号" : "绑 定 手 机 号"}
        </h2>
        <Sparkle size={9} variant="asterisk" />
      </header>

      {currentPhone && (
        <p className="text-center text-[11px] text-[var(--color-ink-fade)]">
          当前：<span className="text-[var(--color-ink-plum)]">{currentPhone}</span>
        </p>
      )}

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
            data-testid="phone-input"
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
            data-testid="phone-code"
          />
          <Button
            type="button"
            variant="outline"
            disabled={!phoneValid || sending || cooldown > 0}
            onClick={sendOtp}
            className="h-10 shrink-0 px-3 text-[11px]"
            data-testid="phone-send-otp"
          >
            {cooldown > 0 ? `${cooldown}s 后重发` : sending ? "发送中…" : "发送验证码"}
          </Button>
        </div>
      </div>

      <Button
        type="submit"
        disabled={!phoneValid || !codeValid || verifying}
        className="h-12 w-full rounded-[14px] bg-gradient-to-r from-[#F0B8C8] to-[#C9A1D9] font-[family-name:var(--font-serif)] text-[15px] tracking-ritual text-white shadow-pill hover:opacity-90 disabled:opacity-50"
        data-testid="phone-bind-submit"
      >
        {verifying ? "绑定中…" : currentPhone ? "确认换绑" : "确认绑定"}
      </Button>

      <p className="text-center text-[10px] leading-relaxed text-[var(--color-ink-fade)]">
        手机号仅用于账号找回 · 不会用于营销 · 也不会展示给其他用户
      </p>
      </GlassCard>
    </form>
  );
}
