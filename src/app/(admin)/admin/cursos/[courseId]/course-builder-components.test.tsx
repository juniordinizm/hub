/**
 * @vitest-environment jsdom
 */

import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@hugeicons/react", () => ({ HugeiconsIcon: () => null }));
vi.mock("@/components/auto-close-dialog-form", () => ({
  AutoCloseDialogForm: ({ children }: { children: ReactNode }) => (
    <form>{children}</form>
  ),
}));
vi.mock("@/components/discard-aware-dialog", () => ({
  DiscardAwareDialog: ({ trigger }: { trigger: ReactNode }) => trigger,
}));
vi.mock("@/components/ui/dialog", () => ({
  DialogBody: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogFooter: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  DialogTriggerButton: ({
    children,
    variant,
  }: {
    children: ReactNode;
    variant?: string;
  }) => (
    <button data-variant={variant} type="button">
      {children}
    </button>
  ),
}));
vi.mock("@/features/admin/actions", () => ({
  createLessonDraftAction: vi.fn(),
  saveModuleAction: vi.fn(),
}));
vi.mock("@/components/course-builder-dnd", () => ({
  CourseBuilderClient: ({
    editable,
    initialLessons,
    initialModules,
    renderLesson,
    renderModule,
  }: {
    editable: boolean;
    initialLessons: Lesson[];
    initialModules: Module[];
    renderLesson: (
      lesson: Lesson,
      moduleData: Module,
      index: number
    ) => ReactNode;
    renderModule: (
      moduleData: Module,
      moduleLessons: Lesson[],
      index: number,
      disclosure: {
        contentId: string;
        expanded: boolean;
        onToggle: () => void;
      }
    ) => ReactNode;
  }) => {
    const firstLesson = initialLessons[0];
    const firstModule = initialModules[0];

    if (!(firstLesson && firstModule)) {
      throw new Error("Expected module and lesson fixtures.");
    }

    return (
      <div data-builder-editable={editable}>
        {renderModule(firstModule, initialLessons, 0, {
          contentId: "module-1-lessons",
          expanded: true,
          onToggle: vi.fn(),
        })}
        {renderLesson(firstLesson, firstModule, 0)}
      </div>
    );
  },
}));

import type {
  AdminCourse,
  AdminLesson,
  AdminModule,
} from "@/features/admin/server";
import {
  CourseBuilderWrapper,
  CreateLessonDraftForm,
  CreateModuleDialog,
  LessonEditorSidebarFields,
  LessonRow,
  ModuleForm,
  ModuleSection,
} from "./course-builder-components";

type Lesson = AdminLesson;
type Module = AdminModule;

const UNACCENTED_AUTHORING_COPY =
  /Video|Sem conteudo|Titulo|Descricao|Criar modulo|Salvar modulo/;

const course: AdminCourse = {
  accessDurationMonths: 12,
  catalogVisibility: "listed",
  certificateEnabled: false,
  coverImage: null,
  description: null,
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
  priceInCents: 10_000,
  pendingCheckoutCancellations: 0,
  pendingInterestNotifications: 0,
  salesStatus: "open",
  slug: "course-1",
  status: "active",
  subtitle: null,
  thumbnailUrl: null,
  title: "Curso",
  workloadHours: 2,
  workloadHoursOverride: null,
};

const moduleData: AdminModule = {
  courseId: course.id,
  courseTitle: course.title,
  description: null,
  id: "module-1",
  releaseDelayDays: 0,
  sortOrder: 1,
  status: "active",
  title: "Módulo",
};

const lesson: AdminLesson = {
  contentJson: null,
  coursePublicationStatus: "draft",
  courseTitle: course.title,
  description: null,
  durationSeconds: 0,
  id: "lesson-1",
  isPublished: false,
  isRequired: true,
  moduleId: moduleData.id,
  moduleTitle: moduleData.title,
  sortOrder: 1,
  status: "draft",
  textDurationSeconds: 0,
  textWordCount: 0,
  title: "Aula",
  videoDurationSeconds: 0,
  videoEmbedUrl: null,
  videoExternalId: null,
  videoProvider: null,
};

