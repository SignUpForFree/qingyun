/**
 * stripThinkChain — 客户端 / 服务端共享的"思考链"剥离器
 *
 * 与 lib/ai/output-sanitizer.ts 的 stripThinkChain 行为一致，单独抽到
 * 无 server-only 副作用的文件，让 use-chat-stream（"use client"）也能 import。
 *
 * 详见 docs/superpowers/specs/2026-05-06-launch-readiness.md。
 */
const THINK_TAG_PATTERNS: ReadonlyArray<RegExp> = [
  /<think[\s\S]*?<\/think>/gi,
  /<thinking[\s\S]*?<\/thinking>/gi,
  /\[思考\][\s\S]*?\[\/思考\]/g,
  /\[推理\][\s\S]*?\[\/推理\]/g,
  /\[reasoning\][\s\S]*?\[\/reasoning\]/gi,
];

/**
 * 只匹配"思考过程：xxx"的当前一行；不再贪心吞续行 — 因为没有可靠分隔符
 * 区分续行属于思考还是答案。安全策略：宁少剥不多剥。
 */
const THINK_LINE_PATTERN =
  /^[ \t]*(?:思考过程|推理过程|我的思考|思考链|reasoning)[：:][^\n]*\n?/gim;

export function stripThinkChain(text: string): string {
  let out = text;
  for (const re of THINK_TAG_PATTERNS) out = out.replace(re, "");
  out = out.replace(THINK_LINE_PATTERN, "");
  return out.replace(/\n{3,}/g, "\n\n").trimStart();
}

/**
 * 流式安全版：处理跨 chunk 的半截 `<think>` 起始标签。
 *
 * 用法：维护一个 `state` 对象传入，state.inThink=true 表示已进入 <think> 块、
 * 需要丢弃后续 chunk 直到见到 </think>；调用方拿到的 visibleChunk 就是可以
 * 安全 append 给 UI 的部分。
 */
export interface StreamThinkState {
  inThink: boolean;
  /** 上一帧未匹配完的尾巴（如 "<thi" 等待下一帧拼成 "<think>"） */
  carry: string;
}

export function createStreamThinkState(): StreamThinkState {
  return { inThink: false, carry: "" };
}

const OPEN_TAGS = ["<think>", "<think ", "<thinking>", "<thinking ", "[思考]", "[推理]", "[reasoning]"];
const CLOSE_TAGS = ["</think>", "</thinking>", "[/思考]", "[/推理]", "[/reasoning]"];
const MAX_CARRY = 16; // 最长 open/close 标签长度上限

export function consumeStreamChunk(
  state: StreamThinkState,
  chunk: string,
): string {
  let buf = state.carry + chunk;
  state.carry = "";
  let visible = "";

  while (buf.length > 0) {
    if (state.inThink) {
      // 找最近的关闭标签
      let idx = -1;
      let tag = "";
      for (const t of CLOSE_TAGS) {
        const i = buf.toLowerCase().indexOf(t.toLowerCase());
        if (i !== -1 && (idx === -1 || i < idx)) {
          idx = i;
          tag = t;
        }
      }
      if (idx === -1) {
        // 还没看到关闭，全丢；保留尾部 < MAX_CARRY 字节防止半截
        state.carry = buf.slice(-MAX_CARRY);
        buf = "";
      } else {
        buf = buf.slice(idx + tag.length);
        state.inThink = false;
      }
      continue;
    }

    // 不在 think 内，找最近的开启标签
    let idx = -1;
    let tag = "";
    for (const t of OPEN_TAGS) {
      const i = buf.toLowerCase().indexOf(t.toLowerCase());
      if (i !== -1 && (idx === -1 || i < idx)) {
        idx = i;
        tag = t;
      }
    }
    if (idx === -1) {
      // 没有开启标签：保留尾部 carry 防半截 "<thi"，其余可见
      if (buf.length > MAX_CARRY) {
        visible += buf.slice(0, buf.length - MAX_CARRY);
        state.carry = buf.slice(buf.length - MAX_CARRY);
      } else {
        // 全部尾巴都不安全 flush（可能正在拼 <think>），留到下一帧
        // 但若不含 '<' 也不含 '['，可全 flush
        if (!buf.includes("<") && !buf.includes("[")) {
          visible += buf;
        } else {
          state.carry = buf;
        }
      }
      buf = "";
    } else {
      visible += buf.slice(0, idx);
      buf = buf.slice(idx + tag.length);
      state.inThink = true;
    }
  }

  return visible;
}

/** flush 残留 carry（stream 结束时调用） */
export function flushStreamThinkState(state: StreamThinkState): string {
  if (state.inThink) {
    state.inThink = false;
    state.carry = "";
    return "";
  }
  const tail = state.carry;
  state.carry = "";
  // 残留 carry 若不含完整开启标签，整段输出
  for (const t of OPEN_TAGS) {
    if (tail.toLowerCase().includes(t.toLowerCase())) return "";
  }
  return tail;
}
