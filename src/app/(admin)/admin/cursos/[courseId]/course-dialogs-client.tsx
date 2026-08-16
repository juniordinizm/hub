"use client";

import { AlertCircleIcon, FloppyDiskIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { CourseCoverUploadField } from "@/components/course-cover-upload-field";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { saveCourseAction } from "@/features/admin/actions";
import {
  getEffectiveMaxInstallmentCount,
  MAX_INSTALLMENT_COUNT,
} from "@/features/payments/course-payment-offer";
import { parseCoursePriceToCents } from "@/features/payments/course-price";
import { formatCurrencyInCents } from "@/lib/formatters";

export interface CourseData {
  accessDurationMonths: number;
  coverImage?: unknown;
  description: string | null;
  id: string;
  paymentAllowCreditCard: boolean;
  paymentAllowPix: boolean;
  paymentMaxInstallmentCount: number;
  priceInCents: number;
  slug: string;
  status: string;
  subtitle: string | null;
  thumbnailUrl: string | null;
  title: string;
  workloadHours: number;
  workloadHoursOverride: number | null;
}

interface PendingPriceChange {
  formData: FormData;
  priceInCents: number;
}

export function CourseSettingsForm({
  course,
}: {
  course: CourseData;
}): React.JSX.Element {
  const [isPending, startTransition] = useTransition();
  const [pendingPriceChange, setPendingPriceChange] =
    useState<PendingPriceChange | null>(null);
  const effectiveMaxInstallmentCount = getEffectiveMaxInstallmentCount({
    configuredMaxInstallmentCount: course.paymentMaxInstallmentCount,
    priceInCents: course.priceInCents,
  });

  const saveCourseSettings = (formData: FormData): void => {
    const toastId = toast.loading("Salvando configuracoes...");

    startTransition(async () => {
      try {
        await saveCourseAction(formData);
        toast.success("Configuracoes salvas com sucesso!", { id: toastId });
      } catch {
        toast.error("Nao foi possivel salvar o curso.", { id: toastId });
      }
    });
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>): void => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    try {
      const priceInCents = parseCoursePriceToCents(
        String(formData.get("price") ?? "")
      );

      if (priceInCents !== course.priceInCents) {
        setPendingPriceChange({ formData, priceInCents });
        return;
      }
    } catch {
      // Let the server keep reporting invalid price input through the existing flow.
    }

    saveCourseSettings(formData);
  };

  return (
    <>
      <form className="flex flex-col gap-6" onSubmit={handleSubmit}>
        <fieldset className="contents" disabled={isPending}>
          <FieldGroup>
            <input name="courseId" type="hidden" value={course.id} />

            <div className="grid gap-x-8 gap-y-5 sm:grid-cols-[auto_1fr]">
              <Field className="row-span-2">
                <CourseCoverUploadField
                  aggregateId={course.id}
                  defaultCoverImage={course.coverImage}
                  defaultThumbnailUrl={course.thumbnailUrl}
                />
              </Field>
              <Field>
                <FieldLabel>Titulo</FieldLabel>
                <Input defaultValue={course.title} name="title" required />
              </Field>
              <Field>
                <FieldLabel>Subtitulo</FieldLabel>
                <Input defaultValue={course.subtitle ?? ""} name="subtitle" />
              </Field>
            </div>

            <Field>
              <FieldLabel>Descricao</FieldLabel>
              <Textarea
                className="min-h-24 resize-y"
                defaultValue={course.description ?? ""}
                name="description"
              />
            </Field>

            <div className="rounded-lg border bg-muted/20 p-4">
              <div className="mb-3">
                <h3 className="font-medium text-sm">Carga horária exibida</h3>
                <p className="mt-1 text-muted-foreground text-xs">
                  Deixe vazio para calcular automaticamente pela soma das aulas.
                  O valor definido aqui aparece para os alunos e nos próximos
                  certificados.
                </p>
              </div>
              <Field className="max-w-xs gap-2">
                <FieldLabel htmlFor="course-settings-workload-hours">
                  Horas do curso
                </FieldLabel>
                <Input
                  defaultValue={course.workloadHoursOverride ?? ""}
                  id="course-settings-workload-hours"
                  inputMode="numeric"
                  min={0}
                  name="workloadHoursOverride"
                  placeholder={`Automática: ${course.workloadHours} horas`}
                  type="number"
                />
                <FieldDescription>
                  Cálculo atual: {course.workloadHours}{" "}
                  {course.workloadHours === 1 ? "hora" : "horas"}.
                </FieldDescription>
              </Field>
            </div>

            <div className="grid gap-5 md:grid-cols-3">
              <Field>
                <FieldLabel htmlFor="course-settings-price">
                  Preco do curso
                </FieldLabel>
                <Input
                  defaultValue={formatCurrencyInCents(course.priceInCents)}
                  id="course-settings-price"
                  name="price"
                  required
                />
              </Field>
              <Field>
                <FieldLabel>Meses de acesso</FieldLabel>
                <Input
                  defaultValue={course.accessDurationMonths ?? 12}
                  min={1}
                  name="accessDurationMonths"
                  type="number"
                />
              </Field>
              <Field>
                <FieldLabel>Status</FieldLabel>
                <Select defaultValue={course.status ?? "draft"} name="status">
                  <SelectTrigger>
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Rascunho</SelectItem>
                    <SelectItem value="active">Publicado</SelectItem>
                    <SelectItem value="archived">Arquivado</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </div>

            <div className="rounded-lg border p-4">
              <input name="paymentOfferPresent" type="hidden" value="on" />
              <div>
                <h3 className="font-medium">Oferta de pagamento</h3>
                <p className="mt-1 text-muted-foreground text-sm">
                  O Checkout Asaas aplica estas opcoes somente às novas compras.
                </p>
              </div>
              <div className="mt-4 grid gap-4 md:grid-cols-3">
                <Field orientation="horizontal">
                  <Checkbox
                    defaultChecked={course.paymentAllowPix}
                    id="course-payment-pix"
                    name="paymentAllowPix"
                  />
                  <FieldLabel htmlFor="course-payment-pix">
                    Aceitar Pix
                  </FieldLabel>
                </Field>
                <Field orientation="horizontal">
                  <Checkbox
                    defaultChecked={course.paymentAllowCreditCard}
                    id="course-payment-card"
                    name="paymentAllowCreditCard"
                  />
                  <FieldLabel htmlFor="course-payment-card">
                    Aceitar cartao
                  </FieldLabel>
                </Field>
                <Field>
                  <FieldLabel htmlFor="course-payment-installments">
                    Maximo de parcelas
                  </FieldLabel>
                  <Input
                    defaultValue={course.paymentMaxInstallmentCount}
                    id="course-payment-installments"
                    max={MAX_INSTALLMENT_COUNT}
                    min={1}
                    name="paymentMaxInstallmentCount"
                    required
                    type="number"
                  />
                </Field>
              </div>
              <p className="mt-3 text-muted-foreground text-xs">
                O Checkout hospedado nao permite definir, por compra, quem paga
                os juros do parcelamento. Taxas e recebimento seguem o contrato
                da conta Asaas.
              </p>
              {course.paymentAllowCreditCard &&
              effectiveMaxInstallmentCount <
                course.paymentMaxInstallmentCount ? (
                <p className="mt-2 text-amber-700 text-xs">
                  Pelo preco atual, o Checkout sera limitado a{" "}
                  {effectiveMaxInstallmentCount}x. A configuracao de{" "}
                  {course.paymentMaxInstallmentCount}x continua salva para
                  futuros reajustes de preco.
                </p>
              ) : null}
            </div>
          </FieldGroup>

          <div className="mt-2 flex justify-end">
            <Button disabled={isPending} type="submit">
              <HugeiconsIcon icon={FloppyDiskIcon} size={18} strokeWidth={2} />
              {isPending ? "Salvando..." : "Salvar configuracoes"}
            </Button>
          </div>
        </fieldset>
      </form>

      <AlertDialog
        onOpenChange={(open) => {
          if (!open) {
            setPendingPriceChange(null);
          }
        }}
        open={pendingPriceChange !== null}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia>
              <HugeiconsIcon icon={AlertCircleIcon} />
            </AlertDialogMedia>
            <AlertDialogTitle>Confirmar alteração de preço?</AlertDialogTitle>
            <AlertDialogDescription>
              O preço do curso será alterado de{" "}
              <span className="font-medium text-foreground">
                {formatCurrencyInCents(course.priceInCents)}
              </span>{" "}
              para{" "}
              <span className="font-medium text-foreground">
                {pendingPriceChange
                  ? formatCurrencyInCents(pendingPriceChange.priceInCents)
                  : ""}
              </span>
              . Confirme para salvar a alteração.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingPriceChange(null)}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                const priceChange = pendingPriceChange;
                setPendingPriceChange(null);
                if (priceChange) {
                  saveCourseSettings(priceChange.formData);
                }
              }}
            >
              Confirmar alteração
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
