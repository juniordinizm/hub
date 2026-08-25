import { beforeEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({
  createR2ObjectReadUrl: vi.fn(),
  query: vi.fn(),
  requirePermission: vi.fn(),
  requireRole: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/db", () => ({ getPool: () => ({ query: dependencies.query }) }));
vi.mock("@/features/storage/r2", () => ({
  createR2ObjectReadUrl: dependencies.createR2ObjectReadUrl,
}));
vi.mock("@/lib/auth-permissions", () => ({
  requirePermission: dependencies.requirePermission,
}));
vi.mock("@/lib/session", () => ({ requireRole: dependencies.requireRole }));

import { GET } from "./route";

beforeEach(() => {
  vi.clearAllMocks();
  dependencies.query.mockResolvedValue({ rows: [] });
  dependencies.requireRole.mockResolvedValue({ role: "support" });
});

describe("GET /api/banners/[bannerId]/image", () => {
  it("denies support before reading the banner", async () => {
    dependencies.requirePermission.mockRejectedValue(
      new Error("permission_denied")
    );

    await expect(
      GET(new Request("http://localhost/api/banners/banner-1/image"), {
        params: Promise.resolve({ bannerId: "banner-1" }),
      })
    ).rejects.toThrow("permission_denied");

    expect(dependencies.requirePermission).toHaveBeenCalledWith(
      "manageSettings"
    );
    expect(dependencies.query).not.toHaveBeenCalled();
    expect(dependencies.createR2ObjectReadUrl).not.toHaveBeenCalled();
  });
});
