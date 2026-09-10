"use client";

import {
  Certificate01Icon,
  MoreHorizontalIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { FinanceHelp } from "@/components/admin/finance-help";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableRowHeader,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { getCertificateStatusPresentation } from "@/features/admin/status-presentation";
import { getAdminCourseStudentUrl } from "@/features/admin/student-navigation";
import {
  type CertificateActionState,
  certificateActionInitialState,
} from "@/features/certificates/action-state";
import {
  issueManualCertificateAction,
  reissueCertificateAction,
  revokeCertificateAction,
} from "@/features/certificates/actions";
import {
  CERTIFICATE_REASON_CODES,
  certificateReasonLabel,
} from "@/features/certificates/reasons";
import { formatDateTime } from "@/lib/formatters";
import { route } from "@/lib/routes";
import type {
  StudentSheetCertificate,
  StudentSheetEnrollment,
} from "./student-management-types";

type CertificateAction = (
  previousState: CertificateActionState,
  formData: FormData
) => Promise<CertificateActionState>;

type ActiveCertificateOperation =
  | { kind: "issue" }
  | { certificate: StudentSheetCertificate; kind: "reissue" | "revoke" }
  | null;

function CertificateForm({
  action,
  certificateId,
  courses,
  label,
  onCancel,
  onSuccess,
  userId,
}: {
  action: CertificateAction;
  certificateId?: string;
  courses: StudentSheetEnrollment[];
  label: string;
  onCancel: () => void;
  onSuccess: () => void | Promise<void>;
  userId: string;
}): React.JSX.Element {
  const [localError, setLocalError] = useState<string | null>(null);
  const [reasonCategory, setReasonCategory] = useState("");
  const [selectedCourseId, setSelectedCourseId] = useState(
    courses.length === 1 ? (courses[0]?.courseId ?? "") : ""
  );
  const [confirmed, setConfirmed] = useState(false);
  const [state, formAction, pending] = useActionState(
    action,
    certificateActionInitialState
  );

  useEffect(() => {
    if (state.status === "success") {
      toast.success(state.message);
      Promise.resolve(onSuccess()).catch(() => undefined);
    }
  }, [onSuccess, state.message, state.status]);

  const submit = (formData: FormData): void => {
    if (!(reasonCategory && (certificateId || selectedCourseId) && confirmed)) {
      setLocalError(
        "Revise os dados e confirme a operação antes de continuar."
      );
      return;
    }

    setLocalError(null);
    formData.set("reasonCategory", reasonCategory);
    formData.set("confirmed", "yes");
    if (!certificateId) {
      formData.set("courseId", selectedCourseId);
    }
    formAction(formData);
  };

  return (
    <form
      action={submit}
      className="flex flex-col gap-4 border-t pt-4"
      data-certificate-operation-form
    >
      <input name="userId" type="hidden" value={userId} />
      {certificateId ? (
        <input name="certificateId" type="hidden" value={certificateId} />
      ) : null}
      <FieldGroup>
        {certificateId ? null : (
          <Field>
            <FieldLabel htmlFor={`${label}-course-${userId}`}>Curso</FieldLabel>
            <Select
              onValueChange={setSelectedCourseId}
              value={selectedCourseId}
            >
              <SelectTrigger id={`${label}-course-${userId}`}>
                <SelectValue placeholder="Selecione o Curso" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {courses.map((course) => (
                    <SelectItem key={course.courseId} value={course.courseId}>
                      {course.courseTitle}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>
        )}
        <Field>
          <FieldLabel htmlFor={`${label}-reason-${userId}`}>
            Categoria do motivo
          </FieldLabel>
          <Select onValueChange={setReasonCategory} value={reasonCategory}>
            <SelectTrigger id={`${label}-reason-${userId}`}>
              <SelectValue placeholder="Selecione uma categoria" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {CERTIFICATE_REASON_CODES.map((reason) => (
                  <SelectItem key={reason} value={reason}>
                    {certificateReasonLabel(reason)}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </Field>
        <Field>
          <FieldLabel htmlFor={`${label}-detail-${userId}`}>
            Detalhe interno
          </FieldLabel>
          <Textarea
            id={`${label}-detail-${userId}`}
            name="reasonDetail"
            placeholder="Descreva o motivo para a auditoria"
            required
          />
          <FieldDescription>
            Este detalhe fica restrito à operação e à auditoria.
          </FieldDescription>
        </Field>
      </FieldGroup>
      <Field orientation="horizontal">
        <Checkbox
          checked={confirmed}
          id={`${label}-confirmed-${userId}`}
          onCheckedChange={(value) => setConfirmed(value === true)}
        />
        <FieldLabel htmlFor={`${label}-confirmed-${userId}`}>
          Confirmo que revisei os dados e entendo que a operação será auditada.
        </FieldLabel>
      </Field>
      <div className="flex flex-wrap justify-end gap-2">
        <Button onClick={onCancel} type="button" variant="ghost">
          Cancelar
        </Button>
        <Button
          loading={pending}
          type="submit"
          variant={label.includes("Revogar") ? "destructive" : "default"}
        >
          {label}
        </Button>
      </div>
      {localError || state.status === "error" ? (
        <p aria-live="polite" className="text-destructive text-sm" role="alert">
          {localError ?? state.message}
        </p>
      ) : null}
    </form>
  );
}

function CertificateActionMenu({
  canReissue,
  canRevoke,
  certificate,
  manageHref,
  onSelectOperation,
}: {
  canReissue: boolean;
  canRevoke: boolean;
  certificate: StudentSheetCertificate;
  manageHref?: string;
  onSelectOperation: (kind: "reissue" | "revoke") => void;
}): React.JSX.Element {
  const canReissueCertificate = canReissue && certificate.canReissue;
  const canRevokeCertificate = canRevoke && certificate.status === "valid";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          aria-label={`Ações do certificado ${certificate.code}`}
          className="size-10"
          size="icon"
          type="button"
          variant="outline"
        >
          <HugeiconsIcon
            aria-hidden="true"
            icon={MoreHorizontalIcon}
            size={16}
            strokeWidth={2}
          />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-52">
        <DropdownMenuGroup>
          <DropdownMenuItem asChild>
            <Link
              href={route(`/certificados/${certificate.code}`)}
              rel="noopener noreferrer"
              target="_blank"
            >
              Ver certificado
            </Link>
          </DropdownMenuItem>
          {manageHref ? (
            <DropdownMenuItem asChild>
              <Link href={manageHref}>Gerenciar</Link>
            </DropdownMenuItem>
          ) : null}
          {canReissueCertificate ? (
            <DropdownMenuItem onSelect={() => onSelectOperation("reissue")}>
              Reemitir
            </DropdownMenuItem>
          ) : null}
          {canRevokeCertificate ? (
            <DropdownMenuItem
              onSelect={() => onSelectOperation("revoke")}
              variant="destructive"
            >
              Revogar
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function CertificateTable({
  canReissue,
  canRevoke,
  certificates,
  courseScoped,
  onSelectOperation,
  userId,
}: {
  canReissue: boolean;
  canRevoke: boolean;
  certificates: StudentSheetCertificate[];
  courseScoped: boolean;
  onSelectOperation: (
    certificate: StudentSheetCertificate,
    kind: "reissue" | "revoke"
  ) => void;
  userId: string;
}): React.JSX.Element {
  return (
    <div className="overflow-hidden rounded-lg border">
      <Table className="table-fixed">
        <TableCaption className="sr-only">
          Histórico de certificados do Aluno
        </TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[42%]">Certificado</TableHead>
            <TableHead className="w-[18%]">Status</TableHead>
            <TableHead className="w-[25%] whitespace-nowrap">
              Emitido em
            </TableHead>
            <TableHead className="w-[15%] whitespace-nowrap text-right">
              Ações
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {certificates.map((certificate) => {
            const statusPresentation = getCertificateStatusPresentation(
              certificate.status
            );

            return (
              <TableRow key={certificate.id}>
                <TableRowHeader className="max-w-[260px]">
                  <span
                    className="block truncate"
                    title={certificate.courseTitle}
                  >
                    {certificate.courseTitle}
                  </span>
                  <span
                    className="mt-1 block truncate font-mono text-muted-foreground text-xs"
                    title={certificate.code}
                  >
                    {certificate.code}
                  </span>
                </TableRowHeader>
                <TableCell className="align-top">
                  <div className="min-w-0">
                    <Badge variant={statusPresentation.variant}>
                      {statusPresentation.label}
                    </Badge>
                  </div>
                </TableCell>
                <TableCell className="whitespace-nowrap text-muted-foreground">
                  {formatDateTime(certificate.issuedAt)}
                </TableCell>
                <TableCell className="text-right align-top">
                  <div className="flex flex-col items-end gap-1">
                    <CertificateActionMenu
                      canReissue={canReissue}
                      canRevoke={canRevoke}
                      certificate={certificate}
                      {...(courseScoped
                        ? {}
                        : {
                            manageHref: getAdminCourseStudentUrl(
                              certificate.courseId,
                              userId,
                              "certificate"
                            ),
                          })}
                      onSelectOperation={(kind) =>
                        onSelectOperation(certificate, kind)
                      }
                    />
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

function CertificateSectionHeader({
  canManageCertificates,
}: {
  canManageCertificates: boolean;
}): React.JSX.Element {
  return (
    <div>
      <div className="flex items-center gap-1">
        <h2 className="font-semibold text-base">Certificados</h2>
        <FinanceHelp
          description="Consulte o histórico de certificados e use as operações administrativas somente quando a evidência estiver revisada."
          details={[
            "Válido indica um certificado disponível; Revogado indica que ele não deve mais ser usado como documento vigente.",
            canManageCertificates
              ? "A emissão manual aparece apenas para Cursos sem certificado; Reemitir fica disponível somente no último registro do Curso."
              : "Use Ações para abrir a página pública de validação do Certificado.",
            "O estado de preparo do arquivo é separado da validade do Certificado.",
          ]}
          title="Certificados do Aluno"
        />
      </div>
      <p className="mt-1 text-muted-foreground text-sm">
        {canManageCertificates
          ? "Histórico, validação pública e operações permitidas no escopo atual."
          : "Histórico e validação pública dos Certificados deste Aluno."}
      </p>
    </div>
  );
}

export function StudentCertificateOperations({
  canIssue,
  canReissue,
  canRevoke,
  certificates,
  courses,
  onRefresh,
  courseScoped = false,
  showHeading = true,
  userId,
}: {
  canIssue: boolean;
  canReissue: boolean;
  canRevoke: boolean;
  certificates: StudentSheetCertificate[];
  courses: StudentSheetEnrollment[];
  onRefresh: () => void | Promise<void>;
  courseScoped?: boolean;
  showHeading?: boolean;
  userId: string;
}): React.JSX.Element {
  const [activeOperation, setActiveOperation] =
    useState<ActiveCertificateOperation>(null);
  const certificateCourseIds = new Set(
    certificates.map((certificate) => certificate.courseId)
  );
  const issuanceCourses = canIssue
    ? courses.filter((course) => !certificateCourseIds.has(course.courseId))
    : [];
  const onOperationSuccess = async (): Promise<void> => {
    setActiveOperation(null);
    await onRefresh();
  };
  const activeCertificate =
    activeOperation && activeOperation.kind !== "issue"
      ? activeOperation.certificate
      : null;
  const operationAction =
    activeOperation?.kind === "revoke"
      ? revokeCertificateAction
      : reissueCertificateAction;
  const operationLabel =
    activeOperation?.kind === "revoke"
      ? "Revogar certificado"
      : "Reemitir certificado";
  const canManageCertificates = canIssue || canReissue || canRevoke;

  return (
    <section className="flex flex-col gap-4" data-student-certificates>
      {showHeading ? (
        <CertificateSectionHeader
          canManageCertificates={canManageCertificates}
        />
      ) : null}

      {issuanceCourses.length > 0 ? (
        <div className="flex flex-col items-start gap-3 rounded-lg border bg-muted/10 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="font-medium text-sm">Nova emissão</p>
            <p className="mt-1 text-muted-foreground text-xs">
              Disponível somente para Curso sem certificado registrado.
            </p>
          </div>
          <Button
            onClick={() =>
              setActiveOperation((current) =>
                current?.kind === "issue" ? null : { kind: "issue" }
              )
            }
            size="sm"
            type="button"
            variant={
              activeOperation?.kind === "issue" ? "secondary" : "outline"
            }
          >
            {activeOperation?.kind === "issue"
              ? "Cancelar emissão"
              : "Emitir certificado manual"}
          </Button>
        </div>
      ) : null}

      {canIssue && courses.length === 0 && certificates.length === 0 ? (
        <p className="rounded-lg border border-dashed p-4 text-muted-foreground text-sm">
          É necessário matricular o aluno em um Curso antes de emitir um
          certificado manual.
        </p>
      ) : null}

      {activeOperation?.kind === "issue" ? (
        <CertificateForm
          action={issueManualCertificateAction}
          courses={issuanceCourses}
          label="Emitir certificado"
          onCancel={() => setActiveOperation(null)}
          onSuccess={onOperationSuccess}
          userId={userId}
        />
      ) : null}

      {certificates.length > 0 ? (
        <CertificateTable
          canReissue={canReissue}
          canRevoke={canRevoke}
          certificates={certificates}
          courseScoped={courseScoped}
          onSelectOperation={(certificate, kind) =>
            setActiveOperation((current) =>
              current?.kind === kind &&
              current.certificate.id === certificate.id
                ? null
                : { certificate, kind }
            )
          }
          userId={userId}
        />
      ) : (
        <Empty className="rounded-lg border border-dashed py-8">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <HugeiconsIcon aria-hidden="true" icon={Certificate01Icon} />
            </EmptyMedia>
            <EmptyTitle as="h3">Nenhum certificado registrado</EmptyTitle>
            <EmptyDescription>
              Os certificados emitidos para este Aluno aparecerão aqui.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}

      {activeCertificate && activeOperation?.kind !== "issue" ? (
        <CertificateForm
          action={operationAction}
          certificateId={activeCertificate.id}
          courses={courses}
          label={operationLabel}
          onCancel={() => setActiveOperation(null)}
          onSuccess={onOperationSuccess}
          userId={userId}
        />
      ) : null}
    </section>
  );
}
