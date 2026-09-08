"use client";

import { MoreHorizontalIcon, ViewIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { route } from "@/lib/routes";
import type { CourseData } from "./course-dialogs-client";

interface CourseActionsDropdownProps {
  course: CourseData;
}

export function CourseActionsDropdown({
  course,
}: CourseActionsDropdownProps): React.JSX.Element {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          className="size-11 p-0 sm:size-10"
          size="icon"
          variant="outline"
        >
          <HugeiconsIcon
            aria-hidden="true"
            icon={MoreHorizontalIcon}
            size={16}
            strokeWidth={2}
          />
          <span className="sr-only">Opções</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem asChild>
          <a href={route(`/app/cursos/${course.id}?preview=student`)}>
            <HugeiconsIcon
              aria-hidden="true"
              data-icon="inline-start"
              icon={ViewIcon}
            />
            Preview como aluna
          </a>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
