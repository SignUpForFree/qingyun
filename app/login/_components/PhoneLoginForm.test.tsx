import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { PhoneLoginForm } from "./PhoneLoginForm";

const replace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, push: vi.fn(), refresh: vi.fn() }),
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

describe("PhoneLoginForm", () => {
  it("初始 phone/code 不合法 → 发送/登录 按钮都 disabled", () => {
    render(<PhoneLoginForm />);
    expect(screen.getByTestId("login-send-otp")).toBeDisabled();
    expect(screen.getByTestId("login-submit")).toBeDisabled();
  });

  it("phone 输入过滤非数字", () => {
    render(<PhoneLoginForm />);
    fireEvent.change(screen.getByTestId("login-phone-input"), {
      target: { value: "138-abc-8888" },
    });
    expect(
      (screen.getByTestId("login-phone-input") as HTMLInputElement).value,
    ).toBe("1388888");
  });

  it("phone 合法 → 发送验证码 启用 + 点击 POST /api/auth/phone/send-otp", async () => {
    render(<PhoneLoginForm />);
    fireEvent.change(screen.getByTestId("login-phone-input"), {
      target: { value: "13888887777" },
    });
    expect(screen.getByTestId("login-send-otp")).not.toBeDisabled();
    fireEvent.click(screen.getByTestId("login-send-otp"));
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/auth/phone/send-otp",
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

  it("phone+code 都合法 → 提交 POST /verify, isNew=true → 跳 /onboarding", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ userId: "u-1", isNew: true }), {
          status: 200,
        }),
      ),
    );
    render(<PhoneLoginForm redirectTo="/me" />);
    fireEvent.change(screen.getByTestId("login-phone-input"), {
      target: { value: "13888887777" },
    });
    fireEvent.change(screen.getByTestId("login-code-input"), {
      target: { value: "123456" },
    });
    expect(screen.getByTestId("login-submit")).not.toBeDisabled();
    fireEvent.click(screen.getByTestId("login-submit"));
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/auth/phone/verify",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ phone: "+8613888887777", code: "123456" }),
        }),
      );
    });
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/onboarding"));
    expect(toastSuccess).toHaveBeenCalledWith(
      expect.stringContaining("欢迎"),
    );
  });

  it("isNew=false → 跳 redirectTo", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ userId: "u-1", isNew: false }), {
          status: 200,
        }),
      ),
    );
    render(<PhoneLoginForm redirectTo="/me/profiles" />);
    fireEvent.change(screen.getByTestId("login-phone-input"), {
      target: { value: "13888887777" },
    });
    fireEvent.change(screen.getByTestId("login-code-input"), {
      target: { value: "123456" },
    });
    fireEvent.click(screen.getByTestId("login-submit"));
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/me/profiles"));
    expect(toastSuccess).toHaveBeenCalledWith("登录成功");
  });

  it("isNew=false 且无 redirectTo → 跳 /", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ userId: "u-1", isNew: false }), {
          status: 200,
        }),
      ),
    );
    render(<PhoneLoginForm />);
    fireEvent.change(screen.getByTestId("login-phone-input"), {
      target: { value: "13888887777" },
    });
    fireEvent.change(screen.getByTestId("login-code-input"), {
      target: { value: "123456" },
    });
    fireEvent.click(screen.getByTestId("login-submit"));
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/"));
  });

  it("send-otp 限流 → 显示倒计时秒数", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({ error: "rate_limited", cooldownMs: 45_000 }),
          { status: 429 },
        ),
      ),
    );
    render(<PhoneLoginForm />);
    fireEvent.change(screen.getByTestId("login-phone-input"), {
      target: { value: "13888887777" },
    });
    fireEvent.click(screen.getByTestId("login-send-otp"));
    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith(expect.stringContaining("45")),
    );
  });

  it("verify 报错 wrong → toast 验证码不对", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ error: "wrong" }), { status: 400 }),
      ),
    );
    render(<PhoneLoginForm />);
    fireEvent.change(screen.getByTestId("login-phone-input"), {
      target: { value: "13888887777" },
    });
    fireEvent.change(screen.getByTestId("login-code-input"), {
      target: { value: "123456" },
    });
    fireEvent.click(screen.getByTestId("login-submit"));
    await waitFor(() => expect(toastError).toHaveBeenCalledWith("验证码不对"));
    expect(replace).not.toHaveBeenCalled();
  });

  it("verify 报错 expired → toast 验证码过期", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ error: "expired" }), { status: 400 }),
      ),
    );
    render(<PhoneLoginForm />);
    fireEvent.change(screen.getByTestId("login-phone-input"), {
      target: { value: "13888887777" },
    });
    fireEvent.change(screen.getByTestId("login-code-input"), {
      target: { value: "123456" },
    });
    fireEvent.click(screen.getByTestId("login-submit"));
    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith(
        expect.stringContaining("过期"),
      ),
    );
  });

  it("verify 报错 too_many_attempts → toast 尝试次数过多", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ error: "too_many_attempts" }), {
          status: 429,
        }),
      ),
    );
    render(<PhoneLoginForm />);
    fireEvent.change(screen.getByTestId("login-phone-input"), {
      target: { value: "13888887777" },
    });
    fireEvent.change(screen.getByTestId("login-code-input"), {
      target: { value: "123456" },
    });
    fireEvent.click(screen.getByTestId("login-submit"));
    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith(
        expect.stringContaining("尝试次数过多"),
      ),
    );
  });
});
