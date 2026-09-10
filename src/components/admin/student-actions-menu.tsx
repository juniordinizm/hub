"use client";

import {
  Book01Icon,
  Certificate01Icon,
  MoreHorizontalIcon,
  SquareLock02Icon,
  UndoIcon,
  ViewIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { AdminCourseStudentAction } from "@/features/admin/student-navigation";
import {
  StudentActionDialog,
  type StudentActionDialogAction,
} from "./student-action-dialog";
import { StudentManagementSheet } from "./student-management-sheet";
import type { StudentManagementCapabilities } from "./student-management-types";

export interface StudentActionMenuStudent {
  email: string;
  name: string;
  platformBlockedAt: string | null;
  platformBlockedReason: string | null;
  userId: string;
}

type StudentActionOverlay = "details" | StudentActionDialogAction | null;

const readOnlyStudentCapabilities: StudentManagementCapabilities = {
  canManageCertificates: false,
  canManageEnrollmentAccess: false,
  canManageEnrollmentSupport: false,
  canManagePlatformAccess: false,
  canReissueCertificates: false,
};

const globalPlatformCapabilities: StudentManagementCapabilities = {
  ...readOnlyStudentCapabilities,
  canManagePlatformAccess: true,
};

const courseEnrollmentCapabilities: StudentManagementCapabilities = {
  ...readOnlyStudentCapabilities,
  canManageEnrollmentAccess: true,
  canManageEnrollmentSupport: true,
};

const courseCertificateCapabilities: StudentManagementCapabilities = {
  ...readOnlyStudentCapabilities,
  canManageCertificates: true,
  canReissueCertificates: true,
};

function StudentActionMenuItems({
  isCourseContext,
  isPlatformBlocked,
  onSelect,
}: {
  isCourseContext: boolean;
  isPlatformBlocked: boolean;
  onSelect: (
    overlay: Exclude<StudentActionOverlay, null>,
    event: Event
  ) => void;
}): React.JSX.Element {
  if (isCourseContext) {
    return (
      <>
        <DropdownMenuItem onSelect={(event) => onSelect("enrollment", event)}>
          <HugeiconsIcon aria-hidden="true" icon={Book01Icon} strokeWidth={2} />
          Gerenciar matrícula
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={(event) => onSelect("certificate", event)}>
          <HugeiconsIcon
            aria-hidden="true"
            icon={Certificate01Icon}
            strokeWidth={2}
          />
          Gerenciar certificados
        </DropdownMenuItem>
      </>
    );
  }

  return (
    <DropdownMenuItem
      onSelect={(event) => onSelect("platform", event)}
      variant={isPlatformBlocked ? "default" : "destructive"}
    >
      <HugeiconsIcon
        aria-hidden="true"
        icon={isPlatformBlocked ? UndoIcon : SquareLock02Icon}
        strokeWidth={2}
      />
      {isPlatformBlocked
        ? "Restaurar acesso da plataforma"
        : "Bloquear acesso da plataforma"}
    </DropdownMenuItem>
  );
}

function StudentActionOverlays({
  activeOverlay,
  certificateCapabilities,
  courseId,
  dataUrl,
  enrollmentCapabilities,
  isCourseContext,
  onDetailsCloseAutoFocus,
  onOpenChange,
  student,
}: {
  activeOverlay: StudentActionOverlay;
  certificateCapabilities: StudentManagementCapabilities;
  courseId?: string;
  dataUrl?: string;
  enrollmentCapabilities: StudentManagementCapabilities;
  isCourseContext: boolean;
  onDetailsCloseAutoFocus: (event: Event) => void;
  onOpenChange: (open: boolean) => void;
  student: StudentActionMenuStudent;
}): React.JSX.Element | null {
  if (activeOverlay === "details") {
    return (
      <StudentManagementSheet
        capabilities={readOnlyStudentCapabilities}
        {...(courseId ? { courseId } : {})}
        {...(dataUrl ? { dataUrl } : {})}
        onCloseAutoFocus={onDetailsCloseAutoFocus}
        onOpenChange={onOpenChange}
        open
        showActions={false}
        trigger={null}
        userId={student.userId}
      />
    );
  }

  if (isCourseContext && activeOverlay === "enrollment") {
    return (
      <StudentActionDialog
        action="enrollment"
        capabilities={enrollmentCapabilities}
        {...(courseId ? { courseId } : {})}
        {...(dataUrl ? { dataUrl } : {})}
        onOpenChange={onOpenChange}
        open
        trigger={null}
        userId={student.userId}
      />
    );
  }

  if (isCourseContext && activeOverlay === "certificate") {
    return (
      <StudentActionDialog
        action="certificate"
        capabilities={certificateCapabilities}
        {...(courseId ? { courseId } : {})}
        {...(dataUrl ? { dataUrl } : {})}
        onOpenChange={onOpenChange}
        open
        trigger={null}
        userId={student.userId}
      />
    );
  }

  if (!isCourseContext && activeOverlay === "platform") {
    return (
      <StudentActionDialog
        action="platform"
        capabilities={globalPlatformCapabilities}
        onOpenChange={onOpenChange}
        open
        platformStudent={student}
        trigger={null}
        userId={student.userId}
      />
    );
  }

  return null;
}

export function StudentActionsMenu({
  certificateCapabilities = courseCertificateCapabilities,
  courseId,
  dataUrl,
  enrollmentCapabilities = courseEnrollmentCapabilities,
  initialOverlay,
  onInitialOverlayClose,
  student,
}: {
  certificateCapabilities?: StudentManagementCapabilities;
  courseId?: string;
  dataUrl?: string;
  enrollmentCapabilities?: StudentManagementCapabilities;
  initialOverlay?: AdminCourseStudentAction | undefined;
  onInitialOverlayClose?: (() => void) | undefined;
  student: StudentActionMenuStudent;
}): React.JSX.Element {
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeOverlay, setActiveOverlay] =
    useState<StudentActionOverlay>(null);
  const actionTriggerRef = useRef<HTMLButtonElement | null>(null);
  const hasAutoOpened = useRef(false);
  const isCourseContext = Boolean(courseId);
  const isPlatformBlocked = Boolean(student.platformBlockedAt);

  useEffect(() => {
    if (!(initialOverlay && !hasAutoOpened.current)) {
      return;
    }
    hasAutoOpened.current = true;
    setActiveOverlay(initialOverlay);
  }, [initialOverlay]);

  const openOverlay = (
    overlay: Exclude<StudentActionOverlay, null>,
    event: Event
  ): void => {
    event.preventDefault();
    setMenuOpen(false);
    setActiveOverlay(overlay);
  };
  const handleOverlayChange = (open: boolean): void => {
    if (!open) {
      const closedOverlay = activeOverlay;
      setActiveOverlay(null);
      if (closedOverlay === initialOverlay) {
        onInitialOverlayClose?.();
      }
    }
  };
  const restoreDetailsFocus = (event: Event): void => {
    event.preventDefault();
    actionTriggerRef.current?.focus();
  };

  return (
    <>
      <DropdownMenu onOpenChange={setMenuOpen} open={menuOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            aria-label={`Ações de ${student.name}`}
            className="size-11"
            ref={actionTriggerRef}
            size="icon"
            type="button"
            variant="outline"
          >
            <HugeiconsIcon
              aria-hidden="true"
              icon={MoreHorizontalIcon}
              strokeWidth={2}
            />
            <span className="sr-only">Abrir ações</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60">
          <DropdownMenuLabel>
            {isCourseContext ? "Ações do Curso" : "Ações do Aluno"}
          </DropdownMenuLabel>
          <DropdownMenuGroup>
            <DropdownMenuItem
              onSelect={(event) => openOverlay("details", event)}
            >
              <HugeiconsIcon
                aria-hidden="true"
                icon={ViewIcon}
                strokeWidth={2}
              />
              Ver detalhes
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <StudentActionMenuItems
              isCourseContext={isCourseContext}
              isPlatformBlocked={isPlatformBlocked}
              onSelect={openOverlay}
            />
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      <StudentActionOverlays
        activeOverlay={activeOverlay}
        certificateCapabilities={certificateCapabilities}
        {...(courseId ? { courseId } : {})}
        {...(dataUrl ? { dataUrl } : {})}
        enrollmentCapabilities={enrollmentCapabilities}
        isCourseContext={isCourseContext}
        onDetailsCloseAutoFocus={restoreDetailsFocus}
        onOpenChange={handleOverlayChange}
        student={student}
      />
    </>
  );
}
