import { Badge } from "@/components/ui/badge";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import type { AdminCourseContentSignal } from "@/features/admin/presentation";
import type {
  AdminCourse,
  AdminLesson,
  AdminModule,
} from "@/features/admin/server";
import {
  CourseBuilderWrapper,
  CreateModuleDialog,
} from "./course-builder-components";
import { CoursePublicationAction } from "./course-publication-action";

interface CoursePublicationState {
  hasDraft: boolean;
  hasPublished: boolean;
}

interface CourseContentPanelProps {
  contentSignal: AdminCourseContentSignal;
  course: AdminCourse;
  lessons: AdminLesson[];
  modules: AdminModule[];
  nextModuleSortOrder: number;
  publicationState: CoursePublicationState;
}

const CONTENT_SIGNAL_VARIANTS = {
  attention: "destructive",
  healthy: "secondary",
  watch: "outline",
} as const;

const getPublicationLabel = ({
  hasDraft,
  hasPublished,
}: CoursePublicationState): string => {
  if (hasDraft) {
    return "Alterações em preparo";
  }

  if (hasPublished) {
    return "Publicado";
  }

  return "Ainda não publicado";
};

function EmptyCourseContent({
  course,
  nextModuleSortOrder,
  publicationState,
}: Pick<
  CourseContentPanelProps,
  "course" | "nextModuleSortOrder" | "publicationState"
>) {
  return (
    <Empty className="border bg-card">
      <EmptyHeader>
        <EmptyTitle>Nenhum módulo cadastrado</EmptyTitle>
        <EmptyDescription>
          {publicationState.hasDraft
            ? "Crie a primeira unidade para começar a estruturar o conteúdo do Curso."
            : "Prepare alterações antes de criar a primeira unidade do Curso."}
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        {publicationState.hasDraft ? (
          <CreateModuleDialog
            course={course}
            nextModuleSortOrder={nextModuleSortOrder}
            triggerLabel="Criar primeiro módulo"
          />
        ) : (
          <CoursePublicationAction action="prepare" courseId={course.id} />
        )}
      </EmptyContent>
    </Empty>
  );
}

export function CourseContentPanel({
  contentSignal,
  course,
  lessons,
  modules,
  nextModuleSortOrder,
  publicationState,
}: CourseContentPanelProps): React.JSX.Element {
  const hasModules = modules.length > 0;

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-4 border-b pb-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 space-y-3">
          <div className="space-y-1">
            <h2 className="font-semibold text-xl">Conteúdo do curso</h2>
            <p className="text-muted-foreground text-sm">
              Organize módulos e aulas e publique todas as alterações em
              conjunto.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={CONTENT_SIGNAL_VARIANTS[contentSignal.tone]}>
              {contentSignal.label}
            </Badge>
            <Badge variant="outline">
              {getPublicationLabel(publicationState)}
            </Badge>
            <span className="text-muted-foreground text-sm">
              {contentSignal.helper}
            </span>
          </div>
        </div>

        {hasModules ? (
          <div className="flex w-full shrink-0 flex-wrap gap-2 lg:w-auto lg:justify-end">
            {publicationState.hasDraft ? (
              <>
                <CreateModuleDialog
                  course={course}
                  nextModuleSortOrder={nextModuleSortOrder}
                  triggerVariant="outline"
                />
                <CoursePublicationAction
                  action="publish"
                  courseId={course.id}
                />
              </>
            ) : (
              <CoursePublicationAction action="prepare" courseId={course.id} />
            )}
          </div>
        ) : null}
      </div>

      {publicationState.hasDraft ? null : (
        <p className="rounded-lg border bg-muted/30 px-4 py-3 text-muted-foreground text-sm">
          Prepare alterações para editar a estrutura atual. O conteúdo publicado
          permanece disponível aos alunos até a próxima publicação.
        </p>
      )}

      {hasModules ? (
        <CourseBuilderWrapper
          course={course}
          editable={publicationState.hasDraft}
          lessons={lessons}
          modules={modules}
        />
      ) : (
        <EmptyCourseContent
          course={course}
          nextModuleSortOrder={nextModuleSortOrder}
          publicationState={publicationState}
        />
      )}
    </section>
  );
}
