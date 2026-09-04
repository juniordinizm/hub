/**
 * @vitest-environment jsdom
 */

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("./course-builder-components", () => ({
  CourseBuilderWrapper: ({ editable }: { editable: boolean }) => (
    <div data-course-builder="true" data-editable={editable} />
  ),
  CreateModuleDialog: ({
    triggerLabel = "Novo módulo",
  }: {
    triggerLabel?: string;
  }) => <button type="button">{triggerLabel}</button>,
}));
vi.mock("./course-publication-action", () => ({
  CoursePublicationAction: ({
    action,
    courseId,
  }: {
    action: "prepare" | "publish";
    courseId: string;
  }) => (
    <button
      data-course-id={courseId}
      data-publication-action={action}
      type="button"
    >
      {action === "prepare" ? "Preparar alterações" : "Publicar alterações"}
    </button>
  ),
}));

import type {
  AdminCourse,
  AdminLesson,
  AdminModule,
} from "@/features/admin/server";
import { CourseContentPanel } from "./course-content-panel";

const course: AdminCourse = {
  accessDurationMonths: 12,
  catalogVisibility: "listed",
  certificateEnabled: true,
  coverImage: null,
  description: "Descrição",
  hasCommercialHistory: false,
  id: "course-1",
  interestCount: 0,
  interestNotificationsSent: 0,
  launchDate: null,
  launchLandingUrl: null,
  paymentAllowCreditCard: true,
  paymentAllowPix: true,
  paymentMaxInstallmentCount: 3,
  pendingCertificateReconciliationCount: 0,
  priceInCents: 19_900,
  pendingCheckoutCancellations: 0,
  pendingInterestNotifications: 0,
  salesStatus: "open",
  slug: "curso-1",
  status: "active",
  subtitle: "Subtítulo",
  thumbnailUrl: null,
  title: "Curso de teste",
  workloadHours: 10,
  workloadHoursOverride: null,
};

const modules: AdminModule[] = [
  {
    courseId: course.id,
    courseTitle: course.title,
    description: null,
    id: "module-1",
    releaseDelayDays: 0,
    sortOrder: 1,
    status: "active",
    title: "Módulo 1",
  },
];

const lessons: AdminLesson[] = [];

const contentSignal = {
  helper: "A estrutura curricular está pronta para revisão.",
  label: "Conteúdo pronto",
  tone: "healthy" as const,
};

const renderPanel = ({
  hasDraft,
  hasPublished = true,
  modulesToRender = modules,
}: {
  hasDraft: boolean;
  hasPublished?: boolean;
  modulesToRender?: AdminModule[];
}): string =>
  renderToStaticMarkup(
    <CourseContentPanel
      contentSignal={contentSignal}
      course={course}
      lessons={lessons}
      modules={modulesToRender}
      nextModuleSortOrder={2}
      publicationState={{ hasDraft, hasPublished }}
    />
  );

const getButtonLabels = (markup: string): string[] => {
  const document = new DOMParser().parseFromString(markup, "text/html");
  return Array.from(document.querySelectorAll("button"), (button) =>
    button.textContent?.trim()
  ).filter((label): label is string => Boolean(label));
};

describe("CourseContentPanel", () => {
  it("keeps published content read-only until changes are prepared", () => {
    const markup = renderPanel({ hasDraft: false });

    expect(markup).toContain("<h2");
    expect(markup).toContain("Conteúdo do curso");
    expect(markup).toContain("Prepare alterações para editar");
    expect(getButtonLabels(markup)).toContain("Preparar alterações");
    expect(getButtonLabels(markup)).not.toContain("Novo módulo");
    expect(markup).toContain('data-editable="false"');
    expect(markup).toContain('data-publication-action="prepare"');
    expect(markup).toContain(`data-course-id="${course.id}"`);
  });

  it("enables authorship and publication while a draft exists", () => {
    const markup = renderPanel({ hasDraft: true });
    const buttons = getButtonLabels(markup);

    expect(markup).toContain("Alterações em preparo");
    expect(buttons).toContain("Publicar alterações");
    expect(buttons).toContain("Novo módulo");
    expect(markup).toContain('data-editable="true"');
    expect(markup).toContain('data-publication-action="publish"');
  });

  it("offers one preparation action in the empty published state", () => {
    const markup = renderPanel({ hasDraft: false, modulesToRender: [] });
    const buttons = getButtonLabels(markup);

    expect(markup).toContain('data-slot="empty"');
    expect(
      buttons.filter((label) => label === "Preparar alterações")
    ).toHaveLength(1);
    expect(buttons).not.toContain("Novo módulo");
  });

  it("offers only the first module action in the empty draft state", () => {
    const markup = renderPanel({ hasDraft: true, modulesToRender: [] });
    const buttons = getButtonLabels(markup);

    expect(markup).toContain('data-slot="empty"');
    expect(buttons).toContain("Criar primeiro módulo");
    expect(buttons).not.toContain("Novo módulo");
    expect(buttons).not.toContain("Publicar alterações");
  });

  it("shows the content signal and the current publication state", () => {
    const publishedMarkup = renderPanel({ hasDraft: false });
    const unpublishedMarkup = renderPanel({
      hasDraft: false,
      hasPublished: false,
    });

    expect(publishedMarkup).toContain(contentSignal.label);
    expect(publishedMarkup).toContain(contentSignal.helper);
    expect(publishedMarkup).toContain("Publicado");
    expect(unpublishedMarkup).toContain("Ainda não publicado");
  });
});
