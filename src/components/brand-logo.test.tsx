import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BrandLogo } from "./brand-logo";

describe("BrandLogo", () => {
  it("uses the official platform asset with an accessible name", () => {
    const markup = renderToStaticMarkup(<BrandLogo />);

    expect(markup).toContain('alt="NeuroCapacitar"');
    expect(markup).toContain('src="/protear/logo-negativo.svg"');
  });
});
