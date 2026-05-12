import { describe, it, expect } from "vitest";
import {
  consumeStreamChunk,
  createStreamThinkState,
  flushStreamThinkState,
  stripThinkChain,
} from "./strip-think-chain";

describe("stripThinkChain", () => {
  it("strips <think>...</think>", () => {
    expect(stripThinkChain("<think>secret</think>visible")).toBe("visible");
  });

  it("strips multi-line <thinking>", () => {
    const input = "<thinking>\nlong chain\nof reasoning\n</thinking>\nfinal answer";
    expect(stripThinkChain(input)).toBe("final answer");
  });

  it("strips bracket forms [思考][/思考] / [推理][/推理]", () => {
    expect(stripThinkChain("[思考]内部[/思考]外部")).toBe("外部");
    expect(stripThinkChain("[推理]a[/推理]b")).toBe("b");
  });

  it("strips a leading '思考过程：' line block", () => {
    const input = "思考过程：先看天干 然后看地支\n实际答案在这里";
    expect(stripThinkChain(input)).toBe("实际答案在这里");
  });

  it("collapses 3+ newlines to 2", () => {
    expect(stripThinkChain("a\n\n\n\nb")).toBe("a\n\nb");
  });

  it("does not strip normal text without markers", () => {
    expect(stripThinkChain("正常回复内容")).toBe("正常回复内容");
  });
});

describe("consumeStreamChunk", () => {
  it("hides <think>...</think> across two chunks", () => {
    const s = createStreamThinkState();
    const a = consumeStreamChunk(s, "before<thi");
    const b = consumeStreamChunk(s, "nk>secret</think>after");
    expect(a + b).toBe("beforeafter");
    expect(flushStreamThinkState(s)).toBe("");
  });

  it("flushes carry tail when stream ends without tag", () => {
    const s = createStreamThinkState();
    const a = consumeStreamChunk(s, "hello");
    expect(a).toBe("hello");
    expect(flushStreamThinkState(s)).toBe("");
  });

  it("preserves text containing < that is not a tag start", () => {
    const s = createStreamThinkState();
    // < 后面不是 think，最终 flush 出 carry
    const a = consumeStreamChunk(s, "1<2");
    const tail = flushStreamThinkState(s);
    expect(a + tail).toBe("1<2");
  });

  it("handles think block fully inside a single chunk", () => {
    const s = createStreamThinkState();
    expect(consumeStreamChunk(s, "x<think>y</think>z")).toBe("xz");
    expect(flushStreamThinkState(s)).toBe("");
  });
});
