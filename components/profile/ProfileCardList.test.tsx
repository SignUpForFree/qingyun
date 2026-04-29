import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ProfileCardList, type ProfileCardItem } from "./ProfileCardList";

const refresh = vi.fn();
const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh, push }),
}));

const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock("sonner", () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccess(...args),
    error: (...args: unknown[]) => toastError(...args),
  },
}));

function makeProfile(overrides: Partial<ProfileCardItem> = {}): ProfileCardItem {
  return {
    id: "p-1",
    nickname: "云水",
    gender: "female",
    birth_date: "1995-03-08",
    birth_time: "10:00",
    birth_calendar: "solar",
    birth_place: "上海 上海市",
    is_default: true,
    avatar_url: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      new Response(JSON.stringify({ data: {} }), { status: 200 }),
    ),
  );
});

describe("ProfileCardList", () => {
  it("空列表 → 渲染添加档案 CTA", () => {
    render(<ProfileCardList profiles={[]} />);
    expect(screen.getByTestId("profile-new-cta")).toBeInTheDocument();
  });

  it("默认档案显示 默认 徽章", () => {
    render(<ProfileCardList profiles={[makeProfile()]} />);
    expect(screen.getByTestId("profile-default-badge-p-1")).toBeInTheDocument();
  });

  it("默认档案不渲染 设为默认 / 删除 按钮", () => {
    render(<ProfileCardList profiles={[makeProfile()]} />);
    expect(screen.queryByTestId("profile-set-default-p-1")).toBeNull();
    expect(screen.queryByTestId("profile-delete-p-1")).toBeNull();
  });

  it("非默认档案渲染 设为默认 + 删除 按钮", () => {
    render(<ProfileCardList profiles={[makeProfile({ is_default: false })]} />);
    expect(screen.getByTestId("profile-set-default-p-1")).toBeInTheDocument();
    expect(screen.getByTestId("profile-delete-p-1")).toBeInTheDocument();
  });

  it("点击 设为默认 → PUT /api/me/profiles/[id] is_default=true", async () => {
    render(<ProfileCardList profiles={[makeProfile({ is_default: false })]} />);
    fireEvent.click(screen.getByTestId("profile-set-default-p-1"));
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/me/profiles/p-1",
        expect.objectContaining({
          method: "PUT",
          body: JSON.stringify({ is_default: true }),
        }),
      );
    });
    expect(toastSuccess).toHaveBeenCalledWith("已设为默认档案");
    expect(refresh).toHaveBeenCalled();
  });

  it("点击 删除（确认后）→ DELETE /api/me/profiles/[id]", async () => {
    vi.stubGlobal("confirm", vi.fn(() => true));
    render(<ProfileCardList profiles={[makeProfile({ is_default: false })]} />);
    fireEvent.click(screen.getByTestId("profile-delete-p-1"));
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith("/api/me/profiles/p-1", {
        method: "DELETE",
      });
    });
    expect(toastSuccess).toHaveBeenCalledWith("档案已删除");
  });

  it("点击 删除（取消）→ 不发请求", () => {
    vi.stubGlobal("confirm", vi.fn(() => false));
    render(<ProfileCardList profiles={[makeProfile({ is_default: false })]} />);
    fireEvent.click(screen.getByTestId("profile-delete-p-1"));
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("渲染 + 新建一个档案 CTA", () => {
    render(<ProfileCardList profiles={[makeProfile()]} />);
    expect(screen.getByTestId("profile-new-cta")).toBeInTheDocument();
  });

  it("birth_time=12:00 显示 时辰未知", () => {
    render(<ProfileCardList profiles={[makeProfile({ birth_time: "12:00" })]} />);
    expect(screen.getByText(/时辰未知/)).toBeInTheDocument();
  });

  it("农历档案显示 农历", () => {
    render(
      <ProfileCardList profiles={[makeProfile({ birth_calendar: "lunar" })]} />,
    );
    expect(screen.getByText(/农历/)).toBeInTheDocument();
  });

  it("有 avatar_url → 渲染 img；无 → 渲染首字 fallback", () => {
    const { rerender } = render(
      <ProfileCardList
        profiles={[makeProfile({ avatar_url: "/uploads/a.jpg" })]}
      />,
    );
    expect(screen.getByRole("img")).toHaveAttribute("src", "/uploads/a.jpg");

    rerender(<ProfileCardList profiles={[makeProfile({ avatar_url: null })]} />);
    expect(screen.getByText("云")).toBeInTheDocument();
  });
});
