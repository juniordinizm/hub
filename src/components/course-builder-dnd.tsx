"use client";

import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  type DragOverEvent,
  DragOverlay,
  type DragStartEvent,
  defaultDropAnimationSideEffects,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Menu01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type React from "react";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  reorderLessonsAction,
  reorderModulesAction,
} from "@/features/admin/actions";
import type {
  AdminCourse,
  AdminLesson,
  AdminModule,
} from "@/features/admin/server";
import { getAffectedLessonReorderGroups } from "./course-builder-reorder";
import { SortableItem } from "./sortable-list";

type CourseData = AdminCourse;
type ModuleData = AdminModule;
type LessonData = AdminLesson;

export interface CourseBuilderModuleRenderState {
  contentId: string;
  expanded: boolean;
  onToggle: () => void;
}

interface CourseBuilderClientProps {
  course: CourseData;
  editable: boolean;
  initialLessons: LessonData[];
  initialModules: ModuleData[];
  renderLesson: (
    lesson: LessonData,
    moduleData: ModuleData,
    index: number
  ) => React.ReactNode;
  renderModule: (
    moduleData: ModuleData,
    moduleLessons: LessonData[],
    index: number,
    disclosure: CourseBuilderModuleRenderState
  ) => React.ReactNode;
}

function SortableLesson({
  children,
  disabled,
  handleHidden,
  lesson,
}: {
  children: React.ReactNode;
  disabled: boolean;
  handleHidden: boolean;
  lesson: LessonData;
}): React.JSX.Element {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    data: { type: "lesson" },
    disabled,
    id: lesson.id,
  });

  return (
    <div
      className={`flex min-w-0 border-t transition-colors ${
        isDragging ? "relative z-10 bg-card opacity-95 drop-shadow-xl" : ""
      }`}
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
    >
      {handleHidden ? null : (
        <Button
          aria-label={`Reordenar aula ${lesson.title}`}
          className="ml-1 size-11 touch-manipulation self-center text-muted-foreground/50 hover:text-foreground active:cursor-grabbing md:size-10"
          disabled={disabled}
          size="icon"
          type="button"
          variant="ghost"
          {...attributes}
          {...listeners}
        >
          <HugeiconsIcon icon={Menu01Icon} size={18} strokeWidth={2} />
        </Button>
      )}
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

export function CourseBuilderClient({
  course,
  editable,
  initialModules,
  initialLessons,
  renderModule,
  renderLesson,
}: CourseBuilderClientProps) {
  const [modules, setModules] = useState(initialModules);
  const [lessons, setLessons] = useState(initialLessons);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeType, setActiveType] = useState<"module" | "lesson" | null>(
    null
  );
  const [expandedModuleIds, setExpandedModuleIds] = useState<Set<string>>(
    () => new Set(initialModules[0] ? [initialModules[0].id] : [])
  );
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setModules(initialModules);
  }, [initialModules]);

  useEffect(() => {
    setLessons(initialLessons);
  }, [initialLessons]);

  useEffect(() => {
    const availableModuleIds = new Set(initialModules.map((item) => item.id));
    setExpandedModuleIds((current) => {
      const next = new Set(
        [...current].filter((moduleId) => availableModuleIds.has(moduleId))
      );
      if (next.size === 0 && initialModules[0]) {
        next.add(initialModules[0].id);
      }
      return next;
    });
  }, [initialModules]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  function handleDragStart(event: DragStartEvent) {
    if (!editable || isPending) {
      return;
    }

    const { active } = event;
    const type = active.data.current?.type;
    setActiveId(active.id as string);
    setActiveType(type as "module" | "lesson");
  }

  function handleDragOver(event: DragOverEvent) {
    if (!editable || isPending) {
      return;
    }

    const { active, over } = event;
    if (!over) {
      return;
    }

    const activeId = active.id;
    const overId = over.id;

    if (activeId === overId) {
      return;
    }

    const isActiveLesson = active.data.current?.type === "lesson";
    const isOverLesson = over.data.current?.type === "lesson";
    const isOverModule = over.data.current?.type === "module";

    if (!isActiveLesson) {
      return;
    }

    if (isActiveLesson && isOverLesson) {
      const destinationLesson = lessons.find((lesson) => lesson.id === overId);
      if (destinationLesson) {
        setExpandedModuleIds((current) =>
          new Set(current).add(destinationLesson.moduleId)
        );
      }
      setLessons((prev) => {
        const activeIndex = prev.findIndex((l) => l.id === activeId);
        const overIndex = prev.findIndex((l) => l.id === overId);
        if (activeIndex === -1 || overIndex === -1) {
          return prev;
        }

        const activeLesson = prev[activeIndex];
        const overLesson = prev[overIndex];

        if (!(activeLesson && overLesson)) {
          return prev;
        }

        if (activeLesson.moduleId !== overLesson.moduleId) {
          const updatedLessons = [...prev];
          updatedLessons[activeIndex] = {
            ...activeLesson,
            moduleId: overLesson.moduleId,
          } as LessonData;
          return arrayMove(updatedLessons, activeIndex, overIndex);
        }

        return arrayMove(prev, activeIndex, overIndex);
      });
    }

    if (isActiveLesson && isOverModule) {
      setExpandedModuleIds((current) => new Set(current).add(overId as string));
      setLessons((prev) => {
        const activeIndex = prev.findIndex((l) => l.id === activeId);
        if (activeIndex === -1) {
          return prev;
        }

        const activeLesson = prev[activeIndex];

        if (!activeLesson) {
          return prev;
        }

        if (activeLesson.moduleId !== overId) {
          const updatedLessons = [...prev];
          updatedLessons[activeIndex] = {
            ...activeLesson,
            moduleId: overId as string,
          } as LessonData;
          const newIndex = updatedLessons.length - 1;
          return arrayMove(updatedLessons, activeIndex, newIndex);
        }

        return prev;
      });
    }
  }

  function handleModuleDragEnd(
    activeId: string | number,
    overId: string | number
  ) {
    const oldIndex = modules.findIndex((m) => m.id === activeId);
    const newIndex = modules.findIndex((m) => m.id === overId);

    if (oldIndex !== -1 && newIndex !== -1) {
      const newModules = arrayMove(modules, oldIndex, newIndex);
      setModules(newModules);
      startTransition(async () => {
        try {
          const result = await reorderModulesAction(
            course.id,
            newModules.map((moduleData) => moduleData.id)
          );
          if (!result.ok) {
            setModules(initialModules);
            toast.error(result.message);
          }
        } catch {
          setModules(initialModules);
          toast.error("Não foi possível salvar a nova ordem. Tente novamente.");
        }
      });
    }
  }

  function persistLessonReorder(activeLessonId: string) {
    const reorderGroups = getAffectedLessonReorderGroups({
      activeLessonId,
      currentLessons: lessons,
      initialLessons,
    });

    if (reorderGroups.length === 0) {
      return;
    }

    startTransition(async () => {
      try {
        const result = await reorderLessonsAction(course.id, reorderGroups);
        if (!result.ok) {
          setLessons(initialLessons);
          toast.error(result.message);
        }
      } catch {
        setLessons(initialLessons);
        toast.error("Não foi possível salvar a nova ordem. Tente novamente.");
      }
    });
  }

  function handleLessonDragEnd(
    activeId: string | number,
    overId: string | number
  ) {
    const finalLesson = lessons.find((l) => l.id === activeId);
    if (!finalLesson) {
      return;
    }

    if (activeId === overId) {
      const originalLesson = initialLessons.find((l) => l.id === activeId);
      if (originalLesson && originalLesson.moduleId !== finalLesson.moduleId) {
        persistLessonReorder(finalLesson.id);
      }
    } else {
      persistLessonReorder(finalLesson.id);
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    if (!editable || isPending) {
      setActiveId(null);
      setActiveType(null);
      return;
    }

    const { active, over } = event;
    setActiveId(null);
    setActiveType(null);

    if (!over) {
      return;
    }

    const type = active.data.current?.type;

    if (type === "module") {
      if (active.id !== over.id) {
        handleModuleDragEnd(active.id, over.id);
      }
    } else if (type === "lesson") {
      handleLessonDragEnd(active.id, over.id);
    }
  }

  const dropAnimation = {
    sideEffects: defaultDropAnimationSideEffects({
      styles: { active: { opacity: "0.5" } },
    }),
  };

  return (
    <DndContext
      collisionDetection={closestCenter}
      id="course-builder-dnd"
      onDragEnd={handleDragEnd}
      onDragOver={handleDragOver}
      onDragStart={handleDragStart}
      sensors={sensors}
    >
      <div className="flex flex-col gap-4">
        {isPending ? (
          <p
            aria-live="polite"
            className="text-muted-foreground text-sm"
            role="status"
          >
            Salvando ordem…
          </p>
        ) : null}
        <SortableContext
          items={modules.map((m) => m.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="mt-4 flex flex-col gap-8">
            {modules.map((moduleData, moduleIndex) => {
              const moduleLessons = lessons.filter(
                (l) => l.moduleId === moduleData.id
              );
              return (
                <SortableItem
                  ariaLabel={`Reordenar módulo ${moduleData.title}`}
                  className="rounded-lg border bg-card shadow-sm"
                  data={{ type: "module" }}
                  disabled={!editable || isPending}
                  handleClassName="ml-1"
                  handleHidden={!editable}
                  id={moduleData.id}
                  key={moduleData.id}
                >
                  {renderModule(moduleData, moduleLessons, moduleIndex, {
                    contentId: `course-module-${moduleData.id}-lessons`,
                    expanded: expandedModuleIds.has(moduleData.id),
                    onToggle: () => {
                      setExpandedModuleIds((current) => {
                        const next = new Set(current);
                        if (next.has(moduleData.id)) {
                          next.delete(moduleData.id);
                        } else {
                          next.add(moduleData.id);
                        }
                        return next;
                      });
                    },
                  })}
                  {expandedModuleIds.has(moduleData.id) ? (
                    <div id={`course-module-${moduleData.id}-lessons`}>
                      <SortableContext
                        items={moduleLessons.map((l) => l.id)}
                        strategy={verticalListSortingStrategy}
                      >
                        {moduleLessons.length > 0 ? (
                          moduleLessons.map((lesson, lessonIndex) => (
                            <SortableLesson
                              disabled={!editable || isPending}
                              handleHidden={!editable}
                              key={lesson.id}
                              lesson={lesson}
                            >
                              {renderLesson(lesson, moduleData, lessonIndex)}
                            </SortableLesson>
                          ))
                        ) : (
                          <p className="border-t px-5 py-4 text-muted-foreground text-sm">
                            Nenhuma aula cadastrada neste módulo.
                          </p>
                        )}
                      </SortableContext>
                    </div>
                  ) : null}
                </SortableItem>
              );
            })}
          </div>
        </SortableContext>
      </div>

      <DragOverlay dropAnimation={dropAnimation}>
        {activeId ? (
          <div className="rounded-lg border bg-card p-4 opacity-90 shadow-xl">
            Arrastando {activeType === "module" ? "Módulo" : "Aula"}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
