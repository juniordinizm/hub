import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("sharp", () => {
  throw new Error("Sharp must not load in read-only R2 consumers.");
});

describe("R2 import boundary", () => {
  it("does not load image processors until an upload needs them", async () => {
    await expect(import("./r2")).resolves.toBeDefined();
  });
});
