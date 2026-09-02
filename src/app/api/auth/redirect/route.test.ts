import { beforeEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({
  getCurrentSession: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/session", () => ({
  getCurrentSession: dependencies.getCurrentSession,
}));

import { GET } from "./route";

describe("GET /api/auth/redirect", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("routes an authenticated admin session to the admin surface", async () => {
    dependencies.getCurrentSession.mockResolvedValue({
      platformBlockedAt: null,
      role: "admin",
    });

    await expect((await GET()).json()).resolves.toEqual({
      redirectTo: "/admin",
    });
  });

  it("routes an authenticated support session to the admin surface", async () => {
    dependencies.getCurrentSession.mockResolvedValue({
      platformBlockedAt: null,
      role: "support",
    });

    await expect((await GET()).json()).resolves.toEqual({
      redirectTo: "/admin",
    });
  });

  it("refuses to redirect a blocked student", async () => {
    dependencies.getCurrentSession.mockResolvedValue({
      platformBlockedAt: new Date("2026-09-01T12:00:00.000Z"),
      role: "student",
    });

    const response = await GET();

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: "blocked" });
  });
});
