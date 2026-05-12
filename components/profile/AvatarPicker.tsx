"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Camera, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/util/api-fetch";

interface AvatarPickerProps {
  /** 当前头像 URL（已上传的 /api/avatar/xxx 或 null） */
  currentUrl: string | null;
  nickname: string;
  /** 目标 profile id（默认更新默认档） */
  profileId?: string;
  size?: number;
  className?: string;
  /** 上传成功后的回调，arg 是新 URL */
  onUploaded?: (url: string) => void;
}

const MAX_SOURCE_BYTES = 5 * 1024 * 1024; // 客户端上传前限制源文件 ≤ 5MB
const TARGET_SIZE = 256;

/**
 * AvatarPicker — 头像上传组件（客户端 resize 避免 sharp 依赖）
 *
 * 流程：
 *   1. 圆形预览：有 currentUrl → img；否 → 首字 fallback
 *   2. 点击触发隐藏 input[type=file]
 *   3. createImageBitmap → canvas 256×256 cover 裁剪 → toBlob jpeg q=0.85
 *   4. POST /api/me/avatar (FormData) → 后端写盘 + 更新 profile.avatar_url
 *   5. toast + onUploaded(newUrl) + router.refresh()
 *
 * 边界：
 *   - 选错文件类型（非 image/*）→ 立即 toast 拒绝
 *   - 源文件 > 5MB → 拒绝（让用户自己挑张小的，避免读不完）
 *   - canvas/ImageBitmap API 失败 → 兜底直接上传源文件
 */
export function AvatarPicker({
  currentUrl,
  nickname,
  profileId,
  size = 96,
  className,
  onUploaded,
}: AvatarPickerProps) {
  const router = useRouter();
  const fileRef = React.useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = React.useState(false);
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(currentUrl);

  React.useEffect(() => {
    setPreviewUrl(currentUrl);
  }, [currentUrl]);

  async function pick() {
    if (uploading) return;
    fileRef.current?.click();
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = ""; // allow re-uploading the same file
    if (!f) return;
    if (!f.type.startsWith("image/")) {
      toast.error("请选图片文件");
      return;
    }
    if (f.size > MAX_SOURCE_BYTES) {
      toast.error("图片太大（>5MB），请挑一张小点的");
      return;
    }

    setUploading(true);
    let blob: Blob = f;
    try {
      blob = await resizeToSquareJpeg(f, TARGET_SIZE);
    } catch (err) {
      console.warn("[AvatarPicker] client resize failed, upload source", err);
      // fall through with original file
    }

    // 本地预览（ObjectURL，组件 unmount 时不主动 revoke 也行，浏览器会回收）
    setPreviewUrl(URL.createObjectURL(blob));

    try {
      const fd = new FormData();
      fd.append("file", blob, "avatar.jpg");
      if (profileId) fd.append("profile_id", profileId);
      const res = await apiFetch("/api/me/avatar", { method: "POST", body: fd });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err?.error ?? `上传失败 (${res.status})`);
        setPreviewUrl(currentUrl);
        return;
      }
      const data = (await res.json()) as { url: string };
      toast.success("头像已更新");
      setPreviewUrl(data.url);
      onUploaded?.(data.url);
      router.refresh();
    } catch (err) {
      toast.error(`网络异常：${err instanceof Error ? err.message : "未知错误"}`);
      setPreviewUrl(currentUrl);
    } finally {
      setUploading(false);
    }
  }

  const displayUrl = previewUrl || "/images/ai-avatar.png";

  return (
    <div className={cn("relative inline-block", className)} data-testid="avatar-picker">
      <button
        type="button"
        onClick={pick}
        disabled={uploading}
        className={cn(
          "relative overflow-hidden rounded-full ring-1 ring-[var(--color-accent-lavender)]/40 transition-all",
          "hover:ring-2 hover:ring-[var(--color-accent-lavender)]/60",
          uploading && "opacity-70",
        )}
        style={{ width: size, height: size }}
        data-testid="avatar-picker-trigger"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={displayUrl}
          alt={nickname}
          className="h-full w-full object-cover"
        />
        {uploading && (
          <span className="absolute inset-0 flex items-center justify-center bg-black/30">
            <Loader2 className="h-5 w-5 animate-spin text-white" />
          </span>
        )}
      </button>

      <span
        className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full border border-white/60 bg-gradient-to-br from-[#F0B8C8] to-[#C9A1D9] text-white shadow-[0_2px_6px_rgba(160,140,210,0.35)]"
        aria-hidden
      >
        <Camera className="h-3.5 w-3.5" />
      </span>

      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={onFile}
        data-testid="avatar-picker-input"
      />
    </div>
  );
}

/**
 * 用 createImageBitmap + canvas 把图片 cover 裁剪到 size×size 并输出 jpeg blob。
 * 不引 sharp 等 native 依赖；老浏览器降级到原文件。
 */
async function resizeToSquareJpeg(file: File, size: number): Promise<Blob> {
  if (typeof createImageBitmap !== "function") {
    return file;
  }
  const bmp = await createImageBitmap(file);
  try {
    const canvas =
      typeof OffscreenCanvas !== "undefined"
        ? new OffscreenCanvas(size, size)
        : Object.assign(document.createElement("canvas"), {
            width: size,
            height: size,
          });
    const ctx = (canvas as unknown as { getContext: (t: string) => CanvasRenderingContext2D | null }).getContext("2d");
    if (!ctx) return file;

    const min = Math.min(bmp.width, bmp.height);
    const sx = (bmp.width - min) / 2;
    const sy = (bmp.height - min) / 2;
    ctx.drawImage(bmp, sx, sy, min, min, 0, 0, size, size);

    if ("convertToBlob" in canvas) {
      return await (canvas as OffscreenCanvas).convertToBlob({
        type: "image/jpeg",
        quality: 0.85,
      });
    }
    return await new Promise<Blob>((resolve, reject) => {
      (canvas as HTMLCanvasElement).toBlob(
        (b) => (b ? resolve(b) : reject(new Error("toBlob null"))),
        "image/jpeg",
        0.85,
      );
    });
  } finally {
    bmp.close();
  }
}
