import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ProfileSwitcher, type ProfileSwitcherItem } from "./ProfileSwitcher";

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

function makeItem(overrides: Partial<ProfileSwitcherItem> = {}): ProfileSwitcherItem {
  return {
    id: "p-1",
    nickname: "云水",
    is_default: true,
    birth_date: "1995-03-08",
    birth_calendar: "solar",
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

describe("ProfileSwitcher", () => {
  it("仅 1 档案 → 不渲染", () => {
    const { container } = render(<ProfileSwitcher profiles={[makeItem()]} />);
    expect(container.firstChild).toBeNull();
  });

  it("0 档案 → 不渲染", () => {
    const { container } = render(<ProfileSwitcher profiles={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it("≥2 档案 → 渲染 trigger 显示当前默认", () => {
    render(
      <ProfileSwitcher
        profiles={[
          makeItem({ id: "p-1", nickname: "任亮", is_default: true }),
          makeItem({ id: "p-2", nickname: "母亲", is_default: false }),
        ]}
      />,
    );
    const trigger = screen.getByTestId("profile-switcher-trigger");
    expect(trigger.textContent).toContain("任亮");
  });

  it("点击 trigger → 打开 sheet 列出全部档案", () => {
    render(
      <ProfileSwitcher
        profiles={[
          makeItem({ id: "p-1", nickname: "任亮", is_default: true }),
          makeItem({ id: "p-2", nickname: "母亲", is_default: false }),
        ]}
      />,
    );
    fireEvent.click(screen.getByTestId("profile-switcher-trigger"));
    expect(screen.getByTestId("profile-switcher-sheet")).toBeInTheDocument();
    expect(screen.getByTestId("profile-switcher-item-p-1")).toBeInTheDocument();
    expect(screen.getByTestId("profile-switcher-item-p-2")).toBeInTheDocument();
  });

  it("选中非当前档案 → PUT is_default=true + toast + refresh + 关闭", async () => {
    render(
      <ProfileSwitcher
        profiles={[
          makeItem({ id: "p-1", nickname: "任亮", is_default: true }),
          makeItem({ id: "p-2", nickname: "母亲", is_default: false }),
        ]}
      />,
    );
    fireEvent.click(screen.getByTestId("profile-switcher-trigger"));
    fireEvent.click(screen.getByTestId("profile-switcher-item-p-2"));
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/me/profiles/p-2",
        expect.objectContaining({
          method: "PUT",
          body: JSON.stringify({ is_default: true }),
        }),
      );
    });
    expect(toastSuccess).toHaveBeenCalledWith("已切到该档案");
    expect(refresh).toHaveBeenCalled();
  });

  it("选中当前档案 → 不发请求，关闭 sheet", () => {
    render(
      <ProfileSwitcher
        profiles={[
          makeItem({ id: "p-1", nickname: "任亮", is_default: true }),
          makeItem({ id: "p-2", nickname: "母亲", is_default: false }),
        ]}
      />,
    );
    fireEvent.click(screen.getByTestId("profile-switcher-trigger"));
    fireEvent.click(screen.getByTestId("profile-switcher-item-p-1"));
    expect(global.fetch).not.toHaveBeenCalled();
    expect(screen.queryByTestId("profile-switcher-sheet")).toBeNull();
  });

  it("点击 backdrop → 关闭 sheet", () => {
    render(
      <ProfileSwitcher
        profiles={[
          makeItem({ id: "p-1", is_default: true }),
          makeItem({ id: "p-2", is_default: false }),
        ]}
      />,
    );
    fireEvent.click(screen.getByTestId("profile-switcher-trigger"));
    fireEvent.click(screen.getByTestId("profile-switcher-backdrop"));
    expect(screen.queryByTestId("profile-switcher-sheet")).toBeNull();
  });

  it("管理档案链接指向 /me/profiles", () => {
    render(
      <ProfileSwitcher
        profiles={[
          makeItem({ id: "p-1", is_default: true }),
          makeItem({ id: "p-2", is_default: false }),
        ]}
      />,
    );
    fireEvent.click(screen.getByTestId("profile-switcher-trigger"));
    const manage = screen.getByTestId("profile-switcher-manage");
    expect(manage).toHaveAttribute("href", "/me/profiles");
  });
});
