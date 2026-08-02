import { describe, expect, it } from "vitest";
import {
  createR2ObjectNamespace,
  parseR2ObjectPrefix,
} from "./r2-object-namespace";

describe("R2 object namespace", () => {
  it("keeps logical keys unchanged without a prefix", () => {
    const namespace = createR2ObjectNamespace(undefined);
    expect(namespace.toPhysicalKey("courses/a/cover.webp")).toBe(
      "courses/a/cover.webp"
    );
  });

  it("maps Staging keys and prefixes to one physical namespace", () => {
    const namespace = createR2ObjectNamespace("staging");
    expect(namespace.toPhysicalKey("courses/a/cover.webp")).toBe(
      "staging/courses/a/cover.webp"
    );
    expect(namespace.toPhysicalPrefix("uploads/admin-images/")).toBe(
      "staging/uploads/admin-images/"
    );
    expect(namespace.toLogicalKey("staging/courses/a/cover.webp")).toBe(
      "courses/a/cover.webp"
    );
  });

  it.each([
    "/staging",
    "staging/",
    "stage/../prod",
    ".",
    "..",
    "a/b",
  ])("rejects unsafe prefix %s", (prefix) =>
    expect(() => parseR2ObjectPrefix(prefix)).toThrow());
});
