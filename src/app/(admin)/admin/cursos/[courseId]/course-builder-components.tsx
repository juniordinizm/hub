"use client";

import {
  Add01Icon,
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { Separator } from "@/components/ui/separator";
import { TableCell } from "@/components/ui/table";
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
      renderLesson={(lesson, _moduleData, index) => (
        <LessonRow courseId={course.id} index={index} lesson={lesson} />
      )}
      renderModule={(moduleData, moduleLessons, index) => (
        <ModuleSection
          course={course}
          index={index}
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
  index,
}: {
  course: CourseData;
  moduleData: ModuleData;
  moduleLessons: LessonData[];
  index: number;
}): React.JSX.Element {
  const nextLessonSortOrder =
    moduleLessons.length > 0
      ? Math.max(...moduleLessons.map((l) => l.sortOrder)) + 1
      : 1;

  return (
    <>
      <div className="flex flex-col gap-4 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-muted-foreground text-xs">Modulo {index + 1}</p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <h3 className="font-semibold">{moduleData.title}</h3>
            <Badge
              variant={moduleData.status === "active" ? "default" : "outline"}
            >
              {CONTENT_STATUS_LABELS[moduleData.status] ?? moduleData.status}
            </Badge>
          </div>
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
            description="Atualize os dados deste modulo."
            title="Editar modulo"
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
  index,
}: {
  courseId: string;
  lesson: LessonData;
  index: number;
}): React.JSX.Element {
  const hasVideo = Boolean(lesson.videoEmbedUrl || lesson.videoExternalId);
  const hasText = parseLessonContent(lesson.contentJson)?.type === "text";
  const hasAnyContent = hasVideo || hasText;

  return (
    <>
      <TableCell className="w-[80px] min-w-[80px] font-mono text-muted-foreground text-xs">
        Aula {index + 1}
      </TableCell>
      <TableCell className="w-[300px] min-w-[300px] max-w-[300px] truncate font-medium">
        {lesson.title}
      </TableCell>
      <TableCell className="w-[150px] min-w-[150px] text-center text-muted-foreground text-sm">
        {formatLessonDuration(lesson.durationSeconds)}
      </TableCell>
      <TableCell className="w-[200px] min-w-[200px]">
        <div className="flex items-center justify-center gap-2">
          {hasVideo ? <Badge variant="secondary">Video</Badge> : null}
          {hasText ? <Badge variant="secondary">Texto</Badge> : null}
          {hasAnyContent ? null : (
            <Badge variant="destructive">Sem conteudo</Badge>
          )}
        </div>
      </TableCell>
      <TableCell className="w-[180px] min-w-[180px]">
        <div className="flex justify-center">
          <Badge
            className="w-fit"
            variant={lesson.status === "active" ? "default" : "outline"}
          >
            {CONTENT_STATUS_LABELS[lesson.status] ?? lesson.status}
          </Badge>
        </div>
      </TableCell>
      <TableCell className="w-full" />
      <TableCell className="w-[100px] text-right">
        <Button asChild size="sm" variant="ghost">
          <Link href={route(`/admin/cursos/${courseId}/aulas/${lesson.id}`)}>
            <HugeiconsIcon icon={Edit01Icon} size={16} strokeWidth={2} />
            Editar
          </Link>
        </Button>
      </TableCell>
    </>
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

            <input
              defaultValue={moduleData?.sortOrder ?? nextSortOrder ?? 1}
              name="sortOrder"
              type="hidden"
            />
            <Field>
              <FieldLabel>Titulo</FieldLabel>
              <Input
                defaultValue={moduleData?.title ?? ""}
                name="title"
                required
              />
            </Field>
            <Field>
              <FieldLabel>Descricao</FieldLabel>
              <Textarea
                defaultValue={moduleData?.description ?? ""}
                name="description"
              />
            </Field>
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
            {moduleData ? "Salvar modulo" : "Criar modulo"}
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
      <input
        form={formId}
        name="isRequired"
        type="hidden"
        value={lesson.isRequired ? "on" : "false"}
      />
      <Field>
        <FieldLabel>Titulo da aula</FieldLabel>
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
        <Input
          defaultChecked={lesson.isRequired}
          disabled={lesson.coursePublicationStatus === "published"}
          form={formId}
          id="lesson-is-required"
          name="isRequired"
          type="checkbox"
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
            <FieldLabel>Titulo</FieldLabel>
            <Input name="title" required />
          </Field>
          <Field>
            <FieldLabel>Descricao</FieldLabel>
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
      title="Novo modulo"
      trigger={
        <DialogTriggerButton>
          <HugeiconsIcon icon={Add01Icon} size={18} strokeWidth={2} />
          Novo modulo
        </DialogTriggerButton>
      }
    >
      <ModuleForm course={course} nextSortOrder={nextModuleSortOrder} />
    </DiscardAwareDialog>
  );
}
