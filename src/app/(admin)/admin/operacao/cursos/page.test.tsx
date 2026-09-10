import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  redirect: (path: string): never => {
    throw new Error(`redirect:${path}`);
  },
}));

import SupportCoursesPage from "./page";

describe("SupportCoursesPage", () => {
  it("redirects the legacy support course route to the canonical panel", () => {
    expect(() => SupportCoursesPage()).toThrow("redirect:/admin");
  });
});
