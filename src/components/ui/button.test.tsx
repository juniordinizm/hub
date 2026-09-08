import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Button } from "./button";

describe("Button loading state", () => {
  it("keeps the action label while exposing a native busy state", () => {
    const markup = renderToStaticMarkup(
      <Button loading type="submit">
        Salvar alterações
      </Button>
    );

    expect(markup).toContain("Salvar alterações");
    expect(markup).toContain('aria-busy="true"');
    expect(markup).toContain("disabled");
    expect(markup).toContain('data-loading="true"');
  });
});
