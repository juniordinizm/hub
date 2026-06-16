import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
        <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="font-bold text-3xl tracking-tight">Cursos</h1>
            <p className="mt-2 max-w-2xl text-muted-foreground text-sm">
              Gerencie cursos em uma visao limpa. Entre em um curso para
              organizar modulos e aulas.
            </p>
          </div>
          <Dialog>
            <DialogTrigger asChild>
              <Button>Novo curso</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Novo curso</DialogTitle>
                <DialogDescription>
                  Crie o curso antes de cadastrar seus modulos e aulas.
                </DialogDescription>
              </DialogHeader>
              <CourseForm />
            </DialogContent>
          </Dialog>
        </div>
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
                <div className="flex flex-wrap gap-2">
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="outline">Editar</Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Editar curso</DialogTitle>
                        <DialogDescription>
                          Atualize os dados principais do curso.
                        </DialogDescription>
                      </DialogHeader>
                      <CourseForm course={course} />
                    </DialogContent>
                  </Dialog>
                  <Button asChild>
                    <Link href={route(`/admin/cursos/${course.id}`)}>
                      Gerenciar
                    </Link>
                  </Button>
                  <DeleteCourseDialog course={course} />
                </div>
              </div>
            </article>
          );
        })}
      </section>
    </div>
  );
}

function CourseForm({ course }: { course?: CourseData }): React.JSX.Element {
  return (
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
  );
}

function DeleteCourseDialog({
  course,
}: {
  course: CourseData;
}): React.JSX.Element {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="destructive">Excluir</Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Excluir curso?</DialogTitle>
          <DialogDescription>
            Esta acao remove o curso e, em cascata, seus modulos, aulas,
            matriculas, pedidos e certificados vinculados.
          </DialogDescription>
        </DialogHeader>
        <div className="rounded-lg border bg-background/40 p-3">
          <p className="font-semibold">{course.title}</p>
          <p className="text-muted-foreground text-sm">{course.slug}</p>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">
              Cancelar
            </Button>
          </DialogClose>
          <form action={deleteCourseAction}>
            <input name="courseId" type="hidden" value={course.id} />
            <Button type="submit" variant="destructive">
              Confirmar exclusao
            </Button>
          </form>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
