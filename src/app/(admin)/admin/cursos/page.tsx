import Link from "next/link";
import { Badge } from "@/components/ui/badge";
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
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { deleteCourseAction, saveCourseAction } from "@/features/admin/actions";
import { getAdminManagementData } from "@/features/admin/server";
import { route } from "@/lib/routes";

export const dynamic = "force-dynamic";

type CourseData = Awaited<
  ReturnType<typeof getAdminManagementData>
>["courses"][number];

export default async function AdminCoursesPage(): Promise<React.JSX.Element> {
  const data = await getAdminManagementData();

  return (
    <div className="space-y-8">
      <header className="border-b pb-6">
        <Badge variant="outline">Catalogo</Badge>
        <h1 className="mt-4 font-bold text-3xl tracking-tight">Cursos</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground text-sm">
          Gerencie cursos em uma visão limpa. Entre em um curso para organizar
          módulos e aulas.
        </p>
      </header>

      <section className="space-y-3">
        {data.courses.map((course) => {
          const modulesCount = data.modules.filter(
            (moduleData) => moduleData.courseId === course.id
          ).length;
          const lessonsCount = data.lessons.filter((lesson) =>
            data.modules.some(
              (moduleData) =>
                moduleData.courseId === course.id &&
                moduleData.id === lesson.moduleId
            )
          ).length;

          return (
            <article className="rounded-lg border bg-card" key={course.id}>
              <div className="grid gap-4 p-5 lg:grid-cols-[1fr_auto] lg:items-center">
                <div>
                  <div className="mb-2 flex flex-wrap gap-2">
                    <Badge variant="secondary">{course.status}</Badge>
                    <Badge variant="outline">{modulesCount} modulos</Badge>
                    <Badge variant="outline">{lessonsCount} aulas</Badge>
                  </div>
                  <h2 className="font-semibold text-xl">{course.title}</h2>
                  <p className="mt-1 text-muted-foreground text-sm">
                    {course.slug} - acesso de {course.accessDurationMonths}{" "}
                    meses
                  </p>
                </div>
                <Button asChild>
                  <Link href={route(`/admin/cursos/${course.id}`)}>
                    Gerenciar
                  </Link>
                </Button>
              </div>
              <details>
                <summary className="cursor-pointer list-none border-t px-5 py-3 text-muted-foreground text-sm">
                  Editar dados do curso
                </summary>
                <div className="border-t p-5">
                  <CourseForm course={course} />
                </div>
              </details>
            </article>
          );
        })}
      </section>

      <section className="space-y-4 border-t pt-6">
        <div>
          <h2 className="font-semibold text-xl">Novo curso</h2>
          <p className="mt-1 text-muted-foreground text-sm">
            Crie um novo curso antes de cadastrar seus módulos e aulas.
          </p>
        </div>
        <div className="rounded-lg border bg-card p-5">
          <CourseForm />
        </div>
      </section>
    </div>
  );
}

function CourseForm({ course }: { course?: CourseData }): React.JSX.Element {
  return (
    <div className="space-y-4">
      <form action={saveCourseAction}>
        <FieldGroup>
          <input name="courseId" type="hidden" value={course?.id ?? ""} />
          <div className="grid gap-4 lg:grid-cols-2">
            <Field>
              <FieldLabel>Titulo</FieldLabel>
              <Input defaultValue={course?.title ?? ""} name="title" required />
            </Field>
            <Field>
              <FieldLabel>Slug</FieldLabel>
              <Input defaultValue={course?.slug ?? ""} name="slug" required />
            </Field>
          </div>
          <Field>
            <FieldLabel>Subtitulo</FieldLabel>
            <Input defaultValue={course?.subtitle ?? ""} name="subtitle" />
          </Field>
          <Field>
            <FieldLabel>Descricao</FieldLabel>
            <Textarea
              defaultValue={course?.description ?? ""}
              name="description"
            />
          </Field>
          <div className="grid gap-4 lg:grid-cols-3">
            <Field>
              <FieldLabel>Instrutora</FieldLabel>
              <Input
                defaultValue={course?.instructorName ?? ""}
                name="instructorName"
              />
            </Field>
            <Field>
              <FieldLabel>Carga horaria</FieldLabel>
              <Input
                defaultValue={course?.workloadHours ?? 0}
                min={0}
                name="workloadHours"
                type="number"
              />
            </Field>
            <Field>
              <FieldLabel>Meses de acesso</FieldLabel>
              <Input
                defaultValue={course?.accessDurationMonths ?? 12}
                min={1}
                name="accessDurationMonths"
                type="number"
              />
            </Field>
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            <Field>
              <FieldLabel>WhatsApp do curso</FieldLabel>
              <Input
                defaultValue={course?.supportWhatsappUrl ?? ""}
                name="supportWhatsappUrl"
              />
            </Field>
            <Field>
              <FieldLabel>Produto AbacatePay</FieldLabel>
              <Input
                defaultValue={course?.paymentProviderProductId ?? ""}
                name="paymentProviderProductId"
              />
            </Field>
            <Field>
              <FieldLabel>Status</FieldLabel>
              <Select defaultValue={course?.status ?? "draft"} name="status">
                <SelectTrigger>
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Rascunho</SelectItem>
                  <SelectItem value="active">Ativo</SelectItem>
                  <SelectItem value="archived">Arquivado</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>
          <Button className="w-fit" type="submit">
            {course ? "Salvar curso" : "Criar curso"}
          </Button>
        </FieldGroup>
      </form>
      {course ? (
        <>
          <Separator />
          <form action={deleteCourseAction}>
            <input name="courseId" type="hidden" value={course.id} />
            <Button size="sm" type="submit" variant="destructive">
              Excluir curso
            </Button>
          </form>
        </>
      ) : null}
    </div>
  );
}
