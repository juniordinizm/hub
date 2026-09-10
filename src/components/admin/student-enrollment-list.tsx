"use client";

import { ViewIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import Link from "next/link";
import { FinanceHelp } from "@/components/admin/finance-help";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { EnrollmentExpirationControls } from "@/features/admin/enrollment-expiration-controls";
import { getEnrollmentStatusPresentation } from "@/features/admin/status-presentation";
import { getAdminCourseStudentUrl } from "@/features/admin/student-navigation";
import { formatDateTime } from "@/lib/formatters";
import { StudentContentReleaseControls } from "./student-content-release-controls";
import type { StudentSheetEnrollment } from "./student-management-types";

export function StudentEnrollmentDetails({
  canManageAccess,
  canManageEnrollmentAccess,
  enrollment,
  onRefresh,
  showActions = true,
}: {
  canManageAccess: boolean;
  canManageEnrollmentAccess: boolean;
  enrollment: StudentSheetEnrollment;
  onRefresh: () => void | Promise<void>;
  showActions?: boolean;
}): React.JSX.Element {
  const releaseLabel =
    enrollment.contentReleaseMode === "scheduled"
      ? "Liberação programada"
      : "Acesso integral";
  let actionContent: React.JSX.Element;
  if (canManageAccess) {
    actionContent = (
      <EnrollmentExpirationControls
        enrollment={enrollment}
        onSuccess={onRefresh}
      />
    );
  } else if (canManageEnrollmentAccess) {
    actionContent = (
      <p className="mt-1 text-muted-foreground text-sm">
        O seu acesso permite ajustar a liberação do conteúdo, mas não a validade
        da Matrícula.
      </p>
    );
  } else {
    actionContent = (
      <p className="mt-1 text-muted-foreground text-sm">
        Você pode consultar os dados, mas não possui permissão para alterar esta
        Matrícula.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <section
        aria-labelledby={`enrollment-summary-${enrollment.id}`}
        className="rounded-lg border bg-muted/10 p-4"
      >
        <h3
          className="font-semibold text-sm"
          id={`enrollment-summary-${enrollment.id}`}
        >
          Resumo do acesso
        </h3>
        <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-muted-foreground text-xs">Início</dt>
            <dd className="mt-1 font-medium">
              {formatDateTime(enrollment.startedAt)}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-xs">
              Expiração original
            </dt>
            <dd className="mt-1 font-medium">
              {formatDateTime(enrollment.originalExpiresAt)}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-xs">Expiração atual</dt>
            <dd className="mt-1 font-medium">
              {formatDateTime(enrollment.expiresAt)}
            </dd>
          </div>
        </dl>
      </section>

      <section
        aria-labelledby={`enrollment-content-${enrollment.id}`}
        className="rounded-lg border bg-muted/10 p-4"
      >
        <h3
          className="font-semibold text-sm"
          id={`enrollment-content-${enrollment.id}`}
        >
          Liberação do conteúdo
        </h3>
        <p className="mt-1 text-muted-foreground text-sm">
          {releaseLabel}
          {enrollment.contentReleaseStartedAt
            ? ` desde ${formatDateTime(enrollment.contentReleaseStartedAt)}`
            : ""}
          .
        </p>
        {enrollment.nextModuleReleaseAt ? (
          <p className="mt-1 text-muted-foreground text-xs">
            Próximo Módulo em {formatDateTime(enrollment.nextModuleReleaseAt)}
          </p>
        ) : null}
        {showActions && canManageEnrollmentAccess ? (
          <StudentContentReleaseControls
            enrollment={enrollment}
            onSuccess={onRefresh}
          />
        ) : null}
      </section>

      {showActions ? (
        <section
          aria-labelledby={`enrollment-actions-${enrollment.id}`}
          className="flex flex-col gap-3"
        >
          <h3
            className="font-semibold text-sm"
            id={`enrollment-actions-${enrollment.id}`}
          >
            Ações da Matrícula
          </h3>
          {actionContent}
        </section>
      ) : null}
    </div>
  );
}

function StudentEnrollmentDialog({
  canManageAccess,
  canManageEnrollmentAccess,
  enrollment,
  onRefresh,
  showActions,
}: {
  canManageAccess: boolean;
  canManageEnrollmentAccess: boolean;
  enrollment: StudentSheetEnrollment;
  onRefresh: () => void | Promise<void>;
  showActions: boolean;
}): React.JSX.Element {
  const statusPresentation = getEnrollmentStatusPresentation(enrollment.status);
  const hasActions =
    showActions && (canManageAccess || canManageEnrollmentAccess);
  const actionLabel = hasActions ? "Gerenciar" : "Ver detalhes";

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          aria-label={`${actionLabel} matrícula de ${enrollment.courseTitle}`}
          className="shrink-0"
          size="sm"
          type="button"
          variant="outline"
        >
          <HugeiconsIcon
            aria-hidden="true"
            data-icon="inline-start"
            icon={ViewIcon}
            size={16}
            strokeWidth={2}
          />
          {actionLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <div className="flex flex-wrap items-start gap-2 pr-8">
            <DialogTitle className="min-w-0 flex-1">
              {enrollment.courseTitle}
            </DialogTitle>
            <Badge
              aria-label={`Status: ${statusPresentation.label}`}
              variant={statusPresentation.variant}
            >
              {statusPresentation.label}
            </Badge>
          </div>
          <DialogDescription>
            {hasActions
              ? "Consulte os detalhes e conclua as ações permitidas para esta Matrícula."
              : "Detalhes da Matrícula e do acesso ao Curso."}
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          <StudentEnrollmentDetails
            canManageAccess={canManageAccess}
            canManageEnrollmentAccess={canManageEnrollmentAccess}
            enrollment={enrollment}
            onRefresh={onRefresh}
            showActions={showActions}
          />
        </DialogBody>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">
              Fechar
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function StudentEnrollmentCourseLink({
  enrollment,
}: {
  enrollment: StudentSheetEnrollment;
}): React.JSX.Element {
  return (
    <Button asChild className="shrink-0" size="sm" variant="outline">
      <Link
        aria-label={`Abrir matrícula de ${enrollment.courseTitle} no Curso`}
        href={getAdminCourseStudentUrl(
          enrollment.courseId,
          enrollment.userId,
          "details"
        )}
      >
        <HugeiconsIcon
          aria-hidden="true"
          data-icon="inline-start"
          icon={ViewIcon}
          size={16}
          strokeWidth={2}
        />
        Abrir no Curso
      </Link>
    </Button>
  );
}

function StudentEnrollmentEntryAction({
  canManageAccess,
  canManageEnrollmentAccess,
  courseScoped,
  enrollment,
  onRefresh,
  showActions,
}: {
  canManageAccess: boolean;
  canManageEnrollmentAccess: boolean;
  courseScoped: boolean;
  enrollment: StudentSheetEnrollment;
  onRefresh: () => void | Promise<void>;
  showActions: boolean;
}): React.JSX.Element {
  if (!courseScoped) {
    return <StudentEnrollmentCourseLink enrollment={enrollment} />;
  }

  return (
    <StudentEnrollmentDialog
      canManageAccess={canManageAccess}
      canManageEnrollmentAccess={canManageEnrollmentAccess}
      enrollment={enrollment}
      onRefresh={onRefresh}
      showActions={showActions}
    />
  );
}

const getEnrollmentHelpInstruction = (
  hasActions: boolean,
  courseScoped: boolean
): string => {
  if (hasActions) {
    return "Use Gerenciar para abrir os detalhes e os controles permitidos.";
  }
  if (courseScoped) {
    return "Use Ver detalhes para consultar o acesso sem alterar a Matrícula.";
  }
  return "Use Abrir no Curso para consultar a Matrícula no contexto correto.";
};

const getEnrollmentDescription = (
  hasActions: boolean,
  courseScoped: boolean
): string => {
  if (hasActions) {
    return "Escolha um Curso para consultar ou ajustar o acesso.";
  }
  if (courseScoped) {
    return "Consulte os detalhes deste acesso ao Curso.";
  }
  return "Cursos atuais e históricos associados a este Aluno.";
};

export function StudentEnrollmentList({
  canManageAccess,
  canManageEnrollmentAccess = false,
  courseScoped = false,
  enrollments,
  onRefresh,
  showActions = true,
  title = "Matrículas",
}: {
  canManageAccess: boolean;
  canManageEnrollmentAccess?: boolean;
  courseScoped?: boolean;
  enrollments: StudentSheetEnrollment[];
  onRefresh: () => void | Promise<void>;
  showActions?: boolean;
  title?: string;
}): React.JSX.Element {
  const hasActions =
    showActions && (canManageAccess || canManageEnrollmentAccess);

  if (enrollments.length === 0) {
    return (
      <section className="flex flex-col gap-3" data-student-enrollments>
        <div className="flex items-center gap-1">
          <h2 className="font-semibold text-base">{title}</h2>
          <FinanceHelp
            description="Cada Matrícula representa o acesso do Aluno a um Curso específico."
            details={[
              "O estado da Matrícula é diferente do bloqueio geral da plataforma.",
              "As datas mostram o início, a expiração original e a validade atual do acesso.",
            ]}
            title="Acesso por Curso"
          />
        </div>
        <Empty className="rounded-lg border py-8">
          <EmptyHeader>
            <EmptyTitle as="h3">Sem matrículas</EmptyTitle>
            <EmptyDescription>
              Este aluno ainda não possui acesso liberado a nenhum Curso.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-3" data-student-enrollments>
      <div>
        <div className="flex items-center gap-1">
          <h2 className="font-semibold text-base">{title}</h2>
          <FinanceHelp
            description="Cada Matrícula representa o acesso do Aluno a um Curso específico."
            details={[
              "O estado da Matrícula é diferente do bloqueio geral da plataforma.",
              "As datas mostram o início, a expiração original e a validade atual do acesso.",
              getEnrollmentHelpInstruction(hasActions, courseScoped),
            ]}
            title="Acesso por Curso"
          />
        </div>
        <p className="mt-1 text-muted-foreground text-sm">
          {getEnrollmentDescription(hasActions, courseScoped)}
        </p>
      </div>
      <div className="grid gap-3" data-student-enrollment-list>
        {enrollments.map((enrollment) => {
          const statusPresentation = getEnrollmentStatusPresentation(
            enrollment.status
          );
          return (
            <div
              className="grid gap-3 rounded-lg border bg-muted/10 p-3 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center"
              key={enrollment.id}
            >
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                  <HugeiconsIcon
                    aria-hidden="true"
                    icon={ViewIcon}
                    size={16}
                    strokeWidth={2}
                  />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-sm">
                    {enrollment.courseTitle}
                  </span>
                  <span className="block text-muted-foreground text-xs">
                    Expira em {formatDateTime(enrollment.expiresAt)}
                  </span>
                </span>
              </div>
              <Badge
                aria-label={`Status: ${statusPresentation.label}`}
                className="w-fit shrink-0"
                variant={statusPresentation.variant}
              >
                {statusPresentation.label}
              </Badge>
              <StudentEnrollmentEntryAction
                canManageAccess={canManageAccess}
                canManageEnrollmentAccess={canManageEnrollmentAccess}
                courseScoped={courseScoped}
                enrollment={enrollment}
                onRefresh={onRefresh}
                showActions={showActions}
              />
            </div>
          );
        })}
      </div>
    </section>
  );
}
