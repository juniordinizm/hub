"use client";

import { FloppyDiskIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useTransition } from "react";
import { toast } from "sonner";
import { CourseCoverUploadField } from "@/components/course-cover-upload-field";
import { Button } from "@/components/ui/button";
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
import { formatCurrencyInCents } from "@/lib/formatters";

export interface CourseData {
  accessDurationMonths: number;
  coverImage?: unknown;
  description: string | null;
  id: string;
  paymentProviderProductId: string | null;
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
              <FieldLabel>Preco do curso</FieldLabel>
              <Input
                defaultValue={formatCurrencyInCents(course.priceInCents)}
                disabled
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
