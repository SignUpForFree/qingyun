const api = require("../../utils/api.js");

Page({
  data: {
    messages: [],
    input: "",
    sending: false,
    convId: null,
  },

  onInput(e) {
    this.setData({ input: e.detail.value });
  },

  /**
   * 注：小程序 wx.request 不直接支持 SSE。
   * 临时实现：把 stream:false 由后端返整段（需要后端 /api/chat 走非流式分支）。
   * 长期实现：用 wx.connectSocket / 后端转 WebSocket，或用分块返回 + AbortController。
   *
   * 当前 v1 的做法：拼"非流式"模式 — 把对话作为 sub-action 调用后端，
   * 但本仓库的 /api/chat 默认 SSE。所以下面是占位 — 真接入小程序流式时
   * 需要在后端加 ?stream=false 兜底，或者直接用 web-view 嵌 H5。
   */
  send() {
    const text = this.data.input.trim();
    if (!text || this.data.sending) return;
    this.setData({
      input: "",
      sending: true,
      messages: this.data.messages.concat([{ role: "user", content: text }]),
    });
    api.post("/api/chat", {
      conversationId: this.data.convId,
      text,
      // 后端目前默认 SSE；真接入需补 stream=false 分支
      stream: false,
    })
      .then((data) => {
        if (data && data.assistant) {
          this.setData({
            messages: this.data.messages.concat([
              { role: "assistant", content: data.assistant },
            ]),
            convId: data.conversationId || this.data.convId,
          });
        }
      })
      .catch((err) => {
        wx.showToast({
          title: err && err.message ? err.message : "发送失败",
          icon: "none",
        });
      })
      .finally(() => {
        this.setData({ sending: false });
      });
  },
});
