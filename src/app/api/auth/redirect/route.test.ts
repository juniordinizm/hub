import { beforeEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({
  getCurrentSession: vi.fn(),
  getServerEnv: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/env", () => ({ getServerEnv: dependencies.getServerEnv }));
vi.mock("@/lib/session", () => ({
  getCurrentSession: dependencies.getCurrentSession,
}));

import { GET } from "./route";

describe("GET /api/auth/redirect", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dependencies.getServerEnv.mockReturnValue({
      PRIVILEGED_MFA_ENFORCED: true,
    });
  });

  it("sends privileged enrollment to setup when enforcement is active", async () => {
    dependencies.getCurrentSession.mockResolvedValue({
      platformBlockedAt: null,
      role: "support",
      twoFactorEnabled: false,
    });

    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      redirectTo: "/configurar-segundo-fator",
    });
  });

  it("keeps production rollout access open while enforcement is disabled", async () => {
    dependencies.getServerEnv.mockReturnValue({
      PRIVILEGED_MFA_ENFORCED: false,
    });
    dependencies.getCurrentSession.mockResolvedValue({
      platformBlockedAt: null,
      role: "admin",
      twoFactorEnabled: false,
    });

    await expect((await GET()).json()).resolves.toEqual({
      redirectTo: "/admin",
    });
  });

  it("routes a verified privileged session to the admin surface", async () => {
    dependencies.getCurrentSession.mockResolvedValue({
      platformBlockedAt: null,
      role: "admin",
      twoFactorEnabled: true,
    });

    await expect((await GET()).json()).resolves.toEqual({
      redirectTo: "/admin",
    });
  });
});
