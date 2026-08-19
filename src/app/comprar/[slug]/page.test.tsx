import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({
  getCurrentSession: vi.fn(),
  getPurchaseHandoffView: vi.fn(),
  redirect: vi.fn(),
  setCourseSaleInterestAction: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: dependencies.redirect,
  useRouter: () => ({ refresh: vi.fn() }),
}));
vi.mock("@/app/(student)/app/actions", () => ({
  setCourseSaleInterestAction: dependencies.setCourseSaleInterestAction,
}));

vi.mock("@/lib/session", () => ({
  getCurrentSession: dependencies.getCurrentSession,
}));
vi.mock("@/features/payments/purchase-handoff", () => ({
  getPurchaseHandoffView: dependencies.getPurchaseHandoffView,
}));
vi.mock("./purchase-handoff-client", () => ({
  PurchaseHandoffClient: ({
    courseSlug,
    courseTitle,
  }: {
    courseSlug: string;
    courseTitle: string;
  }) => <div data-client={`${courseSlug}:${courseTitle}`} />,
}));

import PurchasePage, { dynamic } from "./page";

beforeEach(() => {
  vi.resetAllMocks();
  dependencies.getCurrentSession.mockResolvedValue(null);
  dependencies.redirect.mockImplementation(() => {
    throw new Error("NEXT_REDIRECT");
  });
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

  it("renderiza o estado Em breve com data opcional", async () => {
    dependencies.getPurchaseHandoffView.mockResolvedValue({
      acceptsInterest: true,
      courseId: "course-1",
      courseTitle: "Curso futuro",
      isInterested: false,
      kind: "coming_soon",
      launchDate: "2026-10-01",
    });

    const markup = renderToStaticMarkup(
      await PurchasePage({ params: Promise.resolve({ slug: "curso-futuro" }) })
    );

    expect(markup).toContain("Em breve");
    expect(markup).toContain('dateTime="2026-10-01"');
    expect(markup).not.toContain("Iniciar compra");
  });

  it("permite que uma Student demonstre interesse em vendas pausadas", async () => {
    dependencies.getCurrentSession.mockResolvedValue({
      platformBlockedAt: null,
      role: "student",
      user: { id: "student-1" },
    });
    dependencies.getPurchaseHandoffView.mockResolvedValue({
      acceptsInterest: true,
      courseId: "course-1",
      courseTitle: "Curso pausado",
      isInterested: false,
      kind: "sales_closed",
    });

    const markup = renderToStaticMarkup(
      await PurchasePage({ params: Promise.resolve({ slug: "curso-pausado" }) })
    );

    expect(markup).toContain("Inscrições fechadas");
    expect(markup).toContain("Quero ser avisada");
    expect(markup).toContain('name="courseId" value="course-1"');
  });

  it("redireciona Em breve para a landing externa configurada", async () => {
    dependencies.getPurchaseHandoffView.mockResolvedValue({
      href: "https://landing.example/curso",
      kind: "external_redirect",
    });

    await expect(
      PurchasePage({ params: Promise.resolve({ slug: "curso-futuro" }) })
    ).rejects.toThrow("NEXT_REDIRECT");
    expect(dependencies.redirect).toHaveBeenCalledWith(
      "https://landing.example/curso"
    );
  });
});
