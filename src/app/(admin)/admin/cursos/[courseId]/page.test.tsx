import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({
  getAdminCourseDetailData: vi.fn(),
  getAdminCourseContentSignal: vi.fn(),
  getAdminCourseOperationalState: vi.fn(),
  getAdminCourseOverviewSummary: vi.fn(),
  getAdminCoursePublicationState: vi.fn(),
  getCertificateTemplatesForCourse: vi.fn(),
  getServerEnv: vi.fn(),
  hasCertificateIssuerProfile: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("not found");
  },
}));
vi.mock("@hugeicons/react", () => ({ HugeiconsIcon: () => null }));
vi.mock("@/features/admin/actions", () => ({
  createLessonAction: vi.fn(),
  createModuleAction: vi.fn(),
  deleteLessonAction: vi.fn(),
  deleteModuleAction: vi.fn(),
  reorderLessonsAction: vi.fn(),
  reorderModulesAction: vi.fn(),
  saveLessonAction: vi.fn(),
  saveModuleAction: vi.fn(),
}));
vi.mock("@/features/admin/presentation", () => ({
  getAdminCourseContentSignal: dependencies.getAdminCourseContentSignal,
  getAdminCourseOperationalState: dependencies.getAdminCourseOperationalState,
  summarizeAdminCourseContent: () => ({
    draftLessons: 1,
    emptyModules: 0,
    publishedLessons: 5,
    readyLessons: 6,
    totalDurationSeconds: 7500,
    totalLessons: 6,
    withoutContentLessons: 0,
  }),
}));
vi.mock("@/features/admin/server", () => ({
  getAdminCourseDetailData: dependencies.getAdminCourseDetailData,
  getAdminCourseOverviewSummary: dependencies.getAdminCourseOverviewSummary,
  getAdminCoursePublicationState: dependencies.getAdminCoursePublicationState,
}));
vi.mock("@/features/certificates/templates", () => ({
  getCertificateTemplatesForCourse:
    dependencies.getCertificateTemplatesForCourse,
  hasCertificateIssuerProfile: dependencies.hasCertificateIssuerProfile,
}));
vi.mock("@/lib/env", () => ({ getServerEnv: dependencies.getServerEnv }));
vi.mock("./certificate-template-editor", () => ({
  CertificateTemplateEditor: () => null,
}));
vi.mock("./course-builder-components", () => ({
  CourseBuilderWrapper: () => null,
  CreateModuleDialog: () => null,
}));
vi.mock("./course-content-panel", () => ({
  CourseContentPanel: ({
    contentSignal,
    course: contentCourse,
    lessons,
    modules,
    nextModuleSortOrder,
    publicationState,
  }: {
    contentSignal: { label: string };
    course: { id: string };
    lessons: unknown[];
    modules: unknown[];
    nextModuleSortOrder: number;
    publicationState: { hasDraft: boolean; hasPublished: boolean };
  }) => (
    <div
      data-content-signal={contentSignal.label}
      data-course-content-panel="true"
      data-course-id={contentCourse.id}
      data-has-draft={publicationState.hasDraft}
      data-has-published={publicationState.hasPublished}
      data-lesson-count={lessons.length}
      data-module-count={modules.length}
      data-next-module-sort-order={nextModuleSortOrder}
    />
  ),
}));
vi.mock("./course-dialogs-client", () => ({
  CourseSettingsForm: () => <div>settings-form</div>,
}));
vi.mock("./course-enrollments-table", () => ({
  CourseEnrollmentsTable: () => null,
}));
vi.mock("./course-management-tabs", () => ({
  CourseManagementTabs: ({
    certificate,
    content,
    overview,
    settings,
    students,
  }: {
    certificate: ReactNode;
    content: ReactNode;
    overview: ReactNode;
    settings: ReactNode;
    students: ReactNode;
  }) => (
    <div data-course-management-tabs="true">
      <div data-course-panel="overview">{overview}</div>
      <div data-course-panel="content">{content}</div>
      <div data-course-panel="students">{students}</div>
      <div data-course-panel="settings">{settings}</div>
      <div data-course-panel="certificate">{certificate}</div>
    </div>
  ),
}));
vi.mock("./course-overview", () => ({
  CourseOverview: ({
    contentSummary,
    courseId,
    durationSeconds,
    moduleCount,
    operationalState,
    overviewSummary,
    publicationState,
  }: {
    contentSummary: { totalLessons: number };
    courseId: string;
    durationSeconds: number;
    moduleCount: number;
    operationalState: { key: string };
    overviewSummary: {
      activeEnrollmentCount: number;
      paidOrderCount: number;
      validCertificateCount: number;
    };
    publicationState: { hasDraft: boolean; hasPublished: boolean };
  }) => (
    <div
      data-active-enrollments={overviewSummary.activeEnrollmentCount}
      data-course-id={courseId}
      data-course-overview="true"
      data-duration-seconds={durationSeconds}
      data-has-draft={publicationState.hasDraft}
      data-has-published={publicationState.hasPublished}
      data-module-count={moduleCount}
      data-operational-state={operationalState.key}
      data-paid-orders={overviewSummary.paidOrderCount}
      data-total-lessons={contentSummary.totalLessons}
      data-valid-certificates={overviewSummary.validCertificateCount}
    />
  ),
}));
vi.mock("./course-purchase-link", () => ({
  CoursePurchaseLink: ({
    link,
  }: {
    link:
      | { available: true; url: string }
      | { available: false; reason: string };
  }) => (
    <div
      data-purchase-link={
        link.available ? link.url : `unavailable:${link.reason}`
      }
    />
  ),
}));

