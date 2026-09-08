import { randomUUID } from "node:crypto";
import {
  Add01Icon,
  Book01Icon,
  FloppyDiskIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import Link from "next/link";
import { AdminMutationSubmitButton } from "@/components/admin-mutation-form";
import { AutoCloseDialogForm } from "@/components/auto-close-dialog-form";
import { CourseCoverUploadField } from "@/components/course-cover-upload-field";
import { DiscardAwareDialog } from "@/components/discard-aware-dialog";
import { PageContainer } from "@/components/page-container";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DialogBody,
  DialogFooter,
  DialogTriggerButton,
} from "@/components/ui/dialog";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { saveCourseAction } from "@/features/admin/actions";
import {
  type AdminCourse,
  type AdminCourseCatalogQuery,
  getAdminCourseCatalogData,
} from "@/features/admin/server";
import { getCourseAvailabilityStatusPresentation } from "@/features/admin/status-presentation";
import { resolveCourseAvailability } from "@/features/courses/availability";
import { CourseCoverImage } from "@/features/courses/course-cover-image";
import { getCourseCoverBlurDataUrl } from "@/features/storage/course-cover";
import { requirePermission } from "@/lib/auth-permissions";
import { formatCurrencyInCents } from "@/lib/formatters";
import { route } from "@/lib/routes";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

type CourseData = AdminCourse;

const WHITESPACE_RE = /\s+/;

const getInitials = (title: string): string =>
  title
    .split(WHITESPACE_RE)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("");

interface AdminCoursesPageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

const firstSearchParam = (
  value: string | string[] | undefined
): string | undefined => (Array.isArray(value) ? value[0] : value);

