import { createRequire } from "node:module";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const rootRequire = createRequire(resolve(process.cwd(), "package.json"));
const commandsRequire = createRequire(
  rootRequire.resolve("prosemirror-commands")
);

describe("lesson rich-text ProseMirror runtime", () => {
  it("resolves one shared prosemirror-model module", () => {
    expect(rootRequire.resolve("prosemirror-model")).toBe(
      commandsRequire.resolve("prosemirror-model")
    );
  });
});
