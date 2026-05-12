const api = require("../../utils/api.js");

Page({
  data: {
    fortune: null,
    error: "",
    loading: true,
  },

  onShow() {
    this.fetchToday();
  },

  fetchToday() {
    this.setData({ loading: true });
    api.get("/api/fortune/today")
      .then((data) => {
        this.setData({ fortune: data, loading: false, error: "" });
      })
      .catch((err) => {
        this.setData({
          loading: false,
          error: err && err.message ? err.message : "加载失败",
        });
      });
  },

  goChat() {
    wx.switchTab({ url: "/pages/chat/index" });
  },
});