export default async function AdminCoursesPage({
  searchParams,
}: AdminCoursesPageProps): Promise<React.JSX.Element> {
  await requirePermission("manageContent");
  const params = (await searchParams) ?? {};
  const rawPage = Number.parseInt(firstSearchParam(params.page) ?? "1", 10);
  const options: AdminCourseCatalogQuery = {
    page: Number.isFinite(rawPage) ? rawPage : 1,
    search: firstSearchParam(params.q),
  };
  const data = await getAdminCourseCatalogData(options);
  const pageHref = (targetPage: number): string => {
    const query = new URLSearchParams();
    if (data.search) {
      query.set("q", data.search);
    }
    query.set("page", String(targetPage));
    return `/admin/cursos?${query.toString()}`;
  };

  return (
    <PageContainer>
      <div className="flex flex-col gap-8">
        <PageHeader
          actions={
            <DiscardAwareDialog
              description="Crie o curso antes de cadastrar seus módulos e aulas."
              title="Novo curso"
              trigger={
                <DialogTriggerButton>
                  <HugeiconsIcon
                    aria-hidden="true"
                    data-icon="inline-start"
                    icon={Add01Icon}
                    size={18}
                    strokeWidth={2}
                  />
                  Novo curso
                </DialogTriggerButton>
              }
            >
              <CourseForm priceFieldId="header-course-price" />
            </DiscardAwareDialog>
          }
          description="Gerencie cursos em uma visão limpa. Entre em um curso para organizar módulos, aulas, alunas e publicação."
          title="Cursos"
        />

        <form
          action="/admin/cursos"
          className="flex max-w-xl gap-2"
          method="get"
        >
          <input name="page" type="hidden" value="1" />
          <Input
            aria-label="Buscar cursos"
            autoComplete="off"
            className="min-w-0 flex-1"
            defaultValue={data.search}
            name="q"
            placeholder="Buscar por título, subtítulo ou slug…"
          />
          <Button type="submit">Buscar</Button>
        </form>

        <section className="flex flex-wrap gap-5">
          {data.courses.length === 0 ? (
            <Empty className="w-full">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <HugeiconsIcon aria-hidden="true" icon={Book01Icon} />
                </EmptyMedia>
                <EmptyTitle as="h2">
                  {data.search
                    ? "Nenhum curso encontrado"
                    : "Nenhum curso cadastrado"}
                </EmptyTitle>
                <EmptyDescription>
                  {data.search
                    ? `A busca por “${data.search}” não retornou cursos.`
                    : "Crie o primeiro curso para começar a adicionar módulos e aulas."}
                </EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                {data.search ? (
                  <Button asChild variant="outline">
                    <Link href="/admin/cursos">Limpar busca</Link>
                  </Button>
                ) : (
                  <DiscardAwareDialog
                    description="Crie o curso antes de cadastrar seus módulos e aulas."
                    title="Novo curso"
                    trigger={
                      <DialogTriggerButton>
                        <HugeiconsIcon
                          aria-hidden="true"
                          data-icon="inline-start"
                          icon={Add01Icon}
                          size={18}
                          strokeWidth={2}
                        />
                        Criar primeiro curso
                      </DialogTriggerButton>
                    }
                  >
                    <CourseForm priceFieldId="empty-course-price" />
                  </DiscardAwareDialog>
                )}
              </EmptyContent>
            </Empty>
          ) : (
            data.courses.map((course) => {
              const availability = resolveCourseAvailability({
                catalogVisibility: course.catalogVisibility,
                deliveryStatus: course.status as
                  | "active"
                  | "archived"
                  | "draft",
                salesStatus: course.salesStatus,
              });
              const statusInfo = getCourseAvailabilityStatusPresentation(
                availability.preset
              );

              return (
                <article
                  className="group relative flex aspect-[24/25] w-full max-w-[340px] shrink-0 flex-col overflow-hidden rounded-xl border bg-card text-card-foreground shadow-sm transition-colors hover:border-primary/50"
                  key={course.id}
                >
                  <div className="absolute inset-0 z-0">
                    {course.thumbnailUrl ? (
                      <CourseCoverImage
                        alt=""
                        blurDataUrl={getCourseCoverBlurDataUrl(
                          course.coverImage
                        )}
                        className="opacity-70 transition-transform duration-500 group-hover:scale-105"
                        sizes="340px"
                        src={course.thumbnailUrl}
                      />
                    ) : (
                      <>
                        <div className="absolute inset-0 bg-linear-to-br from-card via-card/95 to-primary/20" />
                        <div className="absolute top-[20%] -right-4 select-none opacity-10 transition-transform duration-500 group-hover:scale-105">
                          <span className="font-black text-[8rem] leading-none tracking-tighter">
                            {getInitials(course.title)}
                          </span>
                        </div>
                      </>
                    )}
                    <div className="absolute inset-0 bg-linear-to-b from-transparent via-card/80 to-card" />
                  </div>

                  <div className="relative z-10 flex min-h-0 flex-1 flex-col p-5 sm:p-6">
                    <div className="flex items-start justify-between gap-3">
                      <Badge variant={statusInfo.variant}>
                        {statusInfo.label}
                      </Badge>
                    </div>

                    <div className="mt-auto pt-10">
                      <h3 className="line-clamp-2 font-bold text-lg">
                        <Link
                          className="before:absolute before:inset-0"
                          href={route(`/admin/cursos/${course.id}`)}
                        >
                          {course.title}
                        </Link>
                      </h3>
                      <div className="mt-2 flex items-start gap-4">
                        <div className="flex-1">
                          {course.subtitle ? (
                            <p className="line-clamp-2 text-card-foreground/70 text-sm leading-5">
                              {course.subtitle}
                            </p>
                          ) : null}
                        </div>
                        <div className="shrink-0 pt-0.5 text-right font-medium text-card-foreground/60 text-xs">
                          {course.moduleCount ?? 0} módulos •{" "}
                          {course.lessonCount ?? 0} aulas
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="relative z-10 flex shrink-0 flex-col gap-5 p-5 pt-0 sm:p-6 sm:pt-0">
                    <div className="flex items-center justify-between text-muted-foreground text-xs">
                      <span>{course.accessDurationMonths}m acesso</span>
                      <span className="font-semibold text-foreground">
                        {formatCurrencyInCents(course.priceInCents)}
                      </span>
                    </div>

                    <Button
                      asChild
                      className="w-full"
                      size="sm"
                      variant="secondary"
                    >
                      <Link href={route(`/admin/cursos/${course.id}`)}>
                        Gerenciar curso
                      </Link>
                    </Button>
                  </div>
                </article>
              );
            })
          )}
        </section>

        <div className="flex items-center justify-between border-t pt-4">
          <span className="text-muted-foreground text-sm">
            Página {data.page}
          </span>
          <div className="flex gap-2">
            {data.page > 1 ? (
              <Button asChild variant="outline">
                <Link href={pageHref(data.page - 1)}>Anterior</Link>
              </Button>
            ) : (
              <Button disabled variant="outline">
                Anterior
              </Button>
            )}
            {data.hasNextPage ? (
              <Button asChild variant="outline">
                <Link href={pageHref(data.page + 1)}>Próxima</Link>
              </Button>
            ) : (
              <Button disabled variant="outline">
                Próxima
              </Button>
            )}
          </div>
        </div>
      </div>
    </PageContainer>
  );
}

