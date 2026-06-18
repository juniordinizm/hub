"use client";

import React from "react";
import { SortableItem, SortableList } from "@/components/sortable-list";
import {
  reorderLessonsAction,
  reorderModulesAction,
} from "@/features/admin/actions";

export function CourseModulesList({
  courseId,
  moduleIds,
  children,
}: {
  courseId: string;
  moduleIds: string[];
  children: React.ReactNode;
}) {
  return (
    <SortableList
      className="mt-4 flex flex-col gap-8"
      itemIds={moduleIds}
      onReorder={(newOrder) => reorderModulesAction(courseId, newOrder)}
    >
      {React.Children.map(children, (child, index) => {
        const id = moduleIds[index];
        if (!id) {
          return null;
        }
        return (
          <SortableItem
            className="flex-col rounded-lg border bg-card shadow-sm sm:flex-row"
            id={id}
            key={id}
          >
            {child}
          </SortableItem>
        );
      })}
    </SortableList>
  );
}

export function ModuleLessonsList({
  moduleId,
  lessonIds,
  children,
}: {
  moduleId: string;
  lessonIds: string[];
  children: React.ReactNode;
}) {
  return (
    <SortableList
      className="divide-y border-t"
      itemIds={lessonIds}
      onReorder={(newOrder) => reorderLessonsAction(moduleId, newOrder)}
    >
      {React.Children.map(children, (child, index) => {
        const id = lessonIds[index];
        if (!id) {
          return null;
        }
        return (
          <SortableItem
            className="bg-background/20 transition-colors hover:bg-muted/10"
            handleClassName="px-4"
            id={id}
            key={id}
          >
            {child}
          </SortableItem>
        );
      })}
    </SortableList>
  );
}
