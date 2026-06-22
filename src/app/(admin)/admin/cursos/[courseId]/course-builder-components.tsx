"use client";

import {
  Add01Icon,
  Cancel01Icon,
  Delete02Icon,
  Edit01Icon,
  FloppyDiskIcon,
  PlayCircleIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import Link from "next/link";
import type React from "react";
import { AutoCloseDialogForm } from "@/components/auto-close-dialog-form";
import { CourseBuilderClient } from "@/components/course-builder-dnd";
import { DiscardAwareDialog } from "@/components/discard-aware-dialog";
import type { JmvstreamUploadAsset } from "@/components/jmvstream-upload-panel";
import { LessonKindControls } from "@/components/lesson-kind-controls";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTriggerButton,
} from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  createLessonDraftAction,
  deleteLessonAction,
  deleteModuleAction,
  saveLessonAction,
  saveModuleAction,
} from "@/features/admin/actions";
import type { getAdminManagementData } from "@/features/admin/server";
import { parseLessonContent } from "@/features/courses/lesson-content";
import { formatLessonDuration } from "@/features/videos/jmvstream";
import { route } from "@/lib/routes";

type AdminData = Awaited<ReturnType<typeof getAdminManagementData>>;
type CourseData = AdminData["courses"][number];
type ModuleData = AdminData["modules"][number];
type LessonData = AdminData["lessons"][number];

export function CourseBuilderWrapper({
  course,
  modules,
  lessons,
}: {
  course: CourseData;
  modules: ModuleData[];
  lessons: LessonData[];
}) {
  return (
    <CourseBuilderClient
      course={course}
      initialLessons={lessons}
      initialModules={modules}
      renderLesson={(lesson, _moduleData) => (
        <LessonRow courseId={course.id} lesson={lesson} />
      )}
      renderModule={(moduleData, moduleLessons) => (
        <ModuleSection
          course={course}
          moduleData={moduleData}
          moduleLessons={moduleLessons}
        />
      )}
    />
  );
}

export function ModuleSection({
  course,
  moduleData,
  moduleLessons,
}: {
  course: CourseData;
  moduleData: ModuleData;
  moduleLessons: LessonData[];
}): React.JSX.Element {
  const nextLessonSortOrder =
    moduleLessons.length > 0
      ? Math.max(...moduleLessons.map((l) => l.sortOrder)) + 1
      : 1;

  return (
    <>
      <div className="flex flex-col gap-4 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-muted-foreground text-xs">
            Módulo {moduleData.sortOrder}
          </p>
          <h3 className="font-semibold">{moduleData.title}</h3>
          {moduleData.description ? (
            <p className="mt-1 text-muted-foreground text-sm">
              {moduleData.description}
            </p>
          ) : null}
        </div>
        <div className="flex items-center gap-3">
          <DiscardAwareDialog
            className="sm:max-w-lg"
            description="Defina o basico da aula. Depois voce sera levado para a edicao completa."
            title="Nova aula"
            trigger={
              <DialogTriggerButton size="sm" variant="outline">
                <HugeiconsIcon icon={Add01Icon} size={16} strokeWidth={2} />
                Nova aula
              </DialogTriggerButton>
            }
          >
            <CreateLessonDraftForm
              moduleId={moduleData.id}
              nextSortOrder={nextLessonSortOrder}
            />
          </DiscardAwareDialog>
          <DiscardAwareDialog
            description="Atualize os dados deste módulo."
            title="Editar módulo"
            trigger={
              <DialogTriggerButton size="sm" variant="secondary">
                <HugeiconsIcon icon={Edit01Icon} size={16} strokeWidth={2} />
                Editar
              </DialogTriggerButton>
            }
          >
            <ModuleForm course={course} moduleData={moduleData} />
          </DiscardAwareDialog>
        </div>
      </div>
      <Separator />
    </>
  );
}

