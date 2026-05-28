import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { DivinationReadingSection } from "./DivinationReadingSection";

describe("DivinationReadingSection", () => {
  it("流式且无正文时显示思考中...", () => {
    render(
      <DivinationReadingSection aiText="" readingStreaming>
        <p>不应出现</p>
      </DivinationReadingSection>,
    );
    expect(screen.getByTestId("divination-reading-thinking")).toBeInTheDocument();
    expect(screen.getByText("思考中...")).toBeInTheDocument();
    expect(screen.queryByText("不应出现")).not.toBeInTheDocument();
  });

  it("有正文且流式中渲染 children 与正文区", () => {
    render(
      <DivinationReadingSection aiText="第一段" readingStreaming>
        <p>正文区</p>
      </DivinationReadingSection>,
    );
    expect(screen.getByTestId("divination-reading-body")).toBeInTheDocument();
    expect(screen.getByText("正文区")).toBeInTheDocument();
    expect(screen.queryByText("思考中...")).not.toBeInTheDocument();
  });
});
