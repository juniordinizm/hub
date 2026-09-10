"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useCallback, useEffect, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { StudentCertificateOperations } from "./student-certificate-operations";
import { StudentEnrollmentDetails } from "./student-enrollment-list";
import { getStudentManagementDataUrl } from "./student-management-data";
import type {
  StudentManagementCapabilities,
  StudentSheetPayload,
} from "./student-management-types";
import {
  StudentPlatformAccessControls,
  type StudentPlatformAccessStudent,
} from "./student-platform-access-controls";

export type StudentActionDialogAction =
  | "certificate"
  | "enrollment"
  | "platform";

const getDialogCopy = (
  action: StudentActionDialogAction
): { description: string; title: string } => {
  if (action === "platform") {
    return {
      description: "Bloqueie ou restaure o acesso geral do Aluno à plataforma.",
      title: "Acesso na plataforma",
    };
  }
  if (action === "enrollment") {
    return {
      description:
        "Ajuste somente a Matrícula e a liberação de conteúdo deste Curso.",
      title: "Gerenciar matrícula",
    };
  }
  return {
    description:
      "Consulte e execute as operações de Certificado permitidas para este Curso.",
    title: "Gerenciar certificados",
  };
};

function ActionDialogBody({
  action,
  capabilities,
  data,
  onRefresh,
}: {
  action: StudentActionDialogAction;
  capabilities: StudentManagementCapabilities;
  data: StudentSheetPayload;
  onRefresh: () => void | Promise<void>;
}): React.JSX.Element {
  const enrollment = data.context.courseId
    ? data.student.enrollments.find(
        (candidate) => candidate.courseId === data.context.courseId
      )
    : null;

  if (action === "platform") {
    return (
      <StudentPlatformAccessControls
        onSuccess={onRefresh}
        showHeading={false}
        student={data.student}
      />
    );
  }

  if (!enrollment) {
    return (
      <Empty className="rounded-lg border border-dashed py-8">
        <EmptyHeader>
          <EmptyTitle as="h3">Matrícula não encontrada</EmptyTitle>
          <EmptyDescription>
            Atualize a página para consultar o estado mais recente do Curso.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  if (action === "enrollment") {
    return (
      <StudentEnrollmentDetails
        canManageAccess={capabilities.canManageEnrollmentSupport}
        canManageEnrollmentAccess={
          capabilities.canManageEnrollmentAccess ?? false
        }
        enrollment={enrollment}
        onRefresh={onRefresh}
      />
    );
  }

  return (
    <StudentCertificateOperations
      canIssue={capabilities.canManageCertificates}
      canReissue={capabilities.canReissueCertificates}
      canRevoke={capabilities.canManageCertificates}
      certificates={data.certificates.filter(
        (certificate) => certificate.courseId === enrollment.courseId
      )}
      courseScoped
      courses={[enrollment]}
      onRefresh={onRefresh}
      showHeading={false}
      userId={data.student.userId}
    />
  );
}

function ActionDialogContent({
  action,
  capabilities,
  data,
  error,
  hasImmediatePlatformStudent,
  isLoading,
  onRefresh,
  onRetry,
  platformStudent,
}: {
  action: StudentActionDialogAction;
  capabilities: StudentManagementCapabilities;
  data: StudentSheetPayload | null;
  error: string | null;
  hasImmediatePlatformStudent: boolean;
  isLoading: boolean;
  onRefresh: () => void | Promise<void>;
  onRetry: () => void;
  platformStudent?: StudentPlatformAccessStudent | undefined;
}): React.JSX.Element | null {
  if (isLoading) {
    return (
      <div
        aria-label="Carregando dados da operação"
        className="flex min-h-40 items-center justify-center text-muted-foreground text-sm"
        role="status"
      >
        Carregando…
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Não foi possível carregar a operação</AlertTitle>
        <AlertDescription className="flex flex-col items-start gap-3">
          <span>{error}</span>
          <Button onClick={onRetry} size="sm" type="button" variant="outline">
            Tentar novamente
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  if (hasImmediatePlatformStudent && platformStudent) {
    return (
      <StudentPlatformAccessControls
        onSuccess={onRefresh}
        showHeading={false}
        student={platformStudent}
      />
    );
  }

  if (!data) {
    return null;
  }

  return (
    <ActionDialogBody
      action={action}
      capabilities={capabilities}
      data={data}
      onRefresh={onRefresh}
    />
  );
}

export function StudentActionDialog({
  action,
  capabilities,
  courseId,
  dataUrl,
  onOpenChange,
  open: controlledOpen,
  platformStudent,
  trigger,
  userId,
}: {
  action: StudentActionDialogAction;
  capabilities: StudentManagementCapabilities;
  courseId?: string;
  dataUrl?: string;
  onOpenChange?: (open: boolean) => void;
  open?: boolean;
  platformStudent?: StudentPlatformAccessStudent | undefined;
  trigger?: ReactNode;
  userId: string;
}): React.JSX.Element {
  const router = useRouter();
  const [internalOpen, setInternalOpen] = useState(false);
  const [data, setData] = useState<StudentSheetPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const copy = getDialogCopy(action);
  const hasImmediatePlatformStudent =
    action === "platform" && platformStudent !== undefined;

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
          dataUrl ?? getStudentManagementDataUrl(userId, courseId),
          requestInit
        );
        if (!response.ok) {
          throw new Error(
            response.status === 404
              ? "Não foi possível localizar o Aluno ou o Curso."
              : "Não foi possível carregar os dados da operação."
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
            : "Não foi possível carregar os dados da operação."
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
    if (!hasImmediatePlatformStudent) {
      await load();
    }
    router.refresh();
  }, [hasImmediatePlatformStudent, load, router]);

  useEffect(() => {
    if (!open) {
      return;
    }

    if (hasImmediatePlatformStudent) {
      setIsLoading(false);
      setError(null);
      setData(null);
      return;
    }

    const controller = new AbortController();
    load(controller.signal).catch(() => undefined);
    return () => controller.abort();
  }, [hasImmediatePlatformStudent, load, open]);

  const handleOpenChange = (nextOpen: boolean): void => {
    if (controlledOpen === undefined) {
      setInternalOpen(nextOpen);
    }
    onOpenChange?.(nextOpen);
    if (!nextOpen) {
      setData(null);
      setError(null);
    }
  };

  return (
    <Dialog onOpenChange={handleOpenChange} open={open}>
      {trigger ? <DialogTrigger asChild>{trigger}</DialogTrigger> : null}
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{copy.title}</DialogTitle>
          <DialogDescription>{copy.description}</DialogDescription>
        </DialogHeader>
        <DialogBody>
          <ActionDialogContent
            action={action}
            capabilities={capabilities}
            data={data}
            error={error}
            hasImmediatePlatformStudent={hasImmediatePlatformStudent}
            isLoading={isLoading}
            onRefresh={refresh}
            onRetry={() => load().catch(() => undefined)}
            {...(platformStudent ? { platformStudent } : {})}
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
