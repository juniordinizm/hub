"use client";

import {
  Delete02Icon,
  MoreHorizontalIcon,
  ViewIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { route } from "@/lib/routes";
import { ArchiveCourseDialog, type CourseData } from "./course-dialogs-client";

interface CourseActionsDropdownProps {
  course: CourseData;
}

export function CourseActionsDropdown({
  course,
}: CourseActionsDropdownProps): React.JSX.Element {
  const [isArchiveDialogOpen, setIsArchiveDialogOpen] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button className="h-8 w-8 p-0" size="sm" variant="outline">
            <HugeiconsIcon
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
              <HugeiconsIcon icon={ViewIcon} />
              Preview como aluno
            </a>
          </DropdownMenuItem>

          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            onSelect={(e) => {
              e.preventDefault();
              setIsArchiveDialogOpen(true);
            }}
          >
            <HugeiconsIcon className="mr-2 h-4 w-4" icon={Delete02Icon} />
            Arquivar curso
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ArchiveCourseDialog
        course={course}
        onOpenChange={setIsArchiveDialogOpen}
        open={isArchiveDialogOpen}
      />
    </>
  );
}