describe("CourseBuilderWrapper editability", () => {
  it("propagates read-only state and hides authorship controls", () => {
    const markup = renderToStaticMarkup(
      <CourseBuilderWrapper
        course={course}
        editable={false}
        lessons={[lesson]}
        modules={[moduleData]}
      />
    );

    expect(markup).toContain('data-builder-editable="false"');
    expect(markup).not.toContain("Nova aula");
    expect(markup).not.toContain(">Editar<");
  });

  it("shows authorship controls in a draft", () => {
    const markup = renderToStaticMarkup(
      <CourseBuilderWrapper
        course={course}
        editable
        lessons={[lesson]}
        modules={[moduleData]}
      />
    );

    expect(markup).toContain('data-builder-editable="true"');
    expect(markup).toContain("Nova aula");
    expect(markup).toContain(">Editar<");
  });
});

describe("CreateModuleDialog", () => {
  it("supports contextual copy and a secondary top-level treatment", () => {
    const markup = renderToStaticMarkup(
      <CreateModuleDialog
        course={course}
        nextModuleSortOrder={2}
        triggerLabel="Criar primeiro módulo"
        triggerVariant="outline"
      />
    );

    expect(markup).toContain("Criar primeiro módulo");
    expect(markup).toContain('data-variant="outline"');
  });
});

describe("module content release controls", () => {
  it("defaults a new immediate module to an eight-day delayed option", () => {
    const document = new DOMParser().parseFromString(
      renderToStaticMarkup(<ModuleForm course={course} nextSortOrder={2} />),
      "text/html"
    );
    const immediate = document.querySelector<HTMLInputElement>(
      'input[name="releaseMode"][value="immediate"]'
    );
    const delayed = document.querySelector<HTMLInputElement>(
      'input[name="releaseMode"][value="delayed"]'
    );
    const delayDays = document.querySelector<HTMLInputElement>(
      'input[name="releaseDelayDays"]'
    );

    expect(document.querySelector("fieldset legend")?.textContent).toBe(
      "Liberação do conteúdo"
    );
    expect(immediate?.hasAttribute("checked")).toBe(true);
    expect(delayed?.hasAttribute("checked")).toBe(false);
    expect(delayDays?.getAttribute("value")).toBe("8");
    expect(delayDays?.getAttribute("min")).toBe("1");
    expect(delayDays?.getAttribute("step")).toBe("1");
    expect(document.body.textContent).toContain(
      "Cada dia equivale a 24 horas desde o início do acesso da Aluna."
    );
  });

  it("defaults an existing D+8 module to delayed release", () => {
    const document = new DOMParser().parseFromString(
      renderToStaticMarkup(
        <ModuleForm
          course={course}
          moduleData={{ ...moduleData, releaseDelayDays: 8 }}
        />
      ),
      "text/html"
    );
    const immediate = document.querySelector<HTMLInputElement>(
      'input[name="releaseMode"][value="immediate"]'
    );
    const delayed = document.querySelector<HTMLInputElement>(
      'input[name="releaseMode"][value="delayed"]'
    );
    const delayDays = document.querySelector<HTMLInputElement>(
      'input[name="releaseDelayDays"]'
    );

    expect(immediate?.hasAttribute("checked")).toBe(false);
    expect(delayed?.hasAttribute("checked")).toBe(true);
    expect(delayDays?.getAttribute("value")).toBe("8");
  });

  it("shows release timing only in the module header", () => {
    const moduleMarkup = renderToStaticMarkup(
      <ModuleSection
        contentId="module-1-lessons"
        course={course}
        editable
        expanded
        moduleData={{ ...moduleData, releaseDelayDays: 8 }}
        moduleLessons={[lesson]}
        onToggle={vi.fn()}
      />
    );
    const lessonMarkup = renderToStaticMarkup(
      <LessonRow courseId={course.id} editable index={0} lesson={lesson} />
    );

    expect(moduleMarkup).toContain("Liberação em D+8");
    expect(lessonMarkup).not.toContain("Liberação");
  });
});

describe("lesson draft form requirements", () => {
  it("requires only the lesson title", () => {
    const document = new DOMParser().parseFromString(
      renderToStaticMarkup(
        <CreateLessonDraftForm moduleId={moduleData.id} nextSortOrder={2} />
      ),
      "text/html"
    );

    expect(
      document
        .querySelector('textarea[name="description"]')
        ?.hasAttribute("required")
    ).toBe(false);
    expect(
      document.querySelector('input[name="title"]')?.hasAttribute("required")
    ).toBe(true);
  });
});

