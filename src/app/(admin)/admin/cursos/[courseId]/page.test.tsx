import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({
  getAdminCourseDetailData: vi.fn(),
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
vi.mock("@/components/ui/tabs", () => ({
  Tabs: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  TabsContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  TabsList: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  TabsTrigger: ({ children }: { children: ReactNode }) => (
    <span>{children}</span>
  ),
}));
vi.mock("@/features/admin/actions", () => ({
  createCoursePublicationDraftAction: vi.fn(),
  publishCoursePublicationAction: vi.fn(),
}));
vi.mock("@/features/admin/presentation", () => ({
  getAdminCourseContentSignal: () => ({
    helper: "Conteudo pronto",
    label: "Pronto",
    tone: "ready",
  }),
  summarizeAdminCourseContent: () => ({
    publishedLessons: 0,
    readyLessons: 0,
    totalDurationSeconds: 0,
    totalLessons: 0,
  }),
}));
vi.mock("@/features/admin/server", () => ({
  getAdminCourseDetailData: dependencies.getAdminCourseDetailData,
  getAdminCoursePublicationState: dependencies.getAdminCoursePublicationState,
}));
vi.mock("@/features/certificates/templates", () => ({
  getCertificateTemplatesForCourse:
    dependencies.getCertificateTemplatesForCourse,
  hasCertificateIssuerProfile: dependencies.hasCertificateIssuerProfile,
}));
vi.mock("@/features/courses/presentation", () => ({
  formatCourseWorkload: () => "0 horas",
  summarizeCoursePublicationReadiness: () => ({
    completedCount: 0,
    missingItems: [],
    percent: 100,
    totalCount: 0,
  }),
}));
vi.mock("@/lib/env", () => ({ getServerEnv: dependencies.getServerEnv }));
vi.mock("./certificate-template-editor", () => ({
  CertificateTemplateEditor: () => null,
}));
vi.mock("./course-builder-components", () => ({
  CourseBuilderWrapper: () => null,
  CourseMetricCard: () => null,
  CreateModuleDialog: () => null,
  InfoRow: () => null,
}));
vi.mock("./course-dialogs-client", () => ({
  CourseSettingsForm: () => <div>settings-form</div>,
}));
vi.mock("./course-enrollments-table", () => ({
  CourseEnrollmentsTable: () => null,
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
  workloadHours: 0,
};

beforeEach(() => {
  vi.resetAllMocks();
  dependencies.getAdminCourseDetailData.mockResolvedValue({
    certificates: [],
    course,
    enrollments: [],
    lessons: [],
    modules: [],
    orders: [],
  });
  dependencies.getAdminCoursePublicationState.mockResolvedValue({
    hasDraft: false,
    hasPublished: true,
  });
  dependencies.getCertificateTemplatesForCourse.mockResolvedValue([]);
  dependencies.hasCertificateIssuerProfile.mockResolvedValue(false);
  dependencies.getServerEnv.mockReturnValue({
    NEXT_PUBLIC_APP_URL: "https://hub.example/base",
    PAYMENTS_CHECKOUT_MODE: "public",
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
