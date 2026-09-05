"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useCallback, useEffect, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatCurrencyInCents, formatDateTime } from "@/lib/formatters";
import { StudentCertificateOperations } from "./student-certificate-operations";
import { StudentEnrollmentList } from "./student-enrollment-list";
import type {
  StudentManagementCapabilities,
  StudentSheetPayload,
} from "./student-management-types";
import { StudentPlatformAccessControls } from "./student-platform-access-controls";

export type { StudentSheetPayload } from "./student-management-types";

export const SupportContextPanel = ({
  context,
}: {
  context: NonNullable<StudentSheetPayload["supportContext"]>;
}): React.JSX.Element => (
  <div className="flex flex-col gap-6" data-support-operational-context>
    <section
      aria-labelledby="support-progress-title"
      className="rounded-lg border p-4"
    >
      <h2 className="font-semibold text-base" id="support-progress-title">
        Progresso obrigatório
      </h2>
      <p className="mt-2 text-muted-foreground text-sm">
        {context.progress.completedRequiredLessons} de{" "}
        {context.progress.requiredLessons} aulas obrigatórias
      </p>
    </section>
    <section
      aria-labelledby="support-content-release-title"
      className="rounded-lg border p-4"
    >
      <h2
        className="font-semibold text-base"
        id="support-content-release-title"
      >
        Liberação de conteúdo
      </h2>
      <p className="mt-2 text-muted-foreground text-sm">
        {context.contentReleaseMode === "scheduled"
          ? `Programada desde ${context.contentReleaseStartedAt ? formatDateTime(context.contentReleaseStartedAt) : "âncora indisponível"}`
          : "Acesso integral"}
      </p>
      {context.nextModuleReleaseAt ? (
        <p className="mt-1 text-muted-foreground text-xs">
          Próximo Módulo em {formatDateTime(context.nextModuleReleaseAt)}
        </p>
      ) : null}
    </section>
    <section aria-labelledby="support-orders-title">
      <h2 className="font-semibold text-base" id="support-orders-title">
        Pedidos e reembolsos
      </h2>
      {context.orders.length ? (
        <ul className="mt-3 divide-y rounded-lg border">
          {context.orders.map((order) => (
            <li className="p-3" key={order.id}>
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="truncate font-medium text-sm">
                    Pedido {order.id}
                  </p>
                  <p className="mt-1 text-muted-foreground text-xs">
                    {formatDateTime(order.createdAt)} · {order.status}
                    {order.refundStatus ? ` · ${order.refundStatus}` : ""}
                  </p>
                </div>
                <p className="shrink-0 font-medium text-sm">
                  {formatCurrencyInCents(
                    order.paidAmountInCents ?? order.amountInCents
                  )}
                </p>
              </div>
              {order.refundedAmountInCents === null ? null : (
                <p className="mt-2 text-muted-foreground text-xs">
                  Reembolsado:{" "}
                  {formatCurrencyInCents(order.refundedAmountInCents)}
                </p>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-muted-foreground text-sm">
          Nenhum Pedido associado a esta Aluna neste Curso.
        </p>
      )}
    </section>
    <section aria-labelledby="support-history-title">
      <h2 className="font-semibold text-base" id="support-history-title">
        Histórico contextual
      </h2>
      {context.audit.length ? (
        <ul className="mt-3 divide-y rounded-lg border">
          {context.audit.map((entry) => (
            <li
              className="p-3"
              key={`${entry.action}-${entry.createdAt}-${entry.targetId ?? "none"}`}
            >
              <p className="font-medium text-sm">{entry.action}</p>
              <p className="mt-1 text-muted-foreground text-xs">
                {entry.targetType}
                {entry.targetId ? ` · ${entry.targetId}` : ""} ·{" "}
                {formatDateTime(entry.createdAt)}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-muted-foreground text-sm">
          Nenhum evento contextual registrado.
        </p>
      )}
    </section>
  </div>
);

const getStudentSheetUrl = (userId: string, courseId?: string): string => {
  const params = courseId ? `?courseId=${encodeURIComponent(courseId)}` : "";
  return `/api/admin/students/${encodeURIComponent(userId)}${params}`;
};

const getHeaderBadge = ({
  courseId,
  platformBlockedAt,
}: {
  courseId: string | null;
  platformBlockedAt: string | null;
}): { label: string; variant: "destructive" | "secondary" } => {
  if (courseId) {
    return { label: "Curso selecionado", variant: "secondary" };
  }
  if (platformBlockedAt) {
    return { label: "Plataforma bloqueada", variant: "destructive" };
  }
  return { label: "Plataforma ativa", variant: "secondary" };
};

export function StudentManagementSheet({
  capabilities,
  courseId,
  dataUrl,
  trigger,
  userId,
}: {
  capabilities: StudentManagementCapabilities;
  courseId?: string;
  dataUrl?: string;
  trigger: ReactNode;
  userId: string;
}): React.JSX.Element {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<StudentSheetPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const headerBadge = data
    ? getHeaderBadge({
        courseId: data.context.courseId,
        platformBlockedAt: data.student.platformBlockedAt,
      })
    : null;

  const load = useCallback(
    async (signal?: AbortSignal): Promise<void> => {
      setIsLoading(true);
      setError(null);

      try {
        const requestInit: RequestInit = { cache: "no-store" };
        if (signal) {
          requestInit.signal = signal;
        }
        const response = await fetch(
          dataUrl ?? getStudentSheetUrl(userId, courseId),
          requestInit
        );
        if (!response.ok) {
          throw new Error(
            response.status === 404
              ? "Não foi possível localizar esta aluna ou o contexto do Curso."
              : "Não foi possível carregar os dados da aluna."
          );
        }
        setData((await response.json()) as StudentSheetPayload);
      } catch (loadError) {
        if (
          loadError instanceof DOMException &&
          loadError.name === "AbortError"
        ) {
          return;
        }
        setData(null);
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Não foi possível carregar os dados da aluna."
        );
      } finally {
        if (!signal?.aborted) {
          setIsLoading(false);
        }
      }
    },
    [courseId, dataUrl, userId]
  );
  const refresh = useCallback(async (): Promise<void> => {
    await load();
    router.refresh();
  }, [load, router]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const controller = new AbortController();
    load(controller.signal).catch(() => undefined);
    return () => controller.abort();
  }, [load, open]);

  const handleOpenChange = (nextOpen: boolean): void => {
    setOpen(nextOpen);
    if (!nextOpen) {
      setData(null);
      setError(null);
    }
  };

  return (
    <Sheet onOpenChange={handleOpenChange} open={open}>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent
        className="sm:!w-[800px] sm:!max-w-[800px] w-full gap-0 p-0"
        data-student-management-sheet
        side="right"
      >
        <SheetHeader className="border-b pr-14">
          {data ? (
            <div className="flex min-w-0 items-start justify-between gap-4">
              <div className="min-w-0">
                <SheetTitle className="truncate text-lg">
                  {data.student.name}
                </SheetTitle>
                <SheetDescription className="mt-1 truncate">
                  {data.student.email}
                  {data.context.courseTitle
                    ? ` · ${data.context.courseTitle}`
                    : ""}
                </SheetDescription>
              </div>
              {headerBadge ? (
                <Badge className="shrink-0" variant={headerBadge.variant}>
                  {headerBadge.label}
                </Badge>
              ) : null}
            </div>
          ) : (
            <>
              <SheetTitle>Gerenciar aluna</SheetTitle>
              <SheetDescription>
                Consulte acessos, matrículas e certificados sem sair da lista.
              </SheetDescription>
            </>
          )}
        </SheetHeader>
        <ScrollArea className="min-h-0 flex-1">
          {isLoading ? <StudentManagementSheetSkeleton /> : null}
          {!isLoading && error ? (
            <div className="p-6" data-student-sheet-error>
              <Alert variant="destructive">
                <AlertTitle>Não foi possível carregar a ficha</AlertTitle>
                <AlertDescription className="flex flex-col items-start gap-3">
                  <span>{error}</span>
                  <Button
                    onClick={() => load().catch(() => undefined)}
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    Tentar novamente
                  </Button>
                </AlertDescription>
              </Alert>
            </div>
          ) : null}
          {!(isLoading || error) && data ? (
            <StudentManagementSheetContent
              capabilities={capabilities}
              data={data}
              onRefresh={refresh}
            />
          ) : null}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

export function StudentManagementSheetContent({
  capabilities,
  data,
  onRefresh,
}: {
  capabilities: StudentManagementCapabilities;
  data: StudentSheetPayload;
  onRefresh: () => void | Promise<void>;
}): React.JSX.Element {
  const isCourseContext = data.context.courseId !== null;
  const student = data.student;
  const [activeTab, setActiveTab] = useState<
    "access" | "certificates" | "operations"
  >("access");

  const handleTabChange = (value: string): void => {
    if (
      value === "access" ||
      value === "certificates" ||
      value === "operations"
    ) {
      setActiveTab(value);
    }
  };

  return (
    <div className="p-6" data-student-sheet-content>
      <Tabs className="gap-5" onValueChange={handleTabChange} value={activeTab}>
        <TabsList className="w-full" variant="line">
          <TabsTrigger className="flex-1" value="access">
            Acesso
          </TabsTrigger>
          <TabsTrigger className="flex-1" value="certificates">
            Certificados
          </TabsTrigger>
          {data.supportContext ? (
            <TabsTrigger className="flex-1" value="operations">
              Operação
            </TabsTrigger>
          ) : null}
        </TabsList>
        <TabsContent className="flex flex-col gap-6" value="access">
          {isCourseContext ? (
            <div className="rounded-lg border bg-muted/30 p-4">
              <p className="font-medium text-sm">Curso em contexto</p>
              <p className="mt-1 text-muted-foreground text-sm">
                {data.context.courseTitle}
              </p>
            </div>
          ) : null}
          {!isCourseContext && capabilities.canManagePlatformAccess ? (
            <StudentPlatformAccessControls
              onSuccess={onRefresh}
              student={student}
            />
          ) : null}
          <StudentEnrollmentList
            canManageAccess={capabilities.canManageEnrollmentSupport}
            canManageEnrollmentAccess={
              capabilities.canManageEnrollmentAccess ?? false
            }
            enrollments={student.enrollments}
            onRefresh={onRefresh}
            title={isCourseContext ? "Acesso ao Curso" : "Matrículas"}
          />
        </TabsContent>
        <TabsContent className="flex flex-col gap-6" value="certificates">
          <StudentCertificateOperations
            canIssue={capabilities.canManageCertificates}
            canReissue={capabilities.canReissueCertificates}
            canRevoke={capabilities.canManageCertificates}
            certificates={data.certificates}
            courses={student.enrollments}
            onRefresh={onRefresh}
            userId={student.userId}
          />
        </TabsContent>
        {data.supportContext ? (
          <TabsContent className="flex flex-col gap-6" value="operations">
            <SupportContextPanel context={data.supportContext} />
          </TabsContent>
        ) : null}
      </Tabs>
    </div>
  );
}

function StudentManagementSheetSkeleton(): React.JSX.Element {
  return (
    <div
      aria-label="Carregando ficha da aluna"
      className="flex flex-col gap-6 p-6"
      data-student-sheet-skeleton
      role="status"
    >
      <div className="flex flex-col gap-3">
        <Skeleton className="h-5 w-20" />
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-4 w-44" />
      </div>
      <Skeleton className="h-20 w-full rounded-lg" />
      <Skeleton className="h-28 w-full rounded-lg" />
      <Skeleton className="h-36 w-full rounded-lg" />
    </div>
  );
}
