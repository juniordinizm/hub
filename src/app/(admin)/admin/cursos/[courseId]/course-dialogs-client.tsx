"use client";

import { FloppyDiskIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useTransition } from "react";
import { toast } from "sonner";
import { CourseCoverUploadField } from "@/components/course-cover-upload-field";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
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
import { formatCurrencyInCents } from "@/lib/formatters";

export interface CourseData {
  accessDurationMonths: number;
  coverImage?: unknown;
  description: string | null;
  id: string;
  paymentAllowCreditCard: boolean;
  paymentAllowPix: boolean;
  paymentCardPricingPolicy:
    | "buyer_pays_incremental_installment_cost"
    | "seller_absorbs_all";
  paymentMaxInstallmentCount: number;
  priceInCents: number;
  slug: string;
  status: string;
  subtitle: string | null;
  thumbnailUrl: string | null;
  title: string;
  workloadHours: number;
}

export function CourseSettingsForm({
  course,
}: {
  course: CourseData;
}): React.JSX.Element {
  const [isPending, startTransition] = useTransition();
  const effectiveMaxInstallmentCount = getEffectiveMaxInstallmentCount({
    configuredMaxInstallmentCount: course.paymentMaxInstallmentCount,
    priceInCents: course.priceInCents,
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
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

  return (
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
              <Field className="md:col-span-3">
                <FieldLabel htmlFor="course-payment-pricing-policy">
                  Custo do parcelamento
                </FieldLabel>
                <Select
                  defaultValue={course.paymentCardPricingPolicy}
                  name="paymentCardPricingPolicy"
                >
                  <SelectTrigger id="course-payment-pricing-policy">
                    <SelectValue placeholder="Selecione a politica" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="buyer_pays_incremental_installment_cost">
                      Cliente paga somente o acrescimo das parcelas
                    </SelectItem>
                    <SelectItem value="seller_absorbs_all">
                      Parcelamento sem acrescimo
                    </SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <p className="mt-3 text-muted-foreground text-xs">
              1x permanece sem acrescimo. Nas demais parcelas, o Hub le as taxas
              atuais da conta Asaas automaticamente e fixa o total antes de
              enviar a compradora para a Fatura hospedada. Escolha Cliente paga
              somente o acrescimo das parcelas ou Parcelamento sem acrescimo.
            </p>
            {course.paymentAllowCreditCard &&
            course.paymentCardPricingPolicy === "seller_absorbs_all" &&
            effectiveMaxInstallmentCount < course.paymentMaxInstallmentCount ? (
              <p className="mt-2 text-amber-700 text-xs">
                Pelo preco atual, o Checkout sera limitado a{" "}
                {effectiveMaxInstallmentCount}x. A configuracao de{" "}
                {course.paymentMaxInstallmentCount}x continua salva para futuros
                reajustes de preco.
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
  );
}
