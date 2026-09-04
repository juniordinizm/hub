"use client";

import {
  Add01Icon,
  ArrowDown01Icon,
  Edit01Icon,
  FloppyDiskIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import Link from "next/link";
import type React from "react";
import { AutoCloseDialogForm } from "@/components/auto-close-dialog-form";
import { CourseBuilderClient } from "@/components/course-builder-dnd";
import { DiscardAwareDialog } from "@/components/discard-aware-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DialogBody,
  DialogFooter,
  DialogTriggerButton,
} from "@/components/ui/dialog";
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
import {
  createLessonDraftAction,
  saveModuleAction,
} from "@/features/admin/actions";
import type {
  AdminCourse,
  AdminLesson,
  AdminModule,
} from "@/features/admin/server";
import { parseLessonContent } from "@/features/courses/lesson-content";
import { formatLessonDuration } from "@/features/videos/jmvstream";
import { route } from "@/lib/routes";

type CourseData = AdminCourse;
type ModuleData = AdminModule;
type LessonData = AdminLesson;

const CONTENT_STATUS_LABELS: Record<string, string> = {
  active: "publicado",
  archived: "arquivado",
  draft: "rascunho",
};

export function CourseBuilderWrapper({
  course,
  editable,
  modules,
  lessons,
}: {
  course: CourseData;
  editable: boolean;
  modules: ModuleData[];
  lessons: LessonData[];
}) {
  return (
    <CourseBuilderClient
      course={course}
      editable={editable}
      initialLessons={lessons}
      initialModules={modules}
      renderLesson={(lesson, _moduleData, index) => (
        <LessonRow
          courseId={course.id}
          editable={editable}
          index={index}
          lesson={lesson}
        />
      )}
      renderModule={(moduleData, moduleLessons, index, disclosure) => (
        <ModuleSection
          contentId={disclosure.contentId}
          course={course}
          editable={editable}
          expanded={disclosure.expanded}
          index={index}
          moduleData={moduleData}
          moduleLessons={moduleLessons}
          onToggle={disclosure.onToggle}
        />
      )}
    />
  );
}

export function ModuleSection({
  contentId,
  course,
  editable,
  expanded,
  moduleData,
  moduleLessons,
  onToggle,
  index: _index,
}: {
  contentId: string;
  course: CourseData;
  editable: boolean;
  expanded: boolean;
  index?: number;
  moduleData: ModuleData;
  moduleLessons: LessonData[];
  onToggle: () => void;
}): React.JSX.Element {
  const nextLessonSortOrder =
    moduleLessons.length > 0
      ? Math.max(...moduleLessons.map((l) => l.sortOrder)) + 1
      : 1;
  const lessonCount = moduleLessons.length;
  const totalDuration = moduleLessons.reduce(
    (total, lesson) => total + lesson.durationSeconds,
    0
  );

  return (
    <div className="flex min-w-0 flex-col gap-4 px-4 py-4 md:flex-row md:items-center md:justify-between md:px-5">
      <div className="flex min-w-0 items-start gap-2.5">
        <Button
          aria-controls={contentId}
          aria-expanded={expanded}
          aria-label={`${expanded ? "Recolher" : "Expandir"} módulo ${moduleData.title}`}
          className="mt-0.5 shrink-0"
          onClick={onToggle}
          size="icon-sm"
          type="button"
          variant="ghost"
        >
          <HugeiconsIcon
            className={expanded ? "rotate-0" : "-rotate-90"}
            icon={ArrowDown01Icon}
            size={16}
            strokeWidth={2}
          />
        </Button>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="min-w-0 break-words font-semibold leading-snug">
              {moduleData.title}
            </h3>
            <Badge
              variant={moduleData.status === "active" ? "default" : "outline"}
            >
              {CONTENT_STATUS_LABELS[moduleData.status] ?? moduleData.status}
            </Badge>
            <Badge variant="outline">
              {moduleData.releaseDelayDays === 0
                ? "Liberação imediata"
                : `Liberação em D+${moduleData.releaseDelayDays}`}
            </Badge>
          </div>
          <p className="mt-1 text-muted-foreground text-sm">
            {lessonCount} {lessonCount === 1 ? "aula" : "aulas"} ·{" "}
            {formatLessonDuration(totalDuration)}
          </p>
        </div>
      </div>
      {editable ? (
        <div className="flex shrink-0 items-center gap-2 pl-10 md:pl-0">
          <DiscardAwareDialog
            className="sm:max-w-lg"
            description="Defina o básico da aula. Depois você será levado para a edição completa."
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
              <DialogTriggerButton size="sm" variant="ghost">
                <HugeiconsIcon icon={Edit01Icon} size={16} strokeWidth={2} />
                Editar
              </DialogTriggerButton>
            }
          >
            <ModuleForm course={course} moduleData={moduleData} />
          </DiscardAwareDialog>
        </div>
      ) : null}
    </div>
  );
}

