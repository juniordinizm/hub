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
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { saveCourseAction } from "@/features/admin/actions";
import {
  getEffectiveMaxInstallmentCount,
  MAX_INSTALLMENT_COUNT,
  MIN_INSTALLMENT_COUNT,
} from "@/features/payments/course-payment-offer";
import { parseCoursePriceToCents } from "@/features/payments/course-price";
import { formatCurrencyInCents } from "@/lib/formatters";
import { CourseWorkloadDialog } from "./course-workload-dialog";

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

const INSTALLMENT_OPTIONS = Array.from(
  { length: MAX_INSTALLMENT_COUNT },
  (_, index) => index + MIN_INSTALLMENT_COUNT
);

export function CourseSettingsForm({
  course,
}: {
  course: CourseData;
}): React.JSX.Element {
  const [isPending, startTransition] = useTransition();
  const [pendingPriceChange, setPendingPriceChange] =
    useState<PendingPriceChange | null>(null);
  const [priceValue, setPriceValue] = useState(() =>
    formatCurrencyInCents(course.priceInCents)
  );
  const [workloadHoursOverride, setWorkloadHoursOverride] = useState(
    course.workloadHoursOverride?.toString() ?? ""
  );
  const [paymentAllowPix, setPaymentAllowPix] = useState(
    course.paymentAllowPix
  );
  const [paymentAllowCreditCard, setPaymentAllowCreditCard] = useState(
    course.paymentAllowCreditCard
  );
  const [paymentMaxInstallmentCount, setPaymentMaxInstallmentCount] = useState(
    course.paymentMaxInstallmentCount.toString()
  );
  const manualWorkloadHours = workloadHoursOverride
    ? Number(workloadHoursOverride)
    : null;
  const configuredInstallmentCount = Number(paymentMaxInstallmentCount);
  const validInstallmentCount = Number.isFinite(configuredInstallmentCount)
    ? configuredInstallmentCount
    : MIN_INSTALLMENT_COUNT;
  const priceInCentsForInstallments = (() => {
    try {
      return parseCoursePriceToCents(priceValue);
    } catch {
      return course.priceInCents;
    }
  })();
  const maxInstallmentsAllowedByPrice = getEffectiveMaxInstallmentCount({
    configuredMaxInstallmentCount: MAX_INSTALLMENT_COUNT,
    priceInCents: priceInCentsForInstallments,
  });
  const effectiveMaxInstallmentCount = Math.min(
    validInstallmentCount,
    maxInstallmentsAllowedByPrice
  );

  const saveCourseSettings = (formData: FormData): void => {
    const toastId = toast.loading("Salvando configurações…");

    startTransition(async () => {
      try {
        await saveCourseAction(formData);
        toast.success("Configurações salvas com sucesso!", { id: toastId });
      } catch {
        toast.error("Não foi possível salvar o curso.", { id: toastId });
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
      <form className="flex flex-col gap-8" onSubmit={handleSubmit}>
        <fieldset className="contents" disabled={isPending}>
          <input name="courseId" type="hidden" value={course.id} />
          <input
            name="workloadHoursOverride"
            type="hidden"
            value={workloadHoursOverride}
          />

          <div className="flex flex-col gap-8">
            <section className="space-y-5">
              <h3 className="font-medium text-base">Identidade do curso</h3>
              <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)] lg:items-start">
                <Field>
                  <CourseCoverUploadField
                    aggregateId={course.id}
                    defaultCoverImage={course.coverImage}
                    defaultThumbnailUrl={course.thumbnailUrl}
                  />
                </Field>
                <div className="grid gap-5">
                  <Field>
                    <FieldLabel htmlFor="course-settings-title">
                      Título
                    </FieldLabel>
                    <Input
                      defaultValue={course.title}
                      id="course-settings-title"
                      name="title"
                      required
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="course-settings-subtitle">
                      Subtítulo
                    </FieldLabel>
                    <Input
                      defaultValue={course.subtitle ?? ""}
                      id="course-settings-subtitle"
                      name="subtitle"
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="course-settings-description">
                      Descrição
                    </FieldLabel>
                    <Textarea
                      className="min-h-24 resize-y"
                      defaultValue={course.description ?? ""}
                      id="course-settings-description"
                      name="description"
                    />
                  </Field>
                </div>
              </div>
            </section>

            <Separator />

            <section className="space-y-5">
              <h3 className="font-medium text-base">Acesso e publicação</h3>
              <div className="grid max-w-2xl gap-5 md:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="course-settings-workload">
                    Carga horária
                  </FieldLabel>
                  <CourseWorkloadDialog
                    calculatedHours={course.workloadHours}
                    compact
                    onValueChange={(value) => {
                      setWorkloadHoursOverride(value?.toString() ?? "");
                    }}
                    triggerId="course-settings-workload"
                    value={manualWorkloadHours}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="course-settings-access-duration">
                    Meses de acesso
                  </FieldLabel>
                  <Input
                    defaultValue={course.accessDurationMonths ?? 12}
                    id="course-settings-access-duration"
                    min={1}
                    name="accessDurationMonths"
                    type="number"
                  />
                </Field>
              </div>
            </section>

            <Separator />

            <section className="space-y-5">
              <h3 className="font-medium text-base">Oferta de pagamento</h3>
              <input name="paymentOfferPresent" type="hidden" value="on" />
              <Field className="max-w-sm">
                <FieldLabel htmlFor="course-settings-price">
                  Preço do curso
                </FieldLabel>
                <Input
                  id="course-settings-price"
                  inputMode="decimal"
                  name="price"
                  onChange={(event) => {
                    setPriceValue(event.currentTarget.value);
                  }}
                  required
                  value={priceValue}
                />
              </Field>
              <FieldSet className="max-w-2xl gap-3">
                <FieldLegend variant="label">Formas de pagamento</FieldLegend>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field orientation="horizontal">
                    <Checkbox
                      checked={paymentAllowPix}
                      disabled={!paymentAllowCreditCard}
                      id="course-payment-pix"
                      name="paymentAllowPix"
                      onCheckedChange={(checked) => {
                        if (checked === false && !paymentAllowCreditCard) {
                          return;
                        }
                        setPaymentAllowPix(checked === true);
                      }}
                    />
                    <FieldLabel htmlFor="course-payment-pix">
                      Aceitar Pix
                    </FieldLabel>
                  </Field>
                  <Field orientation="horizontal">
                    <Checkbox
                      checked={paymentAllowCreditCard}
                      disabled={!paymentAllowPix}
                      id="course-payment-card"
                      name="paymentAllowCreditCard"
                      onCheckedChange={(checked) => {
                        if (checked === false && !paymentAllowPix) {
                          return;
                        }
                        setPaymentAllowCreditCard(checked === true);
                      }}
                    />
                    <FieldLabel htmlFor="course-payment-card">
                      Aceitar cartão
                    </FieldLabel>
                  </Field>
                </div>
              </FieldSet>
              <Field className="max-w-sm">
                <FieldLabel htmlFor="course-payment-installments">
                  Máximo de parcelas
                </FieldLabel>
                <Select
                  disabled={!paymentAllowCreditCard}
                  name="paymentMaxInstallmentCount"
                  onValueChange={setPaymentMaxInstallmentCount}
                  required={paymentAllowCreditCard}
                  value={paymentMaxInstallmentCount}
                >
                  <SelectTrigger id="course-payment-installments">
                    <SelectValue placeholder="Selecione o limite" />
                  </SelectTrigger>
                  <SelectContent>
                    {INSTALLMENT_OPTIONS.map((installmentCount) => (
                      <SelectItem
                        disabled={
                          installmentCount > maxInstallmentsAllowedByPrice
                        }
                        key={installmentCount}
                        value={installmentCount.toString()}
                      >
                        {installmentCount}x
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FieldDescription>
                  {paymentAllowCreditCard
                    ? `O preço atual permite até ${maxInstallmentsAllowedByPrice}x por causa do valor mínimo por parcela.`
                    : "Ative o cartão para configurar o limite de parcelas."}
                </FieldDescription>
              </Field>
              <p className="max-w-2xl text-muted-foreground text-sm">
                O Checkout Asaas aplica estas opções somente às novas compras.
                Taxas e recebimento seguem o contrato da conta Asaas.
              </p>
              {paymentAllowCreditCard &&
              effectiveMaxInstallmentCount < validInstallmentCount ? (
                <p className="max-w-2xl text-amber-700 text-sm">
                  Pelo preço atual, o Checkout será limitado a{" "}
                  {effectiveMaxInstallmentCount}x. A configuração de{" "}
                  {validInstallmentCount}x continua salva para futuros reajustes
                  de preço.
                </p>
              ) : null}
            </section>
          </div>

          <div className="flex justify-end border-t pt-6">
            <Button disabled={isPending} type="submit">
              <HugeiconsIcon icon={FloppyDiskIcon} size={18} strokeWidth={2} />
              {isPending ? "Salvando…" : "Salvar configurações"}
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