function CourseForm({
  course,
  priceFieldId,
}: {
  course?: CourseData;
  priceFieldId: string;
}): React.JSX.Element {
  const aggregateId = course?.id ?? randomUUID();
  const titleFieldId = `${priceFieldId}-title`;
  const subtitleFieldId = `${priceFieldId}-subtitle`;
  const descriptionFieldId = `${priceFieldId}-description`;
  const durationFieldId = `${priceFieldId}-access-duration`;

  return (
    <AutoCloseDialogForm
      action={saveCourseAction}
      className="flex h-full min-h-0 flex-1 flex-col overflow-hidden"
    >
      <DialogBody>
        <FieldGroup>
          <input name="courseId" type="hidden" value={course?.id ?? ""} />
          <div className="grid gap-x-8 gap-y-5 sm:grid-cols-[auto_1fr]">
            <Field className="row-span-2 justify-center">
              <CourseCoverUploadField
                aggregateId={aggregateId}
                className="sm:w-[240px]"
                defaultCoverImage={course?.coverImage}
                defaultThumbnailUrl={course?.thumbnailUrl}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor={titleFieldId}>Título</FieldLabel>
              <Input
                defaultValue={course?.title ?? ""}
                id={titleFieldId}
                name="title"
                required
              />
            </Field>
            <Field>
              <FieldLabel htmlFor={subtitleFieldId}>Subtítulo</FieldLabel>
              <Input
                defaultValue={course?.subtitle ?? ""}
                id={subtitleFieldId}
                name="subtitle"
              />
            </Field>
          </div>
          <Field>
            <FieldLabel htmlFor={descriptionFieldId}>Descrição</FieldLabel>
            <Textarea
              defaultValue={course?.description ?? ""}
              id={descriptionFieldId}
              name="description"
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor={durationFieldId}>Meses de acesso</FieldLabel>
              <Input
                defaultValue={course?.accessDurationMonths ?? 12}
                id={durationFieldId}
                min={1}
                name="accessDurationMonths"
                type="number"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor={priceFieldId}>Preço do curso</FieldLabel>
              <Input
                defaultValue={
                  course ? formatCurrencyInCents(course.priceInCents) : ""
                }
                id={priceFieldId}
                name="price"
                placeholder="497,00"
                required
              />
            </Field>
          </div>
        </FieldGroup>
      </DialogBody>
      <DialogFooter>
        <AdminMutationSubmitButton className="w-fit" type="submit">
          <HugeiconsIcon
            aria-hidden="true"
            data-icon="inline-start"
            icon={course ? FloppyDiskIcon : Add01Icon}
            size={18}
            strokeWidth={2}
          />
          {course ? "Salvar curso" : "Criar curso"}
        </AdminMutationSubmitButton>
      </DialogFooter>
    </AutoCloseDialogForm>
  );
}
