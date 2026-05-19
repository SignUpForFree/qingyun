/**
 * 保存图片到相册工具
 *
 * - 微信小程序环境：wx.saveImageToPhotosAlbum
 * - H5 通用：navigator.share({ files }) 或 fallback <a download>
 * - iOS Safari 兜底：尝试 navigator.share
 */

// 微信小程序 wx 类型声明（仅运行时检测，类型宽松）
declare const wx: undefined | {
  saveImageToPhotosAlbum: (opts: { filePath: string; success: () => void; fail: (err: unknown) => void }) => void;
  downloadFile: (opts: { url: string; success: (res: { tempFilePath: string }) => void; fail: (err: unknown) => void }) => void;
};

/**
 * 将图片 URL 保存到相册
 */
export async function saveImageToAlbum(imageUrl: string, filename: string): Promise<void> {
  // 微信小程序环境
  if (typeof wx !== "undefined" && wx.saveImageToPhotosAlbum) {
    // 先下载到临时文件再保存
    const res = await new Promise<{ tempFilePath: string }>((resolve, reject) => {
      wx.downloadFile({
        url: imageUrl,
        success: resolve,
        fail: reject,
      });
    });
    try {
      await new Promise<void>((resolve, reject) => {
        wx.saveImageToPhotosAlbum({
          filePath: res.tempFilePath,
          success: () => resolve(),
          fail: reject,
        });
      });
    } catch {
      throw new Error("请开启相册权限，以便保存签文");
    }
    return;
  }

  // H5：先 fetch blob
  const response = await fetch(imageUrl);
  if (!response.ok) throw new Error(`下载图片失败: ${response.status}`);
  const blob = await response.blob();

  // 优先使用 Web Share API（iOS Safari 支持）
  if (navigator.share && navigator.canShare) {
    const file = new File([blob], filename, { type: blob.type || "image/png" });
    const shareData = { files: [file] };
    if (navigator.canShare(shareData)) {
      try {
        await navigator.share(shareData);
        return;
      } catch (e) {
        // 用户取消分享不视为错误
        if (e instanceof Error && e.name === "AbortError") return;
        // 其他错误 fallback 到 download
      }
    }
  }

  // Fallback：<a download>
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // 延迟释放 object URL，确保下载完成
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
