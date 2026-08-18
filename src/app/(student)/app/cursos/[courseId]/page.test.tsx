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
    ["ready", "Seu certificado está disponível para download"],
    ["pending", "Estamos preparando seu PDF"],
  ])("describes the %s certificate state accurately", async (status, text) => {
    const markup = await renderPage({
      certificate: "",
      overview: courseOverview({ certificateRenderStatus: status }),
    });

    expect(markup).toContain(text);
  });

  it("presents failed PDF preparation as an error with support", async () => {
    const markup = await renderPage({
      certificate: "",
      overview: courseOverview({ certificateRenderStatus: "failed" }),
    });

    expect(markup).toContain("Falha no preparo do PDF");
    expect(markup).toContain("Falar com suporte");
    expect(markup).not.toContain("Estamos preparando seu PDF");
  });
});
