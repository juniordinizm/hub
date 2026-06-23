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
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import type React from "react";
import { useEffect, useState, useTransition } from "react";
import { Separator } from "@/components/ui/separator";
import {
  reorderLessonsAction,
  reorderModulesAction,
} from "@/features/admin/actions";
import type { getAdminManagementData } from "@/features/admin/server";
import { SortableItem } from "./sortable-list";

type AdminData = Awaited<ReturnType<typeof getAdminManagementData>>;
type CourseData = AdminData["courses"][number];
type ModuleData = AdminData["modules"][number];
type LessonData = AdminData["lessons"][number];

interface CourseBuilderClientProps {
  course: CourseData;
  initialLessons: LessonData[];
  initialModules: ModuleData[];
  renderLesson: (lesson: LessonData, moduleData: ModuleData) => React.ReactNode;
  renderModule: (
    moduleData: ModuleData,
    moduleLessons: LessonData[]
  ) => React.ReactNode;
}

export function CourseBuilderClient({
  course,
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
  const [, startTransition] = useTransition();

  useEffect(() => {
    setModules(initialModules);
  }, [initialModules]);

  useEffect(() => {
    setLessons(initialLessons);
  }, [initialLessons]);

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
    const { active } = event;
    const type = active.data.current?.type;
    setActiveId(active.id as string);
    setActiveType(type as "module" | "lesson");
  }

  function handleDragOver(event: DragOverEvent) {
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
      startTransition(() => {
        reorderModulesAction(
          course.id,
          newModules.map((m) => m.id)
        );
      });
    }
  }

  function persistLessonReorder(finalLesson: LessonData) {
    const moduleId = finalLesson.moduleId;
    const moduleLessons = lessons.filter((l) => l.moduleId === moduleId);
    startTransition(() => {
      reorderLessonsAction(
        moduleId,
        moduleLessons.map((l) => l.id)
      );
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
        persistLessonReorder(finalLesson);
      }
    } else {
      persistLessonReorder(finalLesson);
    }
  }

  function handleDragEnd(event: DragEndEvent) {
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
        <SortableContext
          items={modules.map((m) => m.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="mt-4 flex flex-col gap-8">
            {modules.map((moduleData) => {
              const moduleLessons = lessons.filter(
                (l) => l.moduleId === moduleData.id
              );
              return (
                <SortableItem
                  className="rounded-lg border bg-card shadow-sm"
                  data={{ type: "module" }}
                  handleClassName="px-4 pt-6 items-start"
                  id={moduleData.id}
                  key={moduleData.id}
                >
                  {renderModule(moduleData, moduleLessons)}
                  <SortableContext
                    items={moduleLessons.map((l) => l.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    {moduleLessons.length > 0 && <Separator />}
                    <div className="divide-y">
                      {moduleLessons.map((lesson) => (
                        <SortableItem
                          className="bg-background/20 transition-colors hover:bg-muted/10"
                          data={{ type: "lesson" }}
                          handleClassName="px-4 items-center"
                          id={lesson.id}
                          key={lesson.id}
                        >
                          {renderLesson(lesson, moduleData)}
                        </SortableItem>
                      ))}
                      {moduleLessons.length === 0 && (
                        <p className="px-5 py-4 text-muted-foreground text-sm">
                          Nenhuma aula cadastrada neste módulo.
                        </p>
                      )}
                    </div>
                  </SortableContext>
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
