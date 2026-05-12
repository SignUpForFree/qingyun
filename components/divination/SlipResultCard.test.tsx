/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SlipResultCard } from "./SlipResultCard";

const BASE_PROPS = {
  number: 86,
  level: "上吉" as const,
  title: "天官赐福",
  poem: "灵签第一最为上，富贵荣华百事昌，若问求财皆遂意，更兼疾病保安康",
  reading: "综合维度：今日整体顺遂，可期。",
  dimension: "综合",
};

describe("SlipResultCard (design §7)", () => {
  it("签号渲染中文 八 · 十 · 六", () => {
    render(<SlipResultCard {...BASE_PROPS} />);
    const sig = screen.getByTestId("slip-signature");
    expect(sig.textContent).toMatch(/八.*十.*六/);
  });

  it("level pill 显示 上 吉", () => {
    render(<SlipResultCard {...BASE_PROPS} />);
    const pill = screen.getByTestId("slip-level-pill");
    expect(pill.textContent).toBe("上 吉");
  });

  it("title 居中拆字 + ✧ 装饰", () => {
    render(<SlipResultCard {...BASE_PROPS} />);
    const title = screen.getByTestId("slip-title");
    expect(title.textContent).toBe("天 官 赐 福");
  });

  it("poem 拆 4 行", () => {
    render(<SlipResultCard {...BASE_PROPS} />);
    const poem = screen.getByTestId("slip-poem");
    const lines = poem.querySelectorAll("p");
    expect(lines).toHaveLength(4);
  });

  it("无 readings → 仅显示 dimension 标签 + 单 reading", () => {
    render(<SlipResultCard {...BASE_PROPS} />);
    expect(screen.queryByTestId("slip-dim-tabs")).toBeNull();
    const reading = screen.getByTestId("slip-reading");
    expect(reading.textContent).toContain("综合维度");
  });

  it("传 6 维 readings → 渲染 6 tabs，default active 综合", () => {
    const readings = {
      综合: "综合 r",
      事业: "事业 r",
      财运: "财运 r",
      感情: "感情 r",
      人际: "人际 r",
      健康: "健康 r",
    };
    render(<SlipResultCard {...BASE_PROPS} readings={readings} />);
    const tabs = screen.getByTestId("slip-dim-tabs");
    expect(tabs.querySelectorAll("button")).toHaveLength(6);
    expect(screen.getByTestId("slip-reading").textContent).toContain("综合 r");
  });

  it("点击 tab 切换 reading", () => {
    const readings = { 综合: "综合 r", 财运: "财运 r" };
    render(<SlipResultCard {...BASE_PROPS} readings={readings} />);
    fireEvent.click(screen.getByTestId("slip-dim-财运"));
    expect(screen.getByTestId("slip-reading").textContent).toContain("财运 r");
  });

  it("缺数据的 tab 置灰且 disabled", () => {
    const readings = { 综合: "r", 事业: "r" };
    render(<SlipResultCard {...BASE_PROPS} readings={readings} />);
    const careerBtn = screen.getByTestId("slip-dim-事业") as HTMLButtonElement;
    const financeBtn = screen.getByTestId("slip-dim-财运") as HTMLButtonElement;
    expect(careerBtn.disabled).toBe(false);
    expect(financeBtn.disabled).toBe(true);
  });

  it("覆盖全部 6 种 level 都能正常渲染（不 undefined）", () => {
    const allLevels = [
      "上上", "上吉", "吉", "平", "渐顺", "慎行",
    ] as const;
    for (const lv of allLevels) {
      const { unmount } = render(<SlipResultCard {...BASE_PROPS} level={lv} />);
      const pill = screen.getByTestId("slip-level-pill");
      expect(pill.textContent?.replace(/\s/g, "")).toBe(lv);
      unmount();
    }
  });

  it("dimension 含'事业学业' → tab 选中映射到'事业'", () => {
    const readings = { 综合: "g", 事业: "career" };
    render(
      <SlipResultCard {...BASE_PROPS} dimension="事业学业" readings={readings} />,
    );
    expect(screen.getByTestId("slip-reading").textContent).toContain("career");
  });
});
