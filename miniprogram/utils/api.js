/**
 * api.js — 小程序 wx.request Promise 化封装
 *
 * 自动：
 *   - 拼 baseUrl（取自 globalData.baseUrl）
 *   - 带 Authorization: Bearer <jwt>（除非 options.skipAuth）
 *   - 401 时清空缓存重新 wx.login
 */

function getApp_() {
  return getApp();
}

function request(method, path, data, options = {}) {
  const app = getApp_();
  const url = (app && app.globalData && app.globalData.baseUrl ? app.globalData.baseUrl : "") + path;

  const header = {
    "content-type": "application/json",
  };
  if (!options.skipAuth && app && app.globalData && app.globalData.jwt) {
    header.Authorization = "Bearer " + app.globalData.jwt;
  }

  return new Promise((resolve, reject) => {
    wx.request({
      url,
      method,
      data,
      header,
      timeout: 60000,
      success(res) {
        if (res.statusCode === 401) {
          // 清缓存 + 重新登录
          wx.removeStorageSync("qy:auth");
          if (app && typeof app.login === "function") app.login();
          reject(new Error("unauthorized"));
          return;
        }
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res.data);
        } else {
          reject(new Error("HTTP " + res.statusCode + ": " + JSON.stringify(res.data)));
        }
      },
      fail(err) {
        reject(err);
      },
    });
  });
}

module.exports = {
  get: (path, options) => request("GET", path, undefined, options),
  post: (path, data, options) => request("POST", path, data, options),
  put: (path, data, options) => request("PUT", path, data, options),
  del: (path, options) => request("DELETE", path, undefined, options),
};
