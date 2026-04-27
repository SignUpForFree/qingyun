import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ProfilePickerCard, type PickerProfile } from "./ProfilePickerCard";

const baseProfiles: readonly PickerProfile[] = [
  {
    id: "p-self",
    nickname: "我",
    isDefault: true,
    birthDate: "1990-08-15",
    gender: "male",
  },
  {
    id: "p-mom",
    nickname: "我妈",
    isDefault: false,
    birthDate: "1962-03-21",
    gender: "female",
  },
];

describe("ProfilePickerCard (M2.6)", () => {
  it("渲染所有档案 + 默认档案带 .default-profile 类", () => {
    const { container } = render(
      <ProfilePickerCard profiles={baseProfiles} onPick={() => {}} />,
    );

    const selfBtn = container.querySelector('[data-profile-id="p-self"]');
    expect(selfBtn).not.toBeNull();
    expect(selfBtn?.className).toMatch(/default-profile/);

    const momBtn = container.querySelector('[data-profile-id="p-mom"]');
    expect(momBtn?.className).not.toMatch(/default-profile/);
  });

  it("点击档案触发 onPick(profileId)", () => {
    const onPick = vi.fn();
    const { container } = render(
      <ProfilePickerCard profiles={baseProfiles} onPick={onPick} />,
    );
    const momBtn = container.querySelector(
      '[data-profile-id="p-mom"]',
    ) as HTMLButtonElement;
    expect(momBtn).not.toBeNull();
    fireEvent.click(momBtn);
    expect(onPick).toHaveBeenCalledWith("p-mom");
  });

  it("默认档案排序在前，即使输入顺序非 default-first", () => {
    const reversed = [baseProfiles[1], baseProfiles[0]];
    const { container } = render(
      <ProfilePickerCard profiles={reversed} onPick={() => {}} />,
    );
    const profileButtons = container.querySelectorAll("[data-profile-id]");
    expect(profileButtons[0].getAttribute("data-profile-id")).toBe("p-self");
    expect(profileButtons[1].getAttribute("data-profile-id")).toBe("p-mom");
  });

  it("含 '添加新档案' 链接（默认 allowAddNew=true）", () => {
    render(<ProfilePickerCard profiles={baseProfiles} onPick={() => {}} />);
    expect(screen.getByText("+ 添加新档案")).toBeInTheDocument();
  });

  it("conversationId 提供时 '添加新档案' return URL 含 cid", () => {
    render(
      <ProfilePickerCard
        profiles={baseProfiles}
        onPick={() => {}}
        conversationId="conv-abc"
      />,
    );
    const link = screen.getByText("+ 添加新档案").closest("a");
    expect(link?.getAttribute("href")).toMatch(/\/me\/profiles\/new\?return=/);
    expect(decodeURIComponent(link?.getAttribute("href") ?? "")).toContain(
      "/chat?cid=conv-abc",
    );
  });

  it("allowAddNew=false 时不渲染 '添加新档案'", () => {
    render(
      <ProfilePickerCard
        profiles={baseProfiles}
        onPick={() => {}}
        allowAddNew={false}
      />,
    );
    expect(screen.queryByText("+ 添加新档案")).toBeNull();
  });

  it("busy 时所有档案按钮 disabled 不触发 onPick", () => {
    const onPick = vi.fn();
    const { container } = render(
      <ProfilePickerCard profiles={baseProfiles} onPick={onPick} busy />,
    );
    const profileButtons = container.querySelectorAll(
      "[data-profile-id]",
    ) as NodeListOf<HTMLButtonElement>;
    for (const b of profileButtons) expect(b).toBeDisabled();
    fireEvent.click(profileButtons[0]);
    expect(onPick).not.toHaveBeenCalled();
  });

  it("selectedId 命中的档案带 ring 样式", () => {
    const { container } = render(
      <ProfilePickerCard
        profiles={baseProfiles}
        onPick={() => {}}
        selectedId="p-mom"
      />,
    );
    const momBtn = container.querySelector('[data-profile-id="p-mom"]');
    expect(momBtn?.className).toMatch(/ring-2/);
  });

  it("出生日期显示为 YYYY-MM", () => {
    render(<ProfilePickerCard profiles={baseProfiles} onPick={() => {}} />);
    expect(screen.getByText("1990-08")).toBeInTheDocument();
    expect(screen.getByText("1962-03")).toBeInTheDocument();
  });

  it("缺 birthDate 时不渲染日期行（不报错）", () => {
    const noBirth: PickerProfile = {
      id: "p-x",
      nickname: "无生辰",
      isDefault: false,
    };
    render(<ProfilePickerCard profiles={[noBirth]} onPick={() => {}} />);
    expect(screen.getByText("无生辰")).toBeInTheDocument();
  });
});
