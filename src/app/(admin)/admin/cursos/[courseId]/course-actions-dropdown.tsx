"use client";

import {
  Delete02Icon,
  Edit01Icon,
  MoreHorizontalIcon,
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
import {
  type CourseData,
  CourseEditDialog,
  DeleteCourseDialog,
} from "./course-dialogs-client";

interface CourseActionsDropdownProps {
  course: CourseData;
}

export function CourseActionsDropdown({
  course,
}: CourseActionsDropdownProps): React.JSX.Element {
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

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
          <DropdownMenuItem
            onSelect={(e) => {
              e.preventDefault();
              setIsEditDialogOpen(true);
            }}
          >
            <HugeiconsIcon className="mr-2 h-4 w-4" icon={Edit01Icon} />
            Editar curso
          </DropdownMenuItem>
          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            onSelect={(e) => {
              e.preventDefault();
              setIsDeleteDialogOpen(true);
            }}
          >
            <HugeiconsIcon className="mr-2 h-4 w-4" icon={Delete02Icon} />
            Excluir curso
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <CourseEditDialog
        course={course}
        onOpenChange={setIsEditDialogOpen}
        open={isEditDialogOpen}
      />
      <DeleteCourseDialog
        course={course}
        onOpenChange={setIsDeleteDialogOpen}
        open={isDeleteDialogOpen}
      />
    </>
  );
}
