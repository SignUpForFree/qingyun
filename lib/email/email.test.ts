import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ConsoleEmailProvider } from "./console";
import { createEmailProvider } from "./index";
import { SmtpEmailProvider } from "./smtp";

describe("ConsoleEmailProvider", () => {
  beforeEach(() => {
    vi.spyOn(console, "info").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("ok=true and logs", async () => {
    const p = new ConsoleEmailProvider();
    const r = await p.send({ to: "a@b.c", subject: "hi", text: "yo" });
    expect(r.ok).toBe(true);
    expect(console.info).toHaveBeenCalled();
  });
});

describe("createEmailProvider factory", () => {
  const orig = process.env.EMAIL_PROVIDER;
  afterEach(() => {
    if (orig === undefined) delete process.env.EMAIL_PROVIDER;
    else process.env.EMAIL_PROVIDER = orig;
  });

  it("type=console returns Console impl", () => {
    const p = createEmailProvider({ type: "console" });
    expect(p).toBeInstanceOf(ConsoleEmailProvider);
  });

  it("type=smtp returns Smtp impl", () => {
    const p = createEmailProvider({ type: "smtp" });
    expect(p).toBeInstanceOf(SmtpEmailProvider);
  });

  it("env=smtp returns Smtp impl", () => {
    process.env.EMAIL_PROVIDER = "smtp";
    const p = createEmailProvider();
    expect(p).toBeInstanceOf(SmtpEmailProvider);
  });

  it("missing env defaults to Console (safe fallback)", () => {
    delete process.env.EMAIL_PROVIDER;
    const p = createEmailProvider();
    expect(p).toBeInstanceOf(ConsoleEmailProvider);
  });
});

describe("SmtpEmailProvider", () => {
  const ENV = process.env;
  beforeEach(() => {
    process.env = { ...ENV };
  });
  afterEach(() => {
    process.env = ENV;
  });

  it("returns smtp_not_configured when env missing", async () => {
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASS;
    const p = new SmtpEmailProvider();
    const r = await p.send({ to: "a@b.c", subject: "x", text: "y" });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("smtp_not_configured");
  });

  it("returns nodemailer_not_installed when env set but nodemailer not in deps", async () => {
    process.env.SMTP_HOST = "smtp.example.com";
    process.env.SMTP_USER = "u";
    process.env.SMTP_PASS = "p";
    const p = new SmtpEmailProvider();
    const r = await p.send({ to: "a@b.c", subject: "x", text: "y" });
    expect(r.ok).toBe(false);
    expect(["nodemailer_not_installed", "nodemailer_load_failed"]).toContain(
      r.reason,
    );
  });
});
