import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { PhoneBindCard } from "./PhoneBindCard";

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
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    ),
  );
});

describe("PhoneBindCard", () => {
  it("currentPhone 为空 → 标题显示 绑定", () => {
    render(<PhoneBindCard />);
    expect(screen.getByText(/绑 定 手 机 号/)).toBeInTheDocument();
  });

  it("currentPhone 有值 → 标题显示 换绑 + 当前号码", () => {
    render(<PhoneBindCard currentPhone="+86 138****1234" />);
    expect(screen.getByText(/换 绑 手 机 号/)).toBeInTheDocument();
    expect(screen.getByText(/138\*\*\*\*1234/)).toBeInTheDocument();
  });

  it("phone 不合法 → 发送验证码 按钮 disabled", () => {
    render(<PhoneBindCard />);
    fireEvent.change(screen.getByTestId("phone-input"), {
      target: { value: "12345" },
    });
    expect(screen.getByTestId("phone-send-otp")).toBeDisabled();
  });

  it("phone 合法 → 发送验证码 启用 + 点击 POST /verify", async () => {
    render(<PhoneBindCard />);
    fireEvent.change(screen.getByTestId("phone-input"), {
      target: { value: "13888887777" },
    });
    expect(screen.getByTestId("phone-send-otp")).not.toBeDisabled();
    fireEvent.click(screen.getByTestId("phone-send-otp"));
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/me/phone/verify",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ phone: "+8613888887777" }),
        }),
      );
    });
    expect(toastSuccess).toHaveBeenCalledWith(
      expect.stringContaining("验证码已发送"),
    );
  });

  it("phone 输入自动过滤非数字", () => {
    render(<PhoneBindCard />);
    fireEvent.change(screen.getByTestId("phone-input"), {
      target: { value: "138-abc-8888" },
    });
    expect((screen.getByTestId("phone-input") as HTMLInputElement).value).toBe(
      "1388888",
    );
  });

  it("code 输入自动过滤非数字", () => {
    render(<PhoneBindCard />);
    fireEvent.change(screen.getByTestId("phone-code"), {
      target: { value: "1a2b3c" },
    });
    expect((screen.getByTestId("phone-code") as HTMLInputElement).value).toBe(
      "123",
    );
  });

  it("phone+code 都合法 → 提交按钮启用 + 点击 POST /change", async () => {
    const onBound = vi.fn();
    render(<PhoneBindCard onBound={onBound} />);
    fireEvent.change(screen.getByTestId("phone-input"), {
      target: { value: "13888887777" },
    });
    fireEvent.change(screen.getByTestId("phone-code"), {
      target: { value: "123456" },
    });
    expect(screen.getByTestId("phone-bind-submit")).not.toBeDisabled();
    fireEvent.click(screen.getByTestId("phone-bind-submit"));
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/me/phone/change",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ phone: "+8613888887777", code: "123456" }),
        }),
      );
    });
    expect(toastSuccess).toHaveBeenCalledWith("手机号已绑定");
    expect(onBound).toHaveBeenCalled();
  });

  it("currentPhone 有值 + 提交成功 → toast 换绑", async () => {
    render(<PhoneBindCard currentPhone="+86 138****0000" />);
    fireEvent.change(screen.getByTestId("phone-input"), {
      target: { value: "13888887777" },
    });
    fireEvent.change(screen.getByTestId("phone-code"), {
      target: { value: "123456" },
    });
    fireEvent.click(screen.getByTestId("phone-bind-submit"));
    await waitFor(() =>
      expect(toastSuccess).toHaveBeenCalledWith("手机号已换绑"),
    );
  });

  it("API 报错 → toast.error 展示后端 error 字段", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ error: "phone_already_bound" }), {
          status: 409,
        }),
      ),
    );
    render(<PhoneBindCard />);
    fireEvent.change(screen.getByTestId("phone-input"), {
      target: { value: "13888887777" },
    });
    fireEvent.change(screen.getByTestId("phone-code"), {
      target: { value: "123456" },
    });
    fireEvent.click(screen.getByTestId("phone-bind-submit"));
    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith("phone_already_bound"),
    );
  });
});
