import { describe, expect, it } from "vitest";
import { decodeXmlEntities } from "./e2e-object-storage-xml";

describe("E2E object storage XML entities", () => {
  it("decodes each entity once without collapsing nested escapes", () => {
    expect(decodeXmlEntities("a&amp;b&lt;c&gt;d&quot;e&apos;f")).toBe(
      "a&b<c>d\"e'f"
    );
    expect(decodeXmlEntities("literal &amp;lt; marker")).toBe(
      "literal &lt; marker"
    );
  });
});