export function LessonRow({
  courseId,
  lesson,
}: {
  courseId: string;
  lesson: LessonData;
}): React.JSX.Element {
  const hasVideo = Boolean(lesson.videoEmbedUrl || lesson.videoExternalId);
  const hasText = parseLessonContent(lesson.contentJson)?.type === "text";
  const hasAnyContent = hasVideo || hasText;

  return (
    <div className="flex flex-col gap-3 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
      <div className="grid gap-3 lg:grid-cols-[80px_1fr_160px_110px] lg:items-center">
        <span className="font-mono text-muted-foreground text-xs">
          Aula {lesson.sortOrder}
        </span>
        <div>
          <p className="font-medium">{lesson.title}</p>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-muted-foreground text-xs">
            <span>{formatLessonDuration(lesson.durationSeconds)}</span>
            <span>·</span>
            {hasVideo ? <Badge variant="secondary">Video</Badge> : null}
            {hasText ? <Badge variant="secondary">Texto</Badge> : null}
            {hasAnyContent ? null : (
              <Badge variant="destructive">sem conteudo</Badge>
            )}
          </div>
        </div>
        <span className="truncate font-mono text-muted-foreground text-xs">
          {lesson.videoExternalId ?? "sem hash"}
        </span>
        <Badge
          className="w-fit"
          variant={lesson.isPublished ? "default" : "outline"}
        >
          {lesson.isPublished ? "publicada" : "rascunho"}
        </Badge>
      </div>
      <Button asChild size="sm" variant="ghost">
        <Link href={route(`/admin/cursos/${courseId}/aulas/${lesson.id}`)}>
          <HugeiconsIcon icon={Edit01Icon} size={16} strokeWidth={2} />
          Editar
        </Link>
      </Button>
    </div>
  );
}

export function ModuleForm({
  course,
  moduleData,
  nextSortOrder,
}: {
  course: CourseData;
  moduleData?: ModuleData;
  nextSortOrder?: number;
}): React.JSX.Element {
  return (
    <div className="flex flex-col gap-4">
      <AutoCloseDialogForm
        action={saveModuleAction}
        className="flex h-full min-h-0 flex-1 flex-col overflow-hidden"
      >
        <DialogBody>
          <FieldGroup>
            <input name="moduleId" type="hidden" value={moduleData?.id ?? ""} />
            <input name="courseId" type="hidden" value={course.id} />
            <div className="grid gap-4 lg:grid-cols-[1fr_160px]">
              <Field>
                <FieldLabel>Curso</FieldLabel>
                <Input disabled value={course.title} />
              </Field>
              <Field>
                <FieldLabel>Cor</FieldLabel>
                <Input
                  defaultValue={moduleData?.color ?? "#326c71"}
                  name="color"
                />
              </Field>
            </div>
            <input
              defaultValue={moduleData?.sortOrder ?? nextSortOrder ?? 1}
              name="sortOrder"
              type="hidden"
            />
            <Field>
              <FieldLabel>Título</FieldLabel>
              <Input
                defaultValue={moduleData?.title ?? ""}
                name="title"
                required
              />
            </Field>
            <Field>
              <FieldLabel>Descrição</FieldLabel>
              <Textarea
                defaultValue={moduleData?.description ?? ""}
                name="description"
              />
            </Field>
          </FieldGroup>
        </DialogBody>
        <DialogFooter className="sm:justify-between">
          <div className="flex items-center">
            {moduleData ? <DeleteModuleDialog moduleData={moduleData} /> : null}
          </div>
          <Button className="w-fit" type="submit">
            <HugeiconsIcon
              icon={moduleData ? FloppyDiskIcon : Add01Icon}
              size={18}
              strokeWidth={2}
            />
            {moduleData ? "Salvar módulo" : "Criar módulo"}
          </Button>
        </DialogFooter>
      </AutoCloseDialogForm>
    </div>
  );
}

