/**
 * @vitest-environment jsdom
 */

import type { ReactNode } from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({
  dndHandlers: {
    onDragEnd: undefined as ((event: unknown) => void) | undefined,
    onDragOver: undefined as ((event: unknown) => void) | undefined,
    onDragStart: undefined as ((event: unknown) => void) | undefined,
  },
  reorderLessons: vi.fn(),
  reorderModules: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("@dnd-kit/core", () => ({
  closestCenter: vi.fn(),
  defaultDropAnimationSideEffects: vi.fn(() => vi.fn()),
  DndContext: ({
    children,
    onDragEnd,
    onDragOver,
    onDragStart,
  }: {
    children: ReactNode;
    onDragEnd: (event: unknown) => void;
    onDragOver: (event: unknown) => void;
    onDragStart: (event: unknown) => void;
  }) => {
    dependencies.dndHandlers.onDragEnd = onDragEnd;
    dependencies.dndHandlers.onDragOver = onDragOver;
    dependencies.dndHandlers.onDragStart = onDragStart;
    return <div>{children}</div>;
  },
  DragOverlay: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  KeyboardSensor: vi.fn(),
  PointerSensor: vi.fn(),
  useSensor: vi.fn(() => ({})),
  useSensors: vi.fn(() => []),
}));
vi.mock("@dnd-kit/sortable", () => ({
  arrayMove: vi.fn((items: unknown[], from: number, to: number) => {
    const next = [...items];
    const [item] = next.splice(from, 1);
    if (item !== undefined) {
      next.splice(to, 0, item);
    }
    return next;
  }),
  SortableContext: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  sortableKeyboardCoordinates: vi.fn(),
  useSortable: vi.fn(() => ({
    attributes: {},
    isDragging: false,
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    transition: undefined,
  })),
  verticalListSortingStrategy: vi.fn(),
}));
vi.mock("@dnd-kit/utilities", () => ({
  CSS: { Transform: { toString: vi.fn(() => undefined) } },
}));
vi.mock("@hugeicons/react", () => ({ HugeiconsIcon: () => null }));
vi.mock("sonner", () => ({ toast: { error: dependencies.toastError } }));
vi.mock("@/features/admin/actions", () => ({
  reorderLessonsAction: dependencies.reorderLessons,
  reorderModulesAction: dependencies.reorderModules,
}));
vi.mock("./sortable-list", () => ({
  SortableItem: ({
    children,
    disabled,
  }: {
    children: ReactNode;
    disabled?: boolean;
  }) => <div data-module-reorder-disabled={disabled}>{children}</div>,
}));

import type {
  AdminCourse,
  AdminLesson,
  AdminModule,
} from "@/features/admin/server";
import { CourseBuilderClient } from "./course-builder-dnd";

const course = { id: "course-1" } as AdminCourse;
const moduleData = {
  id: "module-1",
  sortOrder: 1,
  title: "Módulo",
} as AdminModule;
const lesson = {
  id: "lesson-1",
  moduleId: moduleData.id,
  sortOrder: 1,
  title: "Aula",
} as AdminLesson;
const secondModule = {
  id: "module-2",
  sortOrder: 2,
  title: "Segundo módulo",
} as AdminModule;

const renderBuilder = (editable: boolean): string =>
  renderToStaticMarkup(
    <CourseBuilderClient
      course={course}
      editable={editable}
      initialLessons={[lesson]}
      initialModules={[moduleData]}
      renderLesson={() => <div>Aula</div>}
      renderModule={() => <div>Módulo</div>}
    />
  );

describe("CourseBuilderClient editability", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    vi.clearAllMocks();
    dependencies.reorderLessons.mockResolvedValue({ ok: true });
    dependencies.reorderModules.mockResolvedValue({ ok: true });
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("disables module and lesson reordering outside a draft", () => {
    const markup = renderBuilder(false);

    expect(markup).toContain('data-module-reorder-disabled="true"');
    expect(markup).not.toContain('aria-label="Reordenar aula Aula"');
  });

  it("enables module and lesson reordering inside a draft", () => {
    const markup = renderBuilder(true);

    expect(markup).toContain('data-module-reorder-disabled="false"');
    expect(markup).toContain('aria-label="Reordenar aula Aula"');
    expect(markup).toContain("size-11");
    expect(markup).toContain("md:size-10");
  });

  it("reports reorder failures with actionable accented feedback", async () => {
    dependencies.reorderModules.mockRejectedValue(new Error("offline"));
    act(() => {
      root.render(
        <CourseBuilderClient
          course={course}
          editable
          initialLessons={[]}
          initialModules={[moduleData, secondModule]}
          renderLesson={() => null}
          renderModule={(currentModule) => <div>{currentModule.title}</div>}
        />
      );
    });

    await act(async () => {
      dependencies.dndHandlers.onDragEnd?.({
        active: {
          data: { current: { type: "module" } },
          id: moduleData.id,
        },
        over: {
          data: { current: { type: "module" } },
          id: secondModule.id,
        },
      });
      await Promise.resolve();
    });

    expect(dependencies.toastError).toHaveBeenCalledWith(
      "Não foi possível salvar a nova ordem. Tente novamente."
    );
  });

  it("announces persistence and blocks another reorder while saving", async () => {
    let resolveReorder: ((value: { ok: true }) => void) | undefined;
    dependencies.reorderModules.mockReturnValue(
      new Promise((resolve) => {
        resolveReorder = resolve;
      })
    );
    act(() => {
      root.render(
        <CourseBuilderClient
          course={course}
          editable
          initialLessons={[]}
          initialModules={[moduleData, secondModule]}
          renderLesson={() => null}
          renderModule={(currentModule) => <div>{currentModule.title}</div>}
        />
      );
    });

    const reorderEvent = {
      active: {
        data: { current: { type: "module" } },
        id: moduleData.id,
      },
      over: {
        data: { current: { type: "module" } },
        id: secondModule.id,
      },
    };
    act(() => {
      dependencies.dndHandlers.onDragEnd?.(reorderEvent);
    });

    expect(container.querySelector('[role="status"]')?.textContent).toBe(
      "Salvando ordem…"
    );

    act(() => {
      dependencies.dndHandlers.onDragEnd?.(reorderEvent);
    });
    expect(dependencies.reorderModules).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveReorder?.({ ok: true });
      await Promise.resolve();
    });
  });

  it("ignores every drag handler without changing local state when editing is disabled", () => {
    act(() => {
      root.render(
        <CourseBuilderClient
          course={course}
          editable={false}
          initialLessons={[lesson]}
          initialModules={[moduleData, secondModule]}
          renderLesson={() => <div>Aula</div>}
          renderModule={(currentModule, moduleLessons) => (
            <div data-module={currentModule.id}>
              {moduleLessons.map((item) => item.id).join(",")}
            </div>
          )}
        />
      );
    });

    const lessonDrag = {
      active: { data: { current: { type: "lesson" } }, id: lesson.id },
      over: { data: { current: { type: "module" } }, id: secondModule.id },
    };
    const moduleDrag = {
      active: { data: { current: { type: "module" } }, id: moduleData.id },
      over: { data: { current: { type: "module" } }, id: secondModule.id },
    };

    act(() => {
      dependencies.dndHandlers.onDragStart?.(lessonDrag);
      dependencies.dndHandlers.onDragOver?.(lessonDrag);
      dependencies.dndHandlers.onDragEnd?.(moduleDrag);
    });

    expect(
      container.querySelector('[data-module="module-1"]')?.textContent
    ).toBe(lesson.id);
    expect(
      container.querySelector('[data-module="module-2"]')?.textContent
    ).toBe("");
    expect(container.textContent).not.toContain("Arrastando");
    expect(dependencies.reorderLessons).not.toHaveBeenCalled();
    expect(dependencies.reorderModules).not.toHaveBeenCalled();
  });

  it("opens only the first module initially and lets each module expand independently", () => {
    act(() => {
      root.render(
        <CourseBuilderClient
          course={course}
          editable
          initialLessons={[lesson]}
          initialModules={[moduleData, secondModule]}
          renderLesson={() => <div>Aula</div>}
          renderModule={(currentModule, _lessons, _index, disclosure) => (
            <button
              aria-expanded={disclosure.expanded}
              data-module-toggle={currentModule.id}
              onClick={disclosure.onToggle}
              type="button"
            >
              {currentModule.title}
            </button>
          )}
        />
      );
    });

    expect(
      container
        .querySelector('[data-module-toggle="module-1"]')
        ?.getAttribute("aria-expanded")
    ).toBe("true");
    expect(
      container
        .querySelector('[data-module-toggle="module-2"]')
        ?.getAttribute("aria-expanded")
    ).toBe("false");

    act(() => {
      container
        .querySelector<HTMLButtonElement>('[data-module-toggle="module-2"]')
        ?.click();
    });

    expect(
      container
        .querySelector('[data-module-toggle="module-2"]')
        ?.getAttribute("aria-expanded")
    ).toBe("true");
  });

  it("opens the destination module while moving a lesson into it", () => {
    act(() => {
      root.render(
        <CourseBuilderClient
          course={course}
          editable
          initialLessons={[lesson]}
          initialModules={[moduleData, secondModule]}
          renderLesson={() => <div>Aula</div>}
          renderModule={(currentModule, moduleLessons, _index, disclosure) => (
            <div
              data-expanded={disclosure.expanded}
              data-module={currentModule.id}
            >
              {moduleLessons.map((item) => item.id).join(",")}
            </div>
          )}
        />
      );
    });

    act(() => {
      dependencies.dndHandlers.onDragOver?.({
        active: {
          data: { current: { type: "lesson" } },
          id: lesson.id,
        },
        over: {
          data: { current: { type: "module" } },
          id: secondModule.id,
        },
      });
    });

    expect(
      container
        .querySelector('[data-module="module-2"]')
        ?.getAttribute("data-expanded")
    ).toBe("true");
    expect(
      container.querySelector('[data-module="module-2"]')?.textContent
    ).toBe(lesson.id);
  });
});
