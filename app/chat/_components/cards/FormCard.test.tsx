import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { FormCard } from "./FormCard";

describe("FormCard", () => {
  it("渲染 title + 所有字段", () => {
    render(
      <FormCard
        title="梦境描述"
        fields={[
          { key: "core", label: "核心场景", type: "textarea", required: true, max: 500 },
          { key: "emotion", label: "情绪感受", type: "textarea", required: true, max: 200 },
        ]}
        submitLabel="精准解梦"
        onSubmit={() => {}}
      />,
    );
    expect(screen.getByText("梦境描述")).toBeInTheDocument();
    expect(screen.getByText("核心场景")).toBeInTheDocument();
    expect(screen.getByText("情绪感受")).toBeInTheDocument();
    expect(screen.getByText("精准解梦")).toBeInTheDocument();
  });

  it("必填项空时按钮 disabled", () => {
    const onSubmit = vi.fn();
    render(
      <FormCard
        title="t"
        submitLabel="去提交"
        fields={[{ key: "x", label: "X", required: true }]}
        onSubmit={onSubmit}
      />,
    );
    expect(screen.getByRole("button", { name: /去提交/ })).toBeDisabled();
  });

  it("填完必填后 submit 携带所有 values", () => {
    const onSubmit = vi.fn();
    render(
      <FormCard
        title="t"
        submitLabel="去提交"
        fields={[
          { key: "a", label: "A", required: true },
          { key: "b", label: "B" },
        ]}
        onSubmit={onSubmit}
      />,
    );
    const inputA = screen.getAllByRole("textbox")[0];
    fireEvent.change(inputA, { target: { value: "hello" } });
    fireEvent.click(screen.getByRole("button", { name: /去提交/ }));
    expect(onSubmit).toHaveBeenCalledWith({ a: "hello", b: "" });
  });

  it("max 显示字数计数", () => {
    render(
      <FormCard
        title="t"
        submitLabel="ok"
        fields={[{ key: "a", label: "A", max: 5 }]}
        onSubmit={() => {}}
      />,
    );
    expect(screen.getByText("0 / 5")).toBeInTheDocument();
  });
});