export function LessonEditorForm({
  asset,
  lesson,
}: {
  asset?: JmvstreamUploadAsset | undefined;
  lesson: LessonData;
}): React.JSX.Element {
  const publishedFieldId = `lesson-is-published-${lesson.id}`;

  return (
    <div className="flex flex-col gap-4">
      <form
        action={saveLessonAction}
        className="flex h-full min-h-0 flex-1 flex-col overflow-hidden"
      >
        <DialogBody>
          <FieldGroup>
            <input name="lessonId" type="hidden" value={lesson.id} />
            <input name="moduleId" type="hidden" value={lesson.moduleId} />
            <Field>
              <FieldLabel>Título</FieldLabel>
              <Input defaultValue={lesson.title} name="title" required />
            </Field>
            <Field>
              <FieldLabel>Descrição</FieldLabel>
              <Textarea
                defaultValue={lesson.description ?? ""}
                name="description"
                required
              />
            </Field>
            <div className="mt-8 grid gap-8 border-border/50 border-t pt-8">
              <LessonKindControls
                asset={asset}
                defaultContentJson={lesson.contentJson}
                defaultDurationSeconds={lesson.durationSeconds}
                defaultEmbedUrl={lesson.videoEmbedUrl ?? ""}
                defaultOrder={lesson.sortOrder}
                lessonId={lesson.id}
              />
            </div>
          </FieldGroup>
        </DialogBody>
        <DialogFooter className="sm:justify-between">
          <div className="flex items-center gap-4">
            <label
              className="inline-flex cursor-pointer items-center gap-2 font-medium text-sm"
              htmlFor={publishedFieldId}
            >
              <Checkbox
                defaultChecked={lesson.isPublished}
                id={publishedFieldId}
                name="isPublished"
              />
              Publicada
            </label>
            <DeleteLessonDialog lesson={lesson} />
          </div>
          <Button type="submit">
            <HugeiconsIcon icon={FloppyDiskIcon} size={18} strokeWidth={2} />
            Salvar aula
          </Button>
        </DialogFooter>
      </form>
    </div>
  );
}

export function CreateLessonDraftForm({
  moduleId,
  nextSortOrder,
}: {
  moduleId: string;
  nextSortOrder: number;
}): React.JSX.Element {
  return (
    <AutoCloseDialogForm
      action={createLessonDraftAction}
      className="flex h-full min-h-0 flex-1 flex-col overflow-hidden"
    >
      <DialogBody>
        <FieldGroup>
          <input name="moduleId" type="hidden" value={moduleId} />
          <input name="sortOrder" type="hidden" value={nextSortOrder} />
          <Field>
            <FieldLabel>Título</FieldLabel>
            <Input name="title" required />
          </Field>
          <Field>
            <FieldLabel>Descrição</FieldLabel>
            <Textarea name="description" required />
          </Field>
        </FieldGroup>
      </DialogBody>
      <DialogFooter>
        <Button type="submit">
          <HugeiconsIcon icon={Add01Icon} size={18} strokeWidth={2} />
          Criar e editar
        </Button>
      </DialogFooter>
    </AutoCloseDialogForm>
  );
}

export function DeleteModuleDialog({
  moduleData,
}: {
  moduleData: ModuleData;
}): React.JSX.Element {
  return (
    <Dialog>
      <DialogTriggerButton size="sm" type="button" variant="destructive">
        <HugeiconsIcon icon={Delete02Icon} size={16} strokeWidth={2} />
        Excluir módulo
      </DialogTriggerButton>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Excluir módulo?</DialogTitle>
          <DialogDescription>
            Esta ação remove o módulo e, em cascata, todas as aulas e progressos
            vinculados a elas.
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          <DeleteSummary
            detail={`Módulo ${moduleData.sortOrder}`}
            title={moduleData.title}
          />
        </DialogBody>
        <AutoCloseDialogForm action={deleteModuleAction}>
          <DialogFooter className="mt-2">
            <DialogClose asChild>
              <Button type="button" variant="outline">
                <HugeiconsIcon icon={Cancel01Icon} size={16} strokeWidth={2} />
                Cancelar
              </Button>
            </DialogClose>
            <input name="moduleId" type="hidden" value={moduleData.id} />
            <Button type="submit" variant="destructive">
              <HugeiconsIcon icon={Delete02Icon} size={16} strokeWidth={2} />
              Confirmar exclusão
            </Button>
          </DialogFooter>
        </AutoCloseDialogForm>
      </DialogContent>
    </Dialog>
  );
}

