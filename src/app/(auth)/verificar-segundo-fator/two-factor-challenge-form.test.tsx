// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({
  verifyBackupCode: vi.fn(),
  verifyTotp: vi.fn(),
}));

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    twoFactor: {
      verifyBackupCode: dependencies.verifyBackupCode,
      verifyTotp: dependencies.verifyTotp,
    },
  },
}));

import { TwoFactorChallengeForm } from "./two-factor-challenge-form";

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root | null = null;

beforeEach(() => {
  vi.clearAllMocks();
  container = document.createElement("div");
  document.body.append(container);
  dependencies.verifyTotp.mockResolvedValue({ error: { message: "invalid" } });
  dependencies.verifyBackupCode.mockResolvedValue({
    error: { message: "invalid" },
  });
  root = createRoot(container);
  act(() => root?.render(<TwoFactorChallengeForm />));
});

afterEach(() => {
  act(() => root?.unmount());
  root = null;
  container.remove();
});

const submitCode = async (code: string): Promise<void> => {
  const input = container.querySelector<HTMLInputElement>("input[name=code]");
  const form = container.querySelector("form");
  if (!(input && form)) {
    throw new Error("challenge form unavailable");
  }
  input.value = code;
  await act(async () => {
    form.dispatchEvent(
      new SubmitEvent("submit", { bubbles: true, cancelable: true })
    );
    await Promise.resolve();
  });
};

describe("TwoFactorChallengeForm", () => {
  it("submits TOTP without trusting the device and exposes generic failure", async () => {
    await submitCode("123456");

    expect(dependencies.verifyTotp).toHaveBeenCalledWith({
      code: "123456",
      trustDevice: false,
    });
    expect(container.textContent).toContain(
      "Não foi possível validar o código. Tente novamente."
    );
    expect(
      container.querySelector<HTMLInputElement>("input[name=code]")
        ?.autocomplete
    ).toBe("one-time-code");
  });

  it("consumes a backup code without disabling the new session", async () => {
    const switchButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.includes("recuperação")
    );
    if (!switchButton) {
      throw new Error("backup switch unavailable");
    }
    await act(async () => switchButton.click());
    await submitCode("backup-code-once");

    expect(dependencies.verifyBackupCode).toHaveBeenCalledWith({
      code: "backup-code-once",
      disableSession: false,
    });
  });
});
