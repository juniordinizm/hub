import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { AdminCourseOperationalState } from "@/features/admin/presentation";
import { CourseOverview } from "./course-overview";

const overviewSummary = {
  activeEnrollmentCount: 57,
  paidOrderCount: 83,
  validCertificateCount: 41,
};

const contentSummary = {
  draftLessons: 1,
  emptyModules: 0,
  publishedLessons: 5,
  readyLessons: 6,
  totalDurationSeconds: 7500,
  totalLessons: 6,
  withoutContentLessons: 0,
};

const actionableState: AdminCourseOperationalState = {
  actionLabel: "Abrir Conteúdo",
  actionTab: "content",
  description: "Há alterações curriculares prontas para revisão.",
  key: "changes_pending",
  label: "Alterações em preparo",
  tone: "watch",
};

const healthyState: AdminCourseOperationalState = {
  actionLabel: null,
  actionTab: null,
  description: "O Curso está disponível e não possui alterações pendentes.",
  key: "ready",
  label: "Curso publicado",
  tone: "healthy",
};

const renderOverview = ({
  operationalState = actionableState,
  publicationState = { hasDraft: true, hasPublished: true },
}: {
  operationalState?: AdminCourseOperationalState;
  publicationState?: { hasDraft: boolean; hasPublished: boolean };
} = {}): string =>
  renderToStaticMarkup(
    <CourseOverview
      contentSummary={contentSummary}
      courseId="course-1"
      durationSeconds={contentSummary.totalDurationSeconds}
      moduleCount={4}
      operationalState={operationalState}
      overviewSummary={overviewSummary}
      publicationState={publicationState}
    />
  );

describe("CourseOverview", () => {
  it("renders one actionable state followed by exactly three exact metrics", () => {
    const markup = renderOverview();

    expect(markup).toContain("<h2");
    expect(markup).toContain("Alterações em preparo");
    expect(markup).toContain('href="/admin/cursos/course-1?tab=content"');
    expect(markup).toContain("Abrir Conteúdo");
    expect(markup.match(/data-course-metric=/g)).toHaveLength(3);
    expect(markup).toContain("Matrículas ativas");
    expect(markup).toContain("Alunos com acesso liberado.");
    expect(markup).not.toContain("Alunas com acesso liberado.");
    expect(markup).toContain(">57<");
    expect(markup).toContain("Pedidos pagos");
    expect(markup).toContain(">83<");
    expect(markup).toContain("Certificados válidos");
    expect(markup).toContain(">41<");
    expect(markup).toContain("tabular-nums");
  });

  it("renders a compact curriculum summary without legacy readiness UI", () => {
    const markup = renderOverview();

    expect(markup).toContain("Resumo curricular");
    expect(markup).toContain("Módulos");
    expect(markup).toContain(">4<");
    expect(markup).toContain("Aulas");
    expect(markup).toContain(">6<");
    expect(markup).toContain("Duração");
    expect(markup).toContain("125 min");
    expect(markup).toContain("Publicação");
    expect(markup).toContain("Alterações em preparo");
    expect(markup).not.toContain("Checklist mínimo");
    expect(markup).not.toContain("progressbar");
    expect(markup).not.toContain("Carga horária");
  });

  it("keeps a healthy state concise and without an action link", () => {
    const markup = renderOverview({ operationalState: healthyState });

    expect(markup).toContain("Curso publicado");
    expect(markup).toContain(
      "O Curso está disponível e não possui alterações pendentes."
    );
    expect(markup).not.toContain("href=");
  });

  it.each([
    [{ hasDraft: false, hasPublished: true }, "Publicado"],
    [{ hasDraft: true, hasPublished: true }, "Alterações em preparo"],
    [{ hasDraft: false, hasPublished: false }, "Ainda não publicado"],
  ])("describes publication state %j as %s", (publicationState, label) => {
    expect(renderOverview({ publicationState })).toContain(
      `data-curriculum-value="Publicação">${label}</dd>`
    );
  });
});