export function LessonRow({
  courseId,
  editable,
  lesson,
  index,
}: {
  courseId: string;
  editable: boolean;
  lesson: LessonData;
  index: number;
}): React.JSX.Element {
  const hasVideo = Boolean(lesson.videoEmbedUrl || lesson.videoExternalId);
  const hasText = parseLessonContent(lesson.contentJson)?.type === "text";
  const hasAnyContent = hasVideo || hasText;
  let contentLabel = "Texto";
  if (hasVideo && hasText) {
    contentLabel = "Vídeo + texto";
  } else if (hasVideo) {
    contentLabel = "Vídeo";
  }

  return (
    <div className="grid min-w-0 gap-3 px-4 py-3 md:grid-cols-[minmax(0,1fr)_auto_auto] md:items-center md:px-5">
      <div className="min-w-0">
        <p className="font-mono text-muted-foreground text-xs">
          Aula {index + 1}
        </p>
        <p className="mt-0.5 line-clamp-2 break-words font-medium leading-snug">
          {lesson.title}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-muted-foreground text-xs md:hidden">
          <span>{formatLessonDuration(lesson.durationSeconds)}</span>
          <span aria-hidden="true">·</span>
          <span>{lesson.isRequired ? "Obrigatória" : "Opcional"}</span>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 md:justify-end">
        {hasAnyContent ? (
          <Badge variant="secondary">{contentLabel}</Badge>
        ) : (
          <Badge variant="destructive">Sem conteúdo</Badge>
        )}
        <Badge variant={lesson.status === "active" ? "default" : "outline"}>
          {CONTENT_STATUS_LABELS[lesson.status] ?? lesson.status}
        </Badge>
        <div className="hidden items-center gap-2 text-muted-foreground text-xs md:flex">
          <span>{formatLessonDuration(lesson.durationSeconds)}</span>
          <span aria-hidden="true">·</span>
          <span>{lesson.isRequired ? "Obrigatória" : "Opcional"}</span>
        </div>
      </div>
      {editable ? (
        <Button
          asChild
          className="w-fit md:justify-self-end"
          size="sm"
          variant="ghost"
        >
          <Link href={route(`/admin/cursos/${courseId}/aulas/${lesson.id}`)}>
            <HugeiconsIcon icon={Edit01Icon} size={16} strokeWidth={2} />
            Editar
          </Link>
        </Button>
      ) : null}
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
  const releaseDelayDaysId = moduleData
    ? `module-${moduleData.id}-release-delay-days`
    : "new-module-release-delay-days";

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
            <fieldset className="space-y-3">
              <legend className="font-medium text-sm">
                Liberação do conteúdo
              </legend>
              <label className="flex items-center gap-2 text-sm">
                <input
                  defaultChecked={(moduleData?.releaseDelayDays ?? 0) === 0}
                  name="releaseMode"
                  type="radio"
                  value="immediate"
                />
                Imediatamente
              </label>
              <div className="flex items-center gap-2 text-sm">
                <label className="flex items-center gap-2">
                  <input
                    defaultChecked={(moduleData?.releaseDelayDays ?? 0) > 0}
                    name="releaseMode"
                    type="radio"
                    value="delayed"
                  />
                  Após
                </label>
                <label className="sr-only" htmlFor={releaseDelayDaysId}>
                  Dias para liberar o módulo
                </label>
                <Input
                  className="w-24"
                  defaultValue={moduleData?.releaseDelayDays || 8}
                  id={releaseDelayDaysId}
                  min={1}
                  name="releaseDelayDays"
                  step={1}
                  type="number"
                />
                dias
              </div>
              <p className="text-muted-foreground text-xs">
                Cada dia equivale a 24 horas desde o início do acesso da Aluna.
              </p>
            </fieldset>
            {moduleData ? (
              <Field>
                <FieldLabel>Status</FieldLabel>
                <Select
                  defaultValue={moduleData.status ?? "draft"}
                  name="status"
                >
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
            ) : null}
          </FieldGroup>
        </DialogBody>
        <DialogFooter>
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

export function LessonEditorSidebarFields({
  formId,
  lesson,
}: {
  formId: string;
  lesson: LessonData;
}): React.JSX.Element {
  return (
    <FieldGroup>
      <input form={formId} name="lessonId" type="hidden" value={lesson.id} />
      <input
        form={formId}
        name="moduleId"
        type="hidden"
        value={lesson.moduleId}
      />
      <input form={formId} name="isRequired" type="hidden" value="false" />
      <Field>
        <FieldLabel>Título da aula</FieldLabel>
        <Input
          defaultValue={lesson.title}
          form={formId}
          name="title"
          required
        />
      </Field>
      <Field>
        <FieldLabel>Descrição (opcional)</FieldLabel>
        <Textarea
          className="resize-none"
          defaultValue={lesson.description ?? ""}
          form={formId}
          name="description"
          rows={4}
        />
      </Field>
      <Field orientation="horizontal">
        <Checkbox
          defaultChecked={lesson.isRequired}
          disabled={lesson.coursePublicationStatus === "published"}
          form={formId}
          id="lesson-is-required"
          name="isRequired"
          value="on"
        />
        <FieldLabel htmlFor="lesson-is-required">
          Aula obrigatória para conclusão do curso
        </FieldLabel>
      </Field>
    </FieldGroup>
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
            <FieldLabel>Descrição (opcional)</FieldLabel>
            <Textarea name="description" />
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

export function CreateModuleDialog({
  course,
  nextModuleSortOrder,
  triggerLabel = "Novo módulo",
  triggerVariant = "default",
}: {
  course: CourseData;
  nextModuleSortOrder: number;
  triggerLabel?: string;
  triggerVariant?: React.ComponentProps<typeof DialogTriggerButton>["variant"];
}): React.JSX.Element {
  return (
    <DiscardAwareDialog
      className="sm:max-w-3xl"
      description="Adicione uma unidade ao Curso."
      title="Novo módulo"
      trigger={
        <DialogTriggerButton variant={triggerVariant}>
          <HugeiconsIcon icon={Add01Icon} size={18} strokeWidth={2} />
          {triggerLabel}
        </DialogTriggerButton>
      }
    >
      <ModuleForm course={course} nextSortOrder={nextModuleSortOrder} />
    </DiscardAwareDialog>
  );
}
