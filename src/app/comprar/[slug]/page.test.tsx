import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({
  getCurrentSession: vi.fn(),
  getPurchaseHandoffView: vi.fn(),
}));

vi.mock("@/lib/session", () => ({
  getCurrentSession: dependencies.getCurrentSession,
}));
vi.mock("@/features/payments/purchase-handoff", () => ({
  getPurchaseHandoffView: dependencies.getPurchaseHandoffView,
}));
vi.mock("./purchase-form-client", () => ({
  PurchaseFormClient: ({
    buyer,
    courseSlug,
    courseTitle,
  }: {
    buyer?: { email: string; name: string };
    courseSlug: string;
    courseTitle: string;
  }) => (
    <div
      data-buyer={buyer ? `${buyer.name}:${buyer.email}` : "anonymous"}
      data-client={`${courseSlug}:${courseTitle}`}
    />
  ),
}));

import PurchasePage, { dynamic } from "./page";

beforeEach(() => {
  vi.resetAllMocks();
  dependencies.getCurrentSession.mockResolvedValue(null);
});

describe("PurchasePage", () => {
  it("aguarda params e renderiza somente o Client no branch checkout", async () => {
    dependencies.getPurchaseHandoffView.mockResolvedValue({
      courseId: "course-1",
      courseSlug: "curso-publico",
      courseTitle: "Curso publico",
      kind: "checkout",
    });

    const markup = renderToStaticMarkup(
      await PurchasePage({ params: Promise.resolve({ slug: "curso-publico" }) })
    );

    expect(dynamic).toBe("force-dynamic");
    expect(dependencies.getPurchaseHandoffView).toHaveBeenCalledWith({
      session: null,
      slug: "curso-publico",
    });
    expect(markup).toContain('data-client="curso-publico:Curso publico"');
    expect(markup).not.toContain("<form");
  });

  it("renderiza CTA interno para acesso existente", async () => {
    dependencies.getPurchaseHandoffView.mockResolvedValue({
      courseId: "course-1",
      courseTitle: "Curso publico",
      href: "/app/cursos/course-1",
      kind: "access",
    });

    const markup = renderToStaticMarkup(
      await PurchasePage({ params: Promise.resolve({ slug: "curso-publico" }) })
    );

    expect(markup).toContain('href="/app/cursos/course-1"');
    expect(markup).toContain("Acessar curso");
    expect(markup).not.toContain("data-client");
  });

  it("prefills the immutable student identity in the unified purchase form", async () => {
    dependencies.getCurrentSession.mockResolvedValue({
      platformBlockedAt: null,
      role: "student",
      user: { email: "student@example.com", id: "student", name: "Student" },
    });
    dependencies.getPurchaseHandoffView.mockResolvedValue({
      courseId: "course-1",
      courseSlug: "curso-publico",
      courseTitle: "Curso publico",
      kind: "checkout",
    });

    const markup = renderToStaticMarkup(
      await PurchasePage({ params: Promise.resolve({ slug: "curso-publico" }) })
    );

    expect(markup).toContain('data-buyer="Student:student@example.com"');
  });

  it.each([
    ["account_blocked", "Conta bloqueada"],
    ["course_revoked", "Acesso encerrado"],
    ["team_account", "Conta de equipe"],
  ])("renderiza o bloqueio %s", async (reason, message) => {
    dependencies.getPurchaseHandoffView.mockResolvedValue({
      kind: "blocked",
      reason,
    });

    const markup = renderToStaticMarkup(
      await PurchasePage({ params: Promise.resolve({ slug: "curso-publico" }) })
    );

    expect(markup).toContain(message);
    expect(markup).toContain("suporte");
    expect(markup).not.toContain("data-client");
  });

  it.each([
    ["checkout_disabled", "Checkout indisponivel"],
    ["course_unavailable", "Curso indisponivel"],
  ])("renderiza a indisponibilidade %s", async (reason, message) => {
    dependencies.getPurchaseHandoffView.mockResolvedValue({
      kind: "unavailable",
      reason,
    });

    const markup = renderToStaticMarkup(
      await PurchasePage({ params: Promise.resolve({ slug: "curso-publico" }) })
    );

    expect(markup).toContain(message);
    expect(markup).toContain("suporte");
    expect(markup).not.toContain("data-client");
  });
});
