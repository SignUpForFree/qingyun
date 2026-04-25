"use client";

import * as React from "react";
import { AppHeader } from "@/components/layout";
import { GlassCard, Sparkle, Divider } from "@/components/su";
import { DatePicker, type DatePickerValue } from "@/components/onboarding/DatePicker";
import { RegionPicker, type RegionPickerValue } from "@/components/onboarding/RegionPicker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/**
 * P1 阶段占位 — 用于 design lab 验证 F2 / F3 组件视觉与交互。
 * F4 / F5 完成后会替换为完整 3 步 wizard + 提交 /api/profile。
 */
export default function OnboardingPlaceholderPage() {
  const [nickname, setNickname] = React.useState("");
  const [gender, setGender] = React.useState<"male" | "female" | "">("");
  const [birth, setBirth] = React.useState<DatePickerValue | null>(null);
  const [region, setRegion] = React.useState<RegionPickerValue | null>(null);

  const canPreview = nickname && gender && birth && region;

  return (
    <>
      <AppHeader title="档案 (P1 占位)" />
      <div className="flex flex-1 items-start justify-center p-6">
        <GlassCard className="w-full max-w-md space-y-5 p-6">
          <div className="text-center">
            <h2 className="text-xl tracking-ritual2">
              建立你的档案 <Sparkle size={14} />
            </h2>
            <p className="mt-1 text-xs text-[var(--color-ink-fade)]">
              P1 W1 design lab · F4 容器后续接入
            </p>
          </div>

          <Divider />

          <div className="space-y-2">
            <Label htmlFor="nickname">如何称呼你</Label>
            <Input
              id="nickname"
              placeholder="昵称"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>性别</Label>
            <Select value={gender} onValueChange={(v) => setGender((v ?? "") as typeof gender)}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="选择性别" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="male">男</SelectItem>
                <SelectItem value="female">女</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>出生日期 + 时辰</Label>
            <DatePicker value={birth} onChange={setBirth} />
          </div>

          <div className="space-y-2">
            <Label>出生地</Label>
            <RegionPicker value={region} onChange={setRegion} />
          </div>

          <Divider />

          <Button
            type="button"
            disabled={!canPreview}
            className="w-full"
            onClick={() => {
              // P1 占位：仅打印，F5 实装真实 POST /api/profile
              console.log("[onboarding 占位] 表单数据", {
                nickname,
                gender,
                birth,
                region,
              });
            }}
          >
            预览表单数据（P1 占位）
          </Button>
        </GlassCard>
      </div>
    </>
  );
}