describe("course builder copy", () => {
  it("uses accented Portuguese throughout the visible authoring flow", () => {
    const videoLesson = {
      ...lesson,
      videoExternalId: "video-1",
    };
    const lessonMarkup = renderToStaticMarkup(
      <div>
        <LessonRow
          courseId={course.id}
          editable
          index={0}
          lesson={videoLesson}
        />
        <LessonRow courseId={course.id} editable index={1} lesson={lesson} />
      </div>
    );
    const formMarkup = [
      renderToStaticMarkup(<ModuleForm course={course} nextSortOrder={2} />),
      renderToStaticMarkup(
        <ModuleForm course={course} moduleData={moduleData} />
      ),
      renderToStaticMarkup(
        <LessonEditorSidebarFields formId="lesson-form" lesson={lesson} />
      ),
      renderToStaticMarkup(
        <CreateLessonDraftForm moduleId={moduleData.id} nextSortOrder={2} />
      ),
    ].join("");
    const visibleCopy = `${lessonMarkup}${formMarkup}`;

    expect(visibleCopy).toContain("Vídeo");
    expect(visibleCopy).toContain("Sem conteúdo");
    expect(visibleCopy).toContain("Título");
    expect(visibleCopy).toContain("Descrição");
    expect(visibleCopy).toContain("Título da aula");
    expect(visibleCopy).toContain("Criar módulo");
    expect(visibleCopy).toContain("Salvar módulo");
    expect(visibleCopy).not.toMatch(UNACCENTED_AUTHORING_COPY);
  });
});

describe("course builder responsive presentation", () => {
  it("renders a semantic module disclosure with compact summary metadata", () => {
    const moduleLessons = [
      { ...lesson, durationSeconds: 20 * 60, id: "lesson-1" },
      { ...lesson, durationSeconds: 12 * 60, id: "lesson-2" },
      { ...lesson, durationSeconds: 10 * 60, id: "lesson-3" },
    ];
    const markup = renderToStaticMarkup(
      <ModuleSection
        contentId="module-1-lessons"
        course={course}
        editable
        expanded
        moduleData={{
          ...moduleData,
          title:
            "Fundamentos essenciais para construir aplicações modernas e confiáveis",
        }}
        moduleLessons={moduleLessons}
        onToggle={vi.fn()}
      />
    );
    const document = new DOMParser().parseFromString(markup, "text/html");
    const disclosure = document.querySelector<HTMLButtonElement>(
      'button[aria-controls="module-1-lessons"]'
    );

    expect(disclosure?.getAttribute("aria-expanded")).toBe("true");
    expect(document.body.textContent).toContain("3 aulas");
    expect(document.body.textContent).toContain("42 min");
    expect(disclosure?.querySelector("button")).toBeNull();
    expect(document.querySelector("h3")?.textContent).toContain(
      "Fundamentos essenciais"
    );
    expect(document.body.textContent).toContain("Nova aula");
    expect(document.body.textContent).toContain("Editar");
  });

  it("renders each lesson as a responsive row with combined metadata and no table cells", () => {
    const richLesson = {
      ...lesson,
      contentJson: {
        document: {
          content: [
            {
              content: [{ text: "Conteúdo", type: "text" }],
              type: "paragraph",
            },
          ],
          type: "doc",
        },
        type: "text",
      },
      durationSeconds: 42 * 60,
      title:
        "Introdução detalhada aos fundamentos de arquitetura de aplicações modernas",
      videoExternalId: "video-1",
    };
    const markup = renderToStaticMarkup(
      <LessonRow courseId={course.id} editable index={0} lesson={richLesson} />
    );
    const document = new DOMParser().parseFromString(markup, "text/html");

    expect(document.querySelector("table, tr, td")).toBeNull();
    expect(document.body.textContent).toContain(richLesson.title);
    expect(document.body.textContent).toContain("Vídeo + texto");
    expect(document.body.textContent).toContain("42 min");
    expect(document.body.textContent).toContain("Obrigatória");
    expect(document.querySelector('[class*="md:grid"]')).not.toBeNull();
    expect(
      document.querySelector(
        `a[href="/admin/cursos/${course.id}/aulas/${richLesson.id}"]`
      )
    ).not.toBeNull();
  });
});