import AdminCourseDetailPage from "./page";

const course = {
  accessDurationMonths: 12,
  certificateEnabled: false,
  coverImage: null,
  description: "Descricao",
  id: "course-1",
  priceInCents: 10_000,
  slug: "curso-publico",
  status: "active",
  subtitle: "Subtitulo",
  thumbnailUrl: null,
  title: "Curso publico",
  workloadHours: 2,
  workloadHoursOverride: null,
};

beforeEach(() => {
  vi.resetAllMocks();
  dependencies.getAdminCourseDetailData.mockResolvedValue({
    course,
    enrollments: [],
    lessons: [],
    modules: [],
  });
  dependencies.getAdminCourseOverviewSummary.mockResolvedValue({
    activeEnrollmentCount: 57,
    paidOrderCount: 83,
    validCertificateCount: 41,
  });
  dependencies.getAdminCoursePublicationState.mockResolvedValue({
    hasDraft: false,
    hasPublished: true,
  });
  dependencies.getAdminCourseContentSignal.mockReturnValue({
    helper: "A estrutura curricular está pronta para revisão.",
    label: "Conteúdo pronto",
    tone: "healthy",
  });
  dependencies.getCertificateTemplatesForCourse.mockResolvedValue([]);
  dependencies.getAdminCourseOperationalState.mockReturnValue({
    actionLabel: null,
    actionTab: null,
    description: "Curso disponível.",
    key: "ready",
    label: "Curso publicado",
    tone: "healthy",
  });
  dependencies.hasCertificateIssuerProfile.mockResolvedValue(false);
  dependencies.getServerEnv.mockReturnValue({
    NEXT_PUBLIC_APP_URL: "https://hub.example/base",
    PAYMENTS_CHECKOUT_MODE: "public",
  });
});

describe("AdminCourseDetailPage overview", () => {
  it("passes exact aggregate counts to the dedicated overview", async () => {
    const markup = renderToStaticMarkup(
      await AdminCourseDetailPage({
        params: Promise.resolve({ courseId: course.id }),
      })
    );

    expect(dependencies.getAdminCourseOverviewSummary).toHaveBeenCalledWith(
      course.id
    );
    expect(dependencies.getAdminCourseOverviewSummary).toHaveBeenCalledTimes(1);
    expect(markup).toContain('data-course-overview="true"');
    expect(markup).toContain('data-active-enrollments="57"');
    expect(markup).toContain('data-paid-orders="83"');
    expect(markup).toContain('data-valid-certificates="41"');
    expect(markup).toContain('data-module-count="0"');
    expect(markup).toContain('data-total-lessons="6"');
    expect(markup).toContain('data-duration-seconds="7200"');
    expect(markup).toContain('data-has-published="true"');
    expect(markup).toContain('data-has-draft="false"');
  });

  it("derives the operational state from the real course signals", async () => {
    const purchaseLink = {
      available: true as const,
      url: "https://hub.example/comprar/curso-publico",
    };

    await AdminCourseDetailPage({
      params: Promise.resolve({ courseId: course.id }),
    });

    expect(dependencies.getAdminCourseOperationalState).toHaveBeenCalledWith({
      hasDescription: true,
      hasDraft: false,
      hasPublished: true,
      hasReadyLesson: true,
      hasThumbnail: false,
      moduleCount: 0,
      purchaseLink,
      status: "active",
    });
  });

  it("keeps all five server-rendered panels inside the navigation shell", async () => {
    const markup = renderToStaticMarkup(
      await AdminCourseDetailPage({
        params: Promise.resolve({ courseId: course.id }),
      })
    );

    expect(markup).toContain('data-course-management-tabs="true"');
    expect(markup.match(/data-course-panel=/g)).toHaveLength(5);
    expect(markup).toContain('data-course-panel="overview"');
    expect(markup).toContain('data-course-panel="content"');
    expect(markup).toContain('data-course-panel="students"');
    expect(markup).toContain('data-course-panel="settings"');
    expect(markup).toContain('data-course-panel="certificate"');
  });
});

