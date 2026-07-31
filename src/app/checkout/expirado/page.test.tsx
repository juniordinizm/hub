import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({
  query: vi.fn(),
}));
vi.mock("@/db", () => ({
  getPool: () => ({ query: dependencies.query }),
}));
vi.mock("server-only", () => ({}));

import CheckoutExpiredPage from "./page";

const ATTEMPT_ID = "7fb3447e-2702-48f8-abe2-6c47b091bdcb";

describe("CheckoutExpiredPage", () => {
  beforeEach(() => {
    dependencies.query.mockReset();
  });

  it("returns to the stable public purchase link from the order snapshot", async () => {
    dependencies.query.mockResolvedValue({
      rows: [{ checkout_course_slug: "formação neuro & prática" }],
    });

    const markup = renderToStaticMarkup(
      await CheckoutExpiredPage({
        searchParams: Promise.resolve({ attemptId: ATTEMPT_ID }),
      })
    );

    expect(dependencies.query).toHaveBeenCalledOnce();
    expect(dependencies.query.mock.calls[0]?.[0]).toContain(
      "select checkout_course_slug from orders"
    );
    expect(dependencies.query.mock.calls[0]?.[0]).toContain(
      "provider = 'asaas'"
    );
    expect(dependencies.query.mock.calls[0]?.[1]).toEqual([ATTEMPT_ID]);
    expect(markup).toContain(
      'href="/comprar/forma%C3%A7%C3%A3o%20neuro%20%26%20pr%C3%A1tica"'
    );
    expect(markup).not.toContain('href="/"');
  });

  it("does not query for an invalid attempt and offers support or login", async () => {
    const markup = renderToStaticMarkup(
      await CheckoutExpiredPage({
        searchParams: Promise.resolve({ attemptId: "not-a-uuid" }),
      })
    );

    expect(dependencies.query).not.toHaveBeenCalled();
    expect(markup).toContain("suporte");
    expect(markup).toContain('href="/entrar"');
    expect(markup).not.toContain('href="/"');
  });

  it("does not send a missing order to the protected home", async () => {
    dependencies.query.mockResolvedValue({ rows: [] });

    const markup = renderToStaticMarkup(
      await CheckoutExpiredPage({
        searchParams: Promise.resolve({ attemptId: ATTEMPT_ID }),
      })
    );

    expect(markup).toContain("suporte");
    expect(markup).toContain('href="/entrar"');
    expect(markup).not.toContain('href="/"');
  });
});
