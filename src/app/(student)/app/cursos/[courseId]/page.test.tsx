import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({
  getStudentCourseOverview: vi.fn(),
  requireSession: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  notFound: vi.fn(),
  redirect: vi.fn(),
}));
vi.mock("@/components/panel-layout", () => ({
  RegisterPreviewCourseId: () => null,
}));
vi.mock("@/features/courses/server", () => ({
  getStudentCourseOverview: dependencies.getStudentCourseOverview,
}));
vi.mock("@/lib/session", () => ({
  requireSession: dependencies.requireSession,
}));
vi.mock("./course-overview-client", () => ({
  CourseOverviewClient: () => null,
}));
vi.mock("../../certificados/pending-certificate-refresh", () => ({
  PendingCertificateRefresh: ({
    showManualRefresh,
  }: {
    showManualRefresh?: boolean;
  }) =>
    showManualRefresh ? (
      <button data-certificate-refresh="enabled" type="button">
        Atualizar status
      </button>
    ) : null,
}));
vi.mock("@/components/support-request-dialog", () => ({
  SupportRequestDialog: ({ triggerLabel }: { triggerLabel: string }) => (
    <button type="button">{triggerLabel}</button>
  ),
}));

import StudentCourseOverviewPage from "./page";

const courseOverview = (
  overrides: Record<string, unknown> = {}
): Record<string, unknown> => ({
  certificateCode: "CERT-001",
  certificateEnabled: true,
  certificateRenderStatus: "ready",
  certificateStatus: "valid",
  completedCount: 1,
  course: {
    description: "Descrição",
    id: "course-1",
    subtitle: "Subtítulo",
    title: "Curso de teste",
  },
  modules: [],
  nextLessonId: null,
  progressPercent: 100,
  studentName: "Maria Silva",
  totalCount: 1,
  ...overrides,
});

const renderPage = async ({
  certificate = "issued",
  overview = courseOverview(),
}: {
  certificate?: string;
  overview?: Record<string, unknown>;
} = {}): Promise<string> => {
  dependencies.getStudentCourseOverview.mockResolvedValue(overview);

  return renderToStaticMarkup(
    await StudentCourseOverviewPage({
      params: Promise.resolve({ courseId: "course-1" }),
      searchParams: Promise.resolve({ certificate }),
    })
  );
};

describe("StudentCourseOverviewPage certificate feedback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dependencies.requireSession.mockResolvedValue({
      role: "student",
      user: { id: "student-1" },
    });
  });

  it("renders accessible success feedback without persisting the query signal", async () => {
    const markup = await renderPage();

    expect(markup).toContain('role="alert"');
    expect(markup).toContain("Curso concluído");
    expect(markup).toContain("Seu certificado foi emitido");
    expect(markup).not.toContain("?certificate=issued");
  });

  it("does not render completion feedback for an unrelated query value", async () => {
    const markup = await renderPage({ certificate: "other" });

    expect(markup).not.toContain("Curso concluído");
  });

  it.each([
    ["ready", "Seu certificado está pronto"],
    ["pending", "Certificado em preparação"],
  ])("renders the %s certificate panel", async (status, text) => {
    const markup = await renderPage({
      certificate: "",
      overview: courseOverview({ certificateRenderStatus: status }),
    });

    expect(markup).toContain('data-slot="card"');
    expect(markup).toContain(text);
  });

  it("keeps every certificate link contextual to the public certificate", async () => {
    const markup = await renderPage({ certificate: "" });

    expect(markup).toContain('href="/certificados/CERT-001"');
    expect(markup).toContain("Ver certificado");
    expect(markup).not.toContain("/app/certificados");
    expect(markup).not.toContain("certificate=issued");
  });

  it("polls pending preparation while offering an accessible manual refresh", async () => {
    const markup = await renderPage({
      certificate: "",
      overview: courseOverview({ certificateRenderStatus: "pending" }),
    });

    expect(markup).toContain('role="status"');
    expect(markup).toContain("Estamos preparando o PDF do seu certificado");
    expect(markup).toContain('data-certificate-refresh="enabled"');
    expect(markup).toContain("Atualizar status");
    expect(markup).not.toContain("/app/certificados");
  });

  it("shows incomplete progress without a certificate destination", async () => {
    const markup = await renderPage({
      certificate: "",
      overview: courseOverview({
        certificateCode: null,
        certificateRenderStatus: null,
        completedCount: 1,
        nextLessonId: "lesson-2",
        progressPercent: 50,
        totalCount: 2,
      }),
    });

    expect(markup).toContain("Falta 1 aula obrigatória");
    expect(markup).toContain("Conferir nome no perfil");
    expect(markup).not.toContain("/certificados/");
    expect(markup).not.toContain("Atualizar status");
  });

  it("presents failed PDF preparation as an error with support", async () => {
    const markup = await renderPage({
      certificate: "",
      overview: courseOverview({ certificateRenderStatus: "failed" }),
    });

    expect(markup).toContain("Falha no preparo do PDF");
    expect(markup).toContain("Falar com suporte");
    expect(markup).toContain('role="alert"');
    expect(markup).not.toContain("Estamos preparando seu PDF");
    expect(markup).not.toContain("Atualizar status");
    expect(markup).not.toContain("Tentar novamente");
  });

  it("presents a revoked certificate explicitly without retry actions", async () => {
    const markup = await renderPage({
      certificate: "",
      overview: courseOverview({ certificateStatus: "revoked" }),
    });

    expect(markup).toContain("Certificado revogado");
    expect(markup).toContain("Este certificado não está mais válido");
    expect(markup).toContain('href="/certificados/CERT-001"');
    expect(markup).toContain("Ver certificado");
    expect(markup).not.toContain("Atualizar status");
    expect(markup).not.toContain("Tentar novamente");
  });
});
