"use client";

import { ViewIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  EnrollmentExpirationControls,
  statusLabels,
} from "@/features/admin/enrollment-expiration-controls";
import { formatDateTime } from "@/lib/formatters";
import type { StudentSheetEnrollment } from "./student-management-types";

export function StudentEnrollmentList({
  enrollments,
  onRefresh,
  title = "Matrículas",
}: {
  enrollments: StudentSheetEnrollment[];
  onRefresh: () => void | Promise<void>;
  title?: string;
}): React.JSX.Element {
  const [expandedEnrollmentId, setExpandedEnrollmentId] = useState<
    string | null
  >(null);

  if (enrollments.length === 0) {
    return (
      <section className="flex flex-col gap-3" data-student-enrollments>
        <h2 className="font-semibold text-base">{title}</h2>
        <Empty className="rounded-lg border py-8">
          <EmptyHeader>
            <EmptyTitle>Sem matrículas</EmptyTitle>
            <EmptyDescription>
              Esta aluna ainda não possui acesso liberado a nenhum Curso.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-3" data-student-enrollments>
      <div>
        <h2 className="font-semibold text-base">{title}</h2>
        <p className="mt-1 text-muted-foreground text-sm">
          Escolha um Curso para consultar ou ajustar o acesso.
        </p>
      </div>
      <div className="divide-y rounded-lg border" data-student-enrollment-list>
        {enrollments.map((enrollment) => {
          const isExpanded = expandedEnrollmentId === enrollment.id;
          return (
            <div className="px-3" key={enrollment.id}>
              <div className="flex items-center gap-3 py-3">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                  <HugeiconsIcon icon={ViewIcon} size={16} strokeWidth={2} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-sm">
                    {enrollment.courseTitle}
                  </span>
                  <span className="block text-muted-foreground text-xs">
                    Expira em {formatDateTime(enrollment.expiresAt)}
                  </span>
                </span>
                <Badge className="shrink-0" variant="outline">
                  {statusLabels[enrollment.status] ?? enrollment.status}
                </Badge>
                <Button
                  aria-controls={`enrollment-${enrollment.id}`}
                  aria-pressed={isExpanded}
                  onClick={() =>
                    setExpandedEnrollmentId((current) =>
                      current === enrollment.id ? null : enrollment.id
                    )
                  }
                  size="sm"
                  type="button"
                  variant="ghost"
                >
                  {isExpanded ? "Fechar" : "Gerenciar"}
                </Button>
              </div>
              {isExpanded ? (
                <div
                  className="border-t pt-4 pb-3"
                  id={`enrollment-${enrollment.id}`}
                >
                  <dl className="grid gap-3 text-sm sm:grid-cols-3">
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
                      <dt className="text-muted-foreground text-xs">
                        Expiração atual
                      </dt>
                      <dd className="mt-1 font-medium">
                        {formatDateTime(enrollment.expiresAt)}
                      </dd>
                    </div>
                  </dl>
                  <div className="mt-4">
                    <EnrollmentExpirationControls
                      enrollment={enrollment}
                      onSuccess={onRefresh}
                    />
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}
