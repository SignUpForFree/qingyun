import { describe, it, expect, vi, beforeEach } from "vitest";

// 在 import client 之前先 mock 依赖
const streamTextMock = vi.fn();

vi.mock("ai", () => ({
  streamText: (args: unknown) => streamTextMock(args),
}));

vi.mock("./gateway", () => ({
  getGateway: () => () => "mock-model-instance",
  AI_MODEL: "deepseek-chat",
}));

import { chat, __TEST__ } from "./client";

describe("chat() 非流式", () => {
  beforeEach(() => {
    streamTextMock.mockReset();
  });

  it("拼接 textStream chunks 成完整 text", async () => {
    streamTextMock.mockReturnValueOnce({
      textStream: (async function* () {
        yield "你好，";
        yield "今天宜静坐。";
      })(),
      usage: Promise.resolve({ totalTokens: 42 }),
    });

    const r = await chat({ messages: [{ role: "user", content: "今天运势" }] });
    expect(r.text).toBe("你好，今天宜静坐。");
    expect(r.tokensUsed).toBe(42);
  });

  it("totalTokens 缺失时返回 0", async () => {
    streamTextMock.mockReturnValueOnce({
      textStream: (async function* () {
        yield "x";
      })(),
      usage: Promise.resolve({}),
    });
    const r = await chat({ messages: [{ role: "user", content: "x" }] });
    expect(r.tokensUsed).toBe(0);
  });

  it("systemPrompt 注入到 messages 头", async () => {
    streamTextMock.mockImplementationOnce((args: { messages: { role: string }[] }) => {
      expect(args.messages[0].role).toBe("system");
      return {
        textStream: (async function* () {
          yield "ok";
        })(),
        usage: Promise.resolve({ totalTokens: 1 }),
      };
    });

    await chat({
      messages: [{ role: "user", content: "hi" }],
      systemPrompt: "你是助手",
    });
    expect(streamTextMock).toHaveBeenCalled();
  });

  it("streamText 抛错时返回 fallback 文本", async () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    streamTextMock.mockImplementationOnce(() => {
      throw new Error("network down");
    });
    const r = await chat({ messages: [{ role: "user", content: "x" }] });
    expect(r.text).toBe(__TEST__.FALLBACK_TEXT);
    expect(r.tokensUsed).toBe(0);
    expect(errSpy).toHaveBeenCalled();
    errSpy.mockRestore();
  });

  it("textStream 抛错时返回 fallback 文本", async () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    streamTextMock.mockReturnValueOnce({
      textStream: (async function* () {
        yield "partial";
        throw new Error("stream broken");
      })(),
      usage: Promise.resolve({ totalTokens: 0 }),
    });
    const r = await chat({ messages: [{ role: "user", content: "x" }] });
    expect(r.text).toBe(__TEST__.FALLBACK_TEXT);
    errSpy.mockRestore();
  });

  it("默认 temperature = 0.6", async () => {
    streamTextMock.mockImplementationOnce((args: { temperature: number }) => {
      expect(args.temperature).toBe(__TEST__.DEFAULT_TEMPERATURE);
      return {
        textStream: (async function* () {
          yield "x";
        })(),
        usage: Promise.resolve({ totalTokens: 0 }),
      };
    });
    await chat({ messages: [{ role: "user", content: "x" }] });
  });

  it("自定义 temperature 透传", async () => {
    streamTextMock.mockImplementationOnce((args: { temperature: number }) => {
      expect(args.temperature).toBe(0.2);
      return {
        textStream: (async function* () {
          yield "x";
        })(),
        usage: Promise.resolve({ totalTokens: 0 }),
      };
    });
    await chat({ messages: [{ role: "user", content: "x" }], temperature: 0.2 });
  });
});

describe("chat() 流式", () => {
  beforeEach(() => streamTextMock.mockReset());

  it("stream=true 时直接返回 result（不消费 textStream）", async () => {
    const result = {
      textStream: (async function* () {
        yield "should-not-be-consumed";
      })(),
      usage: Promise.resolve({ totalTokens: 0 }),
    };
    streamTextMock.mockReturnValueOnce(result);
    const r = await chat({ messages: [{ role: "user", content: "x" }], stream: true });
    expect(r).toBe(result);
  });
});
