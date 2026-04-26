"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { StepShell } from "./StepShell";
import type { OnboardingForm } from "./schema";

type Step1Value = Pick<OnboardingForm, "nickname" | "gender">;

interface Step1Props {
  initial: Partial<Step1Value>;
  onNext: (value: Step1Value) => void;
  /** 编辑模式下顶部 desc 改为提示文案 */
  editing?: boolean;
}

export function Step1Identity({ initial, onNext, editing }: Step1Props) {
  const [nickname, setNickname] = React.useState(initial.nickname ?? "");
  const [gender, setGender] = React.useState<Step1Value["gender"] | undefined>(initial.gender);

  const valid = nickname.trim().length >= 1 && nickname.trim().length <= 20 && gender !== undefined;

  return (
    <StepShell
      step={1}
      total={3}
      title={editing ? "编辑档案" : "你是谁"}
      desc={editing ? "改任意一项后到 Step 3 提交，会替换默认档案" : "先认识一下，简单两步"}
      nextDisabled={!valid}
      onNext={() => {
        if (!valid || !gender) return;
        onNext({ nickname: nickname.trim(), gender });
      }}
    >
      <div className="space-y-2">
        <Label htmlFor="nickname">如何称呼你</Label>
        <Input
          id="nickname"
          autoFocus
          maxLength={20}
          placeholder="昵称（最多 20 字）"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label>性别（影响大运排法）</Label>
        <div className="grid grid-cols-2 gap-2">
          <GenderTile
            label="男"
            active={gender === "male"}
            onClick={() => setGender("male")}
          />
          <GenderTile
            label="女"
            active={gender === "female"}
            onClick={() => setGender("female")}
          />
        </div>
      </div>
    </StepShell>
  );
}

function GenderTile({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "h-12 rounded-[8px] border text-sm transition-all duration-300",
        active
          ? "border-transparent bg-gradient-to-br from-[#F0B8C8]/40 to-[#C9A1D9]/40 text-[var(--color-ink-plum)] shadow-pill"
          : "border-[var(--color-accent-lavender)]/30 bg-white/40 text-[var(--color-ink-mist)] hover:bg-white/60",
      )}
    >
      {label}
    </button>
  );
}
