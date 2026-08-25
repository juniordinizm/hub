// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({
  enable: vi.fn(),
  generateBackupCodes: vi.fn(),
  getTotpUri: vi.fn(),
  toDataURL: vi.fn(),
  verifyTotp: vi.fn(),
}));

vi.mock("qrcode", () => ({ default: { toDataURL: dependencies.toDataURL } }));
vi.mock("next/image", () => ({
  default: (props: Record<string, unknown>) => (
    <span
      aria-label={String(props.alt ?? "")}
      data-image-src={String(props.src ?? "")}
      role="img"
    />
  ),
}));
vi.mock("@/lib/auth-client", () => ({
  authClient: {
    twoFactor: {
      enable: dependencies.enable,
      generateBackupCodes: dependencies.generateBackupCodes,
      getTotpUri: dependencies.getTotpUri,
      verifyTotp: dependencies.verifyTotp,
    },
  },
}));

import { TwoFactorSetupForm } from "./two-factor-setup-form";

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;
vi.stubGlobal(
  "ResizeObserver",
  class ResizeObserver {
    disconnect = vi.fn();
    observe = vi.fn();
    unobserve = vi.fn();
  }
);

let container: HTMLDivElement;
let root: Root | null = null;

beforeEach(() => {
  vi.clearAllMocks();
  dependencies.toDataURL.mockResolvedValue("data:image/png;base64,qr");
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root?.unmount());
  root = null;
  container.remove();
});

const submitCurrentForm = async (fields: Record<string, string>) => {
  const form = container.querySelector("form");
  if (!form) {
    throw new Error("setup form unavailable");
  }
  for (const [name, value] of Object.entries(fields)) {
    const input = form.querySelector<HTMLInputElement>(`[name=${name}]`);
    if (!input) {
      throw new Error(`field ${name} unavailable`);
    }
    input.value = value;
  }
  await act(async () => {
    form.dispatchEvent(
      new SubmitEvent("submit", { bubbles: true, cancelable: true })
    );
    await Promise.resolve();
  });
};

describe("TwoFactorSetupForm", () => {
  it("shows the QR, manual secret and one-time backup codes before activation", async () => {
    dependencies.enable.mockResolvedValue({
      data: {
        backupCodes: ["backup-one", "backup-two"],
        totpURI:
          "otpauth://totp/PROTEA-R%20Hub:staff?secret=MANUALSECRET&issuer=PROTEA-R%20Hub",
      },
      error: null,
    });
    dependencies.verifyTotp.mockResolvedValue({
      error: { message: "invalid" },
    });
    act(() => root?.render(<TwoFactorSetupForm mode="setup" />));

    await submitCurrentForm({ password: "password-current" });

    expect(dependencies.enable).toHaveBeenCalledWith({
      password: "password-current",
    });
    expect(container.textContent).toContain("MANUALSECRET");
    expect(container.textContent).toContain("backup-one");
    expect(container.textContent).toContain("backup-two");

    const checkbox =
      container.querySelector<HTMLButtonElement>("#stored-codes");
    if (!checkbox) {
      throw new Error("storage confirmation unavailable");
    }
    await act(async () => checkbox.click());
    await submitCurrentForm({ code: "123456" });

    expect(dependencies.verifyTotp).toHaveBeenCalledWith({
      code: "123456",
      trustDevice: false,
    });
  });

  it("reconfirms password and replaces the backup-code set during recovery", async () => {
    dependencies.getTotpUri.mockResolvedValue({
      data: {
        totpURI:
          "otpauth://totp/PROTEA-R%20Hub:staff?secret=RECOVERYSECRET&issuer=PROTEA-R%20Hub",
      },
      error: null,
    });
    dependencies.verifyTotp.mockResolvedValue({
      data: { status: true },
      error: null,
    });
    dependencies.generateBackupCodes.mockResolvedValue({
      data: { backupCodes: ["new-backup-one", "new-backup-two"] },
      error: null,
    });
    act(() => root?.render(<TwoFactorSetupForm mode="recovery" />));

    await submitCurrentForm({ password: "password-current" });
    await submitCurrentForm({ code: "654321" });

    expect(dependencies.getTotpUri).toHaveBeenCalledWith({
      password: "password-current",
    });
    expect(dependencies.generateBackupCodes).toHaveBeenCalledWith({
      password: "password-current",
    });
    expect(
      Array.from(container.querySelectorAll("li"), (item) => item.textContent)
    ).toEqual(["new-backup-one", "new-backup-two"]);
  });
});
