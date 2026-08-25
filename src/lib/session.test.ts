import { beforeEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({
  getAuth: vi.fn(),
  getDb: vi.fn(),
  getServerEnv: vi.fn(),
  redirect: vi.fn((destination: string) => {
    throw new Error(`redirect:${destination}`);
  }),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue(new Headers()),
}));
vi.mock("next/navigation", () => ({ redirect: dependencies.redirect }));
vi.mock("@/db", () => ({ getDb: dependencies.getDb }));
vi.mock("@/lib/auth", () => ({ getAuth: dependencies.getAuth }));
vi.mock("@/lib/env", () => ({ getServerEnv: dependencies.getServerEnv }));

import { requireRole } from "./session";

const setDatabaseIdentity = ({
  role,
  twoFactorEnabled,
}: {
  role: "admin" | "student" | "support";
  twoFactorEnabled: boolean;
}) => {
  const limit = vi.fn().mockResolvedValue([
    {
      platformBlockedAt: null,
      platformBlockedReason: null,
      role,
      twoFactorEnabled,
    },
  ]);
  dependencies.getDb.mockReturnValue({
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        leftJoin: vi.fn(() => ({
          where: vi.fn(() => ({ limit })),
        })),
      })),
    })),
  });
};

describe("requireRole privileged assurance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dependencies.getAuth.mockReturnValue({
      api: {
        getSession: vi.fn().mockResolvedValue({
          user: {
            email: "staff@example.com",
            id: "staff-user",
            name: "Staff User",
          },
        }),
      },
    });
    dependencies.getServerEnv.mockReturnValue({
      PRIVILEGED_MFA_ENFORCED: true,
    });
  });

  it("denies a privileged server boundary without TOTP", async () => {
    setDatabaseIdentity({ role: "support", twoFactorEnabled: false });

    await expect(requireRole(["admin", "support"])).rejects.toThrow(
      "redirect:/configurar-segundo-fator"
    );
  });

  it("allows an active TOTP-enabled privileged session", async () => {
    setDatabaseIdentity({ role: "admin", twoFactorEnabled: true });

    await expect(requireRole(["admin", "support"])).resolves.toMatchObject({
      role: "admin",
      twoFactorEnabled: true,
    });
  });

  it("does not impose privileged TOTP on students", async () => {
    setDatabaseIdentity({ role: "student", twoFactorEnabled: false });

    await expect(requireRole(["student"])).resolves.toMatchObject({
      role: "student",
      twoFactorEnabled: false,
    });
  });
});