describe("AdminCourseDetailPage header", () => {
  it.each([
    ["active", "Ativo"],
    ["draft", "Rascunho"],
    ["archived", "Arquivado"],
  ])("localizes the %s course status as %s", async (status, label) => {
    dependencies.getAdminCourseDetailData.mockResolvedValue({
      course: { ...course, status },
      enrollments: [],
      lessons: [],
      modules: [],
    });

    const markup = renderToStaticMarkup(
      await AdminCourseDetailPage({
        params: Promise.resolve({ courseId: course.id }),
      })
    );

    expect(markup).toContain(`>${label}<`);
  });

  it("keeps preview and removes curricular actions from the shared header", async () => {
    const markup = renderToStaticMarkup(
      await AdminCourseDetailPage({
        params: Promise.resolve({ courseId: course.id }),
      })
    );
    const headerMarkup = markup.slice(
      markup.indexOf("<header"),
      markup.indexOf("</header>") + "</header>".length
    );

    expect(headerMarkup).toContain("Ver como aluno");
    expect(headerMarkup).toContain(`/app/cursos/${course.id}?preview=student`);
    expect(headerMarkup).not.toContain("Preparar alterações");
    expect(headerMarkup).not.toContain("Publicar alterações");
    expect(headerMarkup).not.toContain(">Conteúdo pronto<");
  });
});

describe("AdminCourseDetailPage content", () => {
  it("orchestrates the dedicated content panel with derived publication data", async () => {
    dependencies.getAdminCourseDetailData.mockResolvedValue({
      course,
      enrollments: [],
      lessons: [{ id: "lesson-1" }],
      modules: [
        { id: "module-3", sortOrder: 3 },
        { id: "module-1", sortOrder: 1 },
      ],
    });
    dependencies.getAdminCoursePublicationState.mockResolvedValue({
      hasDraft: true,
      hasPublished: true,
    });

    const markup = renderToStaticMarkup(
      await AdminCourseDetailPage({
        params: Promise.resolve({ courseId: course.id }),
      })
    );

    expect(dependencies.getAdminCourseContentSignal).toHaveBeenCalledWith({
      draftLessons: 1,
      emptyModules: 0,
      publishedLessons: 5,
      readyLessons: 6,
      totalDurationSeconds: 7500,
      totalLessons: 6,
      withoutContentLessons: 0,
    });
    expect(markup).toContain('data-course-content-panel="true"');
    expect(markup).toContain('data-course-id="course-1"');
    expect(markup).toContain('data-module-count="2"');
    expect(markup).toContain('data-lesson-count="1"');
    expect(markup).toContain('data-next-module-sort-order="4"');
    expect(markup).toContain('data-has-draft="true"');
    expect(markup).toContain('data-has-published="true"');
    expect(markup).toContain('data-content-signal="Conteúdo pronto"');
  });
});

describe("AdminCourseDetailPage purchase link", () => {
  it("derives the stable public link from the single publication projection", async () => {
    const markup = renderToStaticMarkup(
      await AdminCourseDetailPage({
        params: Promise.resolve({ courseId: course.id }),
      })
    );

    expect(dependencies.getAdminCoursePublicationState).toHaveBeenCalledTimes(
      1
    );
    expect(dependencies.getAdminCoursePublicationState).toHaveBeenCalledWith(
      course.id
    );
    expect(markup).toContain(
      'data-purchase-link="https://hub.example/comprar/curso-publico"'
    );
    expect(markup.match(/data-slot="card"/g)).toHaveLength(1);
    expect(markup).toContain("Configurações do curso");
  });

  it("passes an unavailable state instead of a false link for an unpublished course", async () => {
    dependencies.getAdminCoursePublicationState.mockResolvedValue({
      hasDraft: true,
      hasPublished: false,
    });

    const markup = renderToStaticMarkup(
      await AdminCourseDetailPage({
        params: Promise.resolve({ courseId: course.id }),
      })
    );

    expect(dependencies.getAdminCoursePublicationState).toHaveBeenCalledTimes(
      1
    );
    expect(markup).toContain(
      'data-purchase-link="unavailable:course_unpublished"'
    );
    expect(markup).not.toContain("https://hub.example/comprar/curso-publico");
  });
});
