/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { DreamResultCard } from "./DreamResultCard";

const MOCK_SECTIONS = {
  empathy: "这不是厄运，是潜意识的预警",
  threeViews: {
    zhouGong: "一夜安寝，诸事平稳",
    freud: "焦虑投射，现实压力的反应",
    jung: "内在自我的成长信号",
  },
  coreMeaning: "整体寓意：提醒你关注内心",
  suggestions: ["多休息", "调整作息", "适当放松"],
  subconsciousMsg: "你一直在努力，别太苛责自己",
  conclusion: "调整后就能顺利化解",
};

describe("DreamResultCard", () => {
  describe("fast 模式", () => {
    it("渲染 '快 速 解 梦' 标签", () => {
      render(<DreamResultCard mode="fast" aiText="快速解读" />);
      expect(screen.getByText("快 速 解 梦")).toBeInTheDocument();
      expect(screen.getByText("快速解读")).toBeInTheDocument();
    });

    it("AI 文本保留换行", () => {
      const txt = "周公视角\n\n现代心理学";
      render(<DreamResultCard mode="fast" aiText={txt} />);
      const p = screen.getByText(/周公视角/);
      expect(p.textContent).toContain("现代心理学");
    });
  });

  describe("precise 模式 — 无 sections fallback", () => {
    it("无 sections → 纯文本渲染 + '精 准 解 梦' 标签", () => {
      render(<DreamResultCard mode="precise" aiText="精准解读" />);
      expect(screen.getByText("精 准 解 梦")).toBeInTheDocument();
      expect(screen.getByText("精准解读")).toBeInTheDocument();
    });
  });

  describe("precise 模式 — 结构化 6 段", () => {
    it("渲染 6 段标题", () => {
      render(<DreamResultCard mode="precise" aiText="" sections={MOCK_SECTIONS} />);
      expect(screen.getByText(/你的梦境深度解析/)).toBeInTheDocument();
      expect(screen.getByText(/三重维度专业解读/)).toBeInTheDocument();
      expect(screen.getByText(/核心寓意与重要节点指引/)).toBeInTheDocument();
      expect(screen.getByText(/可落地的规避方案/)).toBeInTheDocument();
      expect(screen.getByText(/潜意识想对你说的真心话/)).toBeInTheDocument();
      expect(screen.getByText(/结语/)).toBeInTheDocument();
    });

    it("渲染开篇共情文本", () => {
      render(<DreamResultCard mode="precise" aiText="" sections={MOCK_SECTIONS} />);
      expect(screen.getByText("这不是厄运，是潜意识的预警")).toBeInTheDocument();
    });

    it("渲染三维度标签 + 内容", () => {
      render(<DreamResultCard mode="precise" aiText="" sections={MOCK_SECTIONS} />);
      expect(screen.getByText(/周公解梦 · 民俗意象/)).toBeInTheDocument();
      expect(screen.getByText(/弗洛伊德 · 愿望满足/)).toBeInTheDocument();
      expect(screen.getByText(/荣格 · 集体无意识/)).toBeInTheDocument();
      expect(screen.getByText("一夜安寝，诸事平稳")).toBeInTheDocument();
      expect(screen.getByText("焦虑投射，现实压力的反应")).toBeInTheDocument();
      expect(screen.getByText("内在自我的成长信号")).toBeInTheDocument();
    });

    it("渲染核心寓意", () => {
      render(<DreamResultCard mode="precise" aiText="" sections={MOCK_SECTIONS} />);
      expect(screen.getByText(/整体寓意：提醒你关注内心/)).toBeInTheDocument();
    });

    it("渲染规避方案列表", () => {
      render(<DreamResultCard mode="precise" aiText="" sections={MOCK_SECTIONS} />);
      expect(screen.getByText("多休息")).toBeInTheDocument();
      expect(screen.getByText("调整作息")).toBeInTheDocument();
      expect(screen.getByText("适当放松")).toBeInTheDocument();
    });

    it("渲染潜意识真心话", () => {
      render(<DreamResultCard mode="precise" aiText="" sections={MOCK_SECTIONS} />);
      expect(screen.getByText("你一直在努力，别太苛责自己")).toBeInTheDocument();
    });

    it("渲染结语", () => {
      render(<DreamResultCard mode="precise" aiText="" sections={MOCK_SECTIONS} />);
      expect(screen.getByText("调整后就能顺利化解")).toBeInTheDocument();
    });

    it("空 sections 字段 → 对应段落不渲染", () => {
      const partial = {
        ...MOCK_SECTIONS,
        coreMeaning: "",
        suggestions: [],
      };
      render(<DreamResultCard mode="precise" aiText="" sections={partial} />);
      expect(screen.queryByText(/核心寓意与重要节点指引/)).toBeNull();
      expect(screen.queryByText(/可落地的规避方案/)).toBeNull();
      // 其他段落仍在
      expect(screen.getByText(/你的梦境深度解析/)).toBeInTheDocument();
    });
  });

  describe("两种 mode 视觉区分", () => {
    it("fast / precise chip 背景类不同", () => {
      const { container: a } = render(<DreamResultCard mode="fast" aiText="x" />);
      const { container: b } = render(<DreamResultCard mode="precise" aiText="x" />);
      const fastChip = a.querySelector("span");
      const preciseChip = b.querySelector("span");
      expect(fastChip?.className).not.toBe(preciseChip?.className);
    });
  });
});
