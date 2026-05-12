import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { AvatarPicker } from "./AvatarPicker";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh, push: vi.fn() }),
}));

const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock("sonner", () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccess(...args),
    error: (...args: unknown[]) => toastError(...args),
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  // jsdom 没有 createImageBitmap → AvatarPicker 自动降级为原文件上传
  vi.stubGlobal(
    "URL",
    Object.assign(window.URL, { createObjectURL: vi.fn(() => "blob:fake") }),
  );
});

describe("AvatarPicker", () => {
  it("无 currentUrl → 渲染默认头像", () => {
    render(<AvatarPicker currentUrl={null} nickname="云水" />);
    expect(screen.getByRole("img")).toHaveAttribute("src", "/images/ai-avatar.png");
  });

  it("有 currentUrl → 渲染 img", () => {
    render(<AvatarPicker currentUrl="/api/avatar/abc.jpg" nickname="云水" />);
    expect(screen.getByRole("img")).toHaveAttribute(
      "src",
      "/api/avatar/abc.jpg",
    );
  });

  it("非图片文件 → toast.error 拒绝", async () => {
    render(<AvatarPicker currentUrl={null} nickname="云" />);
    const input = screen.getByTestId("avatar-picker-input") as HTMLInputElement;
    const file = new File(["abc"], "doc.pdf", { type: "application/pdf" });
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith("请选图片文件");
    });
  });

  it("文件 > 5MB → toast.error 拒绝", async () => {
    render(<AvatarPicker currentUrl={null} nickname="云" />);
    const input = screen.getByTestId("avatar-picker-input") as HTMLInputElement;
    const big = new File([new Uint8Array(6 * 1024 * 1024)], "big.jpg", {
      type: "image/jpeg",
    });
    fireEvent.change(input, { target: { files: [big] } });
    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith(
        expect.stringContaining("图片太大"),
      );
    });
  });

  it("合法文件 → POST /api/me/avatar 带 FormData", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({ url: "/api/avatar/new.jpg", profile_id: "p-1" }),
          { status: 200 },
        ),
      ),
    );
    const onUploaded = vi.fn();
    render(
      <AvatarPicker
        currentUrl={null}
        nickname="云"
        profileId="p-1"
        onUploaded={onUploaded}
      />,
    );
    const input = screen.getByTestId("avatar-picker-input") as HTMLInputElement;
    const file = new File(["fake"], "a.jpg", { type: "image/jpeg" });
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/me/avatar",
        expect.objectContaining({ method: "POST" }),
      );
    });
    expect(toastSuccess).toHaveBeenCalledWith("头像已更新");
    expect(onUploaded).toHaveBeenCalledWith("/api/avatar/new.jpg");
    expect(refresh).toHaveBeenCalled();
  });

  it("API 报错 → toast.error 后端 error 字段 + 还原预览", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ error: "file_too_large" }), {
          status: 400,
        }),
      ),
    );
    render(<AvatarPicker currentUrl="/api/avatar/old.jpg" nickname="云" />);
    const input = screen.getByTestId("avatar-picker-input") as HTMLInputElement;
    const file = new File(["fake"], "a.jpg", { type: "image/jpeg" });
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith("file_too_large");
    });
  });

  it("camera 装饰始终渲染（点击触发上传 hint）", () => {
    const { container } = render(
      <AvatarPicker currentUrl={null} nickname="云" />,
    );
    expect(container.querySelector("svg.lucide-camera")).toBeTruthy();
  });
});
