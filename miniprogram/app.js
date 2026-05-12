const api = require("./utils/api.js");

App({
  globalData: {
    /** API 基址：开发=本机；上线=qingyun.example.com */
    baseUrl: "http://192.144.226.27:3000",
    /** 后端签的 JWT；wx.request 会自动带 */
    jwt: "",
    /** 用户 id（云端） */
    uid: "",
    /** 是否首次登录 → 跳 onboarding（等价 H5） */
    isNew: false,
  },

  onLaunch() {
    const cached = wx.getStorageSync("qy:auth");
    if (cached && cached.jwt && cached.uid) {
      this.globalData.jwt = cached.jwt;
      this.globalData.uid = cached.uid;
    } else {
      this.login();
    }
  },

  /**
   * wx.login → /api/auth/wechat-mini → 拿 JWT 缓存。
   * 失败时弹 toast；不 retry，让用户手动触发再登。
   */
  login(extra = {}) {
    const that = this;
    wx.login({
      success(res) {
        if (!res.code) {
          wx.showToast({ title: "微信登录失败", icon: "none" });
          return;
        }
        api.post(
          "/api/auth/wechat-mini",
          { code: res.code, ...extra },
          { skipAuth: true },
        ).then((data) => {
          if (data && data.jwt && data.uid) {
            that.globalData.jwt = data.jwt;
            that.globalData.uid = data.uid;
            that.globalData.isNew = !!data.isNew;
            wx.setStorageSync("qy:auth", {
              jwt: data.jwt,
              uid: data.uid,
            });
            if (data.isNew) {
              // 跳 H5 webview 的 /onboarding；纯小程序版可以做原生 onboarding 页
              wx.redirectTo({ url: "/pages/login/index" });
            }
          }
        }).catch((err) => {
          console.error("[login] failed", err);
          wx.showToast({ title: "登录失败", icon: "none" });
        });
      },
      fail(err) {
        console.error("[wx.login] fail", err);
        wx.showToast({ title: "微信登录不可用", icon: "none" });
      },
    });
  },
});