export function DeleteLessonDialog({
  lesson,
}: {
  lesson: LessonData;
}): React.JSX.Element {
  return (
    <Dialog>
      <DialogTriggerButton size="sm" type="button" variant="destructive">
        <HugeiconsIcon icon={Delete02Icon} size={16} strokeWidth={2} />
        Excluir aula
      </DialogTriggerButton>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Excluir aula?</DialogTitle>
          <DialogDescription>
            Esta ação remove a aula e, em cascata, os progressos vinculados a
            ela.
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          <DeleteSummary
            detail={`Aula ${lesson.sortOrder}`}
            title={lesson.title}
          />
        </DialogBody>
        <AutoCloseDialogForm action={deleteLessonAction}>
          <DialogFooter className="mt-2">
            <DialogClose asChild>
              <Button type="button" variant="outline">
                <HugeiconsIcon icon={Cancel01Icon} size={16} strokeWidth={2} />
                Cancelar
              </Button>
            </DialogClose>
            <input name="lessonId" type="hidden" value={lesson.id} />
            <Button type="submit" variant="destructive">
              <HugeiconsIcon icon={Delete02Icon} size={16} strokeWidth={2} />
              Confirmar exclusão
            </Button>
          </DialogFooter>
        </AutoCloseDialogForm>
      </DialogContent>
    </Dialog>
  );
}

export function DeleteSummary({
  detail,
  title,
}: {
  detail: string;
  title: string;
}): React.JSX.Element {
  return (
    <div className="rounded-lg border bg-background/40 p-3">
      <p className="font-semibold">{title}</p>
      <p className="text-muted-foreground text-sm">{detail}</p>
    </div>
  );
}

export function InfoRow({
  label,
  value,
}: {
  label: string;
  value: string;
}): React.JSX.Element {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}

export function InfoTile({
  label,
  value,
}: {
  label: string;
  value: string;
}): React.JSX.Element {
  return (
    <div className="rounded-lg border bg-background/35 p-4">
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="mt-1 break-words font-medium text-sm">{value}</p>
    </div>
  );
}

export function CourseMetricCard({
  helper,
  icon: Icon,
  label,
  value,
}: {
  helper: string;
  // biome-ignore lint/suspicious/noExplicitAny: type from hugeicons
  icon?: any;
  label: string;
  value: string;
}): React.JSX.Element {
  return (
    <div className="flex flex-col gap-1 rounded-xl border bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <p className="font-medium text-muted-foreground text-sm tracking-tight">
          {label}
        </p>
        {Icon && (
          <div className="flex size-7 items-center justify-center rounded-md bg-muted/50 text-muted-foreground">
            {/* biome-ignore lint/suspicious/noExplicitAny: dynamic icon prop */}
            <HugeiconsIcon icon={Icon as any} size={16} />
          </div>
        )}
      </div>
      <div>
        <p className="font-bold text-2xl">{value}</p>
        <p className="text-muted-foreground text-xs">{helper}</p>
      </div>
    </div>
  );
}

export function ContentStatusCard({
  label,
  value,
}: {
  label: string;
  value: string;
}): React.JSX.Element {
  return (
    <div className="flex items-center gap-3 rounded-lg border bg-card p-4">
      <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
        <HugeiconsIcon icon={PlayCircleIcon} size={18} strokeWidth={2} />
      </div>
      <div>
        <p className="text-muted-foreground text-xs">{label}</p>
        <p className="font-semibold text-lg">{value}</p>
      </div>
    </div>
  );
}

export function CreateModuleDialog({
  course,
  nextModuleSortOrder,
}: {
  course: CourseData;
  nextModuleSortOrder: number;
}): React.JSX.Element {
  return (
    <DiscardAwareDialog
      className="sm:max-w-3xl"
      description="Adicione uma unidade ao curso."
      title="Novo módulo"
      trigger={
        <DialogTriggerButton>
          <HugeiconsIcon icon={Add01Icon} size={18} strokeWidth={2} />
          Novo módulo
        </DialogTriggerButton>
      }
    >
      <ModuleForm course={course} nextSortOrder={nextModuleSortOrder} />
    </DiscardAwareDialog>
  );
}
