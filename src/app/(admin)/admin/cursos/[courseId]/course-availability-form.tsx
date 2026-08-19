"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { DatePickerField } from "@/components/date-picker-field";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  archiveCourseAction,
  restoreCourseAction,
  saveCourseAvailabilityAction,
} from "@/features/admin/course-availability-actions";
import type { AdminCourse } from "@/features/admin/server";
import {
  type CourseAvailabilityPreset,
  getCourseAvailabilityOptions,
  resolveCourseAvailability,
} from "@/features/courses/availability";

type AvailabilityCourse = Pick<
  AdminCourse,
  | "catalogVisibility"
  | "hasCommercialHistory"
  | "id"
  | "interestCount"
  | "interestNotificationsSent"
  | "launchDate"
  | "launchLandingUrl"
  | "pendingCheckoutCancellations"
  | "pendingInterestNotifications"
  | "salesStatus"
  | "status"
>;

const getPreset = (course: AvailabilityCourse) =>
  resolveCourseAvailability({
    catalogVisibility: course.catalogVisibility,
    deliveryStatus: course.status as "active" | "archived" | "draft",
    salesStatus: course.salesStatus,
  }).preset;

export function CourseAvailabilityForm({
  course,
}: {
  course: AvailabilityCourse;
}): React.JSX.Element {
  const initialPreset = getPreset(course);
  const [preset, setPreset] = useState<CourseAvailabilityPreset>(
    initialPreset === "archived" ? "draft" : initialPreset
  );
  const [showInCatalog, setShowInCatalog] = useState(
    course.catalogVisibility === "listed"
  );
  const [isPending, startTransition] = useTransition();
  const availabilityOptions = getCourseAvailabilityOptions({
    hasCommercialHistory: course.hasCommercialHistory,
  });

  if (initialPreset === "archived") {
    return (
      <div className="flex flex-col gap-4">
        <div>
          <h3 className="font-medium">Curso arquivado</h3>
          <p className="text-muted-foreground text-sm">
            O histórico foi preservado, mas conteúdo e acesso estão bloqueados.
          </p>
        </div>
        <Button
          disabled={isPending}
          onClick={() => {
            startTransition(async () => {
              await restoreCourseAction(course.id);
              toast.success("Curso restaurado com vendas pausadas.");
            });
          }}
          type="button"
          variant="outline"
        >
          Restaurar curso
        </Button>
      </div>
    );
  }

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        startTransition(async () => {
          const result = await saveCourseAvailabilityAction(formData);
          if (!result.ok) {
            toast.error(result.message);
            return;
          }
          toast.success(
            result.notificationsEnqueued > 0
              ? `${result.notificationsEnqueued} avisos enfileirados.`
              : "Disponibilidade atualizada."
          );
        });
      }}
    >
      <input name="courseId" type="hidden" value={course.id} />
      <Field>
        <FieldLabel htmlFor="course-availability-preset">
          Disponibilidade
        </FieldLabel>
        <Select
          name="preset"
          onValueChange={(value) =>
            setPreset(value as CourseAvailabilityPreset)
          }
          value={preset}
        >
          <SelectTrigger id="course-availability-preset">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {availabilityOptions.map((option) => (
              <SelectItem
                disabled={option.disabled}
                key={option.value}
                value={option.value}
              >
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <FieldDescription className="text-xs">
          Atual:{" "}
          {availabilityOptions.find((option) => option.value === preset)?.label}
        </FieldDescription>
        {course.hasCommercialHistory ? (
          <FieldDescription className="text-xs">
            Rascunho e Em breve estão indisponíveis porque este Curso já possui
            histórico comercial.
          </FieldDescription>
        ) : null}
      </Field>

      {preset === "coming_soon" || preset === "sales_paused" ? (
        <div
          className={
            preset === "coming_soon" ? "grid gap-4 sm:grid-cols-2" : "max-w-xl"
          }
        >
          {preset === "coming_soon" ? (
            <Field>
              <FieldLabel htmlFor="course-launch-date">
                Data prevista
              </FieldLabel>
              <DatePickerField
                defaultValue={course.launchDate ?? ""}
                id="course-launch-date"
                name="launchDate"
                placeholder="Definir data prevista"
              />
              <FieldDescription className="text-xs">
                Definir data prevista é opcional.
              </FieldDescription>
            </Field>
          ) : null}
          <Field>
            <FieldLabel htmlFor="course-launch-landing">
              Landing externa
            </FieldLabel>
            <Input
              defaultValue={course.launchLandingUrl ?? ""}
              id="course-launch-landing"
              name="launchLandingUrl"
              placeholder="https://..."
              type="url"
            />
          </Field>
        </div>
      ) : null}

      {preset === "sales_paused" ? (
        <Field orientation="horizontal">
          <Switch
            checked={showInCatalog}
            id="course-show-in-catalog"
            onCheckedChange={setShowInCatalog}
          />
          <div>
            <FieldLabel htmlFor="course-show-in-catalog">
              Exibir na vitrine
            </FieldLabel>
          </div>
          {showInCatalog ? (
            <input name="showInCatalog" type="hidden" value="on" />
          ) : null}
        </Field>
      ) : null}

      {course.interestCount > 0 ||
      course.pendingInterestNotifications > 0 ||
      course.interestNotificationsSent > 0 ||
      course.pendingCheckoutCancellations > 0 ? (
        <p className="text-muted-foreground text-xs">
          {course.interestCount} interessadas ·{" "}
          {course.pendingInterestNotifications} avisos pendentes ·{" "}
          {course.interestNotificationsSent} enviados ·{" "}
          {course.pendingCheckoutCancellations} cancelamento pendente
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button disabled={isPending} size="sm" type="submit">
          Salvar disponibilidade
        </Button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              disabled={isPending}
              size="sm"
              type="button"
              variant="destructive"
            >
              Arquivar curso
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Arquivar este Curso?</AlertDialogTitle>
              <AlertDialogDescription>
                O Curso sairá da vitrine, as vendas serão fechadas e todas as
                alunas perderão acesso até uma restauração.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  startTransition(async () => {
                    await archiveCourseAction(course.id);
                    toast.success("Curso arquivado.");
                  });
                }}
                variant="destructive"
              >
                Arquivar curso
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </form>
  );
}
