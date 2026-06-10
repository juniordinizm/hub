import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  inviteStudentAction,
  saveCourseAction,
  saveFaqAction,
  saveLessonAction,
  saveModuleAction,
  saveSettingsAction,
  updateEnrollmentAction,
} from "@/features/admin/actions";
import {
  getAdminManagementData,
  getAdminOverview,
} from "@/features/admin/server";
import { formatDate } from "@/lib/formatters";
import { route } from "@/lib/routes";

export const dynamic = "force-dynamic";

const metrics = [
  ["Cursos", "courses"],
  ["Alunas", "students"],
  ["Matriculas ativas", "activeEnrollments"],
  ["Pedidos pagos", "paidOrders"],
] as const;

const dateInputValue = (date: Date): string => date.toISOString().slice(0, 10);

export default async function AdminPage(): Promise<React.JSX.Element> {
  const [overview, data] = await Promise.all([
    getAdminOverview(),
    getAdminManagementData(),
  ]);
  const firstCourse = data.courses[0];

  return (
    <div className="space-y-8">
      <header>
        <Badge variant="outline">Operacao</Badge>
        <h1 className="mt-3 font-bold text-3xl tracking-tight">
          Painel administrativo
        </h1>
      </header>

      <section className="grid gap-4 md:grid-cols-4">
        {metrics.map(([label, key]) => (
          <Card key={key} size="sm">
            <CardHeader>
              <CardDescription>{label}</CardDescription>
              <CardTitle className="text-3xl">{overview[key]}</CardTitle>
            </CardHeader>
          </Card>
        ))}
      </section>

      <Tabs className="space-y-6" defaultValue="catalogo">
        <TabsList className="flex h-auto flex-wrap justify-start">
          <TabsTrigger value="catalogo">Catalogo</TabsTrigger>
          <TabsTrigger value="alunas">Alunas</TabsTrigger>
          <TabsTrigger value="financeiro">Financeiro</TabsTrigger>
          <TabsTrigger value="faq">FAQ</TabsTrigger>
          <TabsTrigger value="config">Config</TabsTrigger>
        </TabsList>

        <TabsContent className="space-y-6" value="catalogo">
          <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
            <Card>
              <CardHeader>
                <CardTitle>Curso</CardTitle>
                <CardDescription>
                  Atualize o curso principal, produto AbacatePay e duracao.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form action={saveCourseAction}>
                  <FieldGroup>
                    <input
                      name="courseId"
                      type="hidden"
                      value={firstCourse?.id ?? ""}
                    />
                    <Field>
                      <FieldLabel htmlFor="slug">Slug</FieldLabel>
                      <Input
                        defaultValue={firstCourse?.slug ?? ""}
                        id="slug"
                        name="slug"
                        required
                      />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="title">Titulo</FieldLabel>
                      <Input
                        defaultValue={firstCourse?.title ?? ""}
                        id="title"
                        name="title"
                        required
                      />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="subtitle">Subtitulo</FieldLabel>
                      <Input id="subtitle" name="subtitle" />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="description">Descricao</FieldLabel>
                      <Textarea id="description" name="description" />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="instructorName">
                        Instrutora
                      </FieldLabel>
                      <Input id="instructorName" name="instructorName" />
                    </Field>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field>
                        <FieldLabel htmlFor="workloadHours">
                          Carga horaria
                        </FieldLabel>
                        <Input
                          defaultValue={firstCourse?.workloadHours ?? 10}
                          id="workloadHours"
                          min={0}
                          name="workloadHours"
                          type="number"
                        />
                      </Field>
                      <Field>
                        <FieldLabel htmlFor="accessDurationMonths">
                          Meses de acesso
                        </FieldLabel>
                        <Input
                          defaultValue={firstCourse?.accessDurationMonths ?? 12}
                          id="accessDurationMonths"
                          min={1}
                          name="accessDurationMonths"
                          type="number"
                        />
                      </Field>
                    </div>
                    <Field>
                      <FieldLabel htmlFor="supportWhatsappUrl">
                        WhatsApp do curso
                      </FieldLabel>
                      <Input
                        defaultValue={firstCourse?.supportWhatsappUrl ?? ""}
                        id="supportWhatsappUrl"
                        name="supportWhatsappUrl"
                      />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="paymentProviderProductId">
                        Produto AbacatePay
                      </FieldLabel>
                      <Input
                        defaultValue={
                          firstCourse?.paymentProviderProductId ?? ""
                        }
                        id="paymentProviderProductId"
                        name="paymentProviderProductId"
                      />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="status">Status</FieldLabel>
                      <NativeSelect
                        className="w-full"
                        defaultValue={firstCourse?.status ?? "draft"}
                        id="status"
                        name="status"
                      >
                        <option value="draft">Rascunho</option>
                        <option value="active">Ativo</option>
                        <option value="archived">Arquivado</option>
                      </NativeSelect>
                    </Field>
                    <Button type="submit">Salvar curso</Button>
                  </FieldGroup>
                </form>
              </CardContent>
            </Card>

            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Cursos cadastrados</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Curso</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Produto</TableHead>
                        <TableHead>Acesso</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.courses.map((course) => (
                        <TableRow key={course.id}>
                          <TableCell className="font-medium">
                            {course.title}
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary">{course.status}</Badge>
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            {course.paymentProviderProductId ?? "-"}
                          </TableCell>
                          <TableCell>
                            {course.accessDurationMonths} meses
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              <div className="grid gap-6 lg:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle>Novo modulo</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <form action={saveModuleAction}>
                      <FieldGroup>
                        <Field>
                          <FieldLabel>Curso</FieldLabel>
                          <NativeSelect
                            className="w-full"
                            name="courseId"
                            required
                          >
                            {data.courses.map((course) => (
                              <option key={course.id} value={course.id}>
                                {course.title}
                              </option>
                            ))}
                          </NativeSelect>
                        </Field>
                        <Field>
                          <FieldLabel>Titulo</FieldLabel>
                          <Input name="title" required />
                        </Field>
                        <Field>
                          <FieldLabel>Ordem</FieldLabel>
                          <Input
                            min={1}
                            name="sortOrder"
                            required
                            type="number"
                          />
                        </Field>
                        <Field>
                          <FieldLabel>Cor</FieldLabel>
                          <Input defaultValue="#326c71" name="color" />
                        </Field>
                        <Button type="submit">Salvar modulo</Button>
                      </FieldGroup>
                    </form>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Nova aula</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <form action={saveLessonAction}>
                      <FieldGroup>
                        <input name="lessonId" type="hidden" />
                        <Field>
                          <FieldLabel>Modulo</FieldLabel>
                          <NativeSelect
                            className="w-full"
                            name="moduleId"
                            required
                          >
                            {data.modules.map((module) => (
                              <option key={module.id} value={module.id}>
                                {module.courseTitle} - {module.title}
                              </option>
                            ))}
                          </NativeSelect>
                        </Field>
                        <Field>
                          <FieldLabel>Titulo</FieldLabel>
                          <Input name="title" required />
                        </Field>
                        <Field>
                          <FieldLabel>Descricao</FieldLabel>
                          <Textarea name="description" />
                        </Field>
                        <div className="grid gap-4 sm:grid-cols-3">
                          <Field>
                            <FieldLabel>Tipo</FieldLabel>
                            <NativeSelect className="w-full" name="lessonType">
                              <option value="video">Video</option>
                              <option value="presentation">Apresentacao</option>
                              <option value="bonus">Bonus</option>
                            </NativeSelect>
                          </Field>
                          <Field>
                            <FieldLabel>Minutos</FieldLabel>
                            <Input name="durationMinutes" type="number" />
                          </Field>
                          <Field>
                            <FieldLabel>Ordem</FieldLabel>
                            <Input
                              min={1}
                              name="sortOrder"
                              required
                              type="number"
                            />
                          </Field>
                        </div>
                        <div className="grid gap-4 sm:grid-cols-2">
                          <Field>
                            <FieldLabel>Provider</FieldLabel>
                            <NativeSelect
                              className="w-full"
                              name="videoProvider"
                            >
                              <option value="external">Externo</option>
                              <option value="panda">Panda</option>
                              <option value="jmvstream">JMVStream</option>
                            </NativeSelect>
                          </Field>
                          <Field>
                            <FieldLabel>ID do video</FieldLabel>
                            <Input name="videoExternalId" />
                          </Field>
                        </div>
                        <Field>
                          <FieldLabel>URL segura do embed</FieldLabel>
                          <Input name="videoEmbedUrl" />
                        </Field>
                        <label
                          className="inline-flex items-center gap-2 text-sm"
                          htmlFor="lesson-is-published"
                        >
                          <Checkbox
                            defaultChecked
                            id="lesson-is-published"
                            name="isPublished"
                          />
                          Publicada
                        </label>
                        <Button type="submit">Salvar aula</Button>
                      </FieldGroup>
                    </form>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Aulas recentes</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-2">
                  {data.lessons.slice(0, 12).map((lesson) => (
                    <div
                      className="grid gap-2 rounded-3xl border p-3 text-sm md:grid-cols-[1fr_120px_120px]"
                      key={lesson.id}
                    >
                      <span>
                        <strong>{lesson.courseTitle}</strong> /{" "}
                        {lesson.moduleTitle} / {lesson.title}
                      </span>
                      <span>{lesson.videoProvider ?? "sem video"}</span>
                      <Badge
                        variant={lesson.isPublished ? "default" : "outline"}
                      >
                        {lesson.isPublished ? "publicada" : "rascunho"}
                      </Badge>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent
          className="grid gap-6 xl:grid-cols-[420px_1fr]"
          value="alunas"
        >
          <Card>
            <CardHeader>
              <CardTitle>Convidar aluna</CardTitle>
              <CardDescription>
                Cria matricula ativa e envia acesso por e-mail.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form action={inviteStudentAction}>
                <FieldGroup>
                  <Field>
                    <FieldLabel>Nome</FieldLabel>
                    <Input name="name" required />
                  </Field>
                  <Field>
                    <FieldLabel>E-mail</FieldLabel>
                    <Input name="email" required type="email" />
                  </Field>
                  <Field>
                    <FieldLabel>Curso</FieldLabel>
                    <NativeSelect className="w-full" name="courseId" required>
                      {data.courses.map((course) => (
                        <option key={course.id} value={course.id}>
                          {course.title}
                        </option>
                      ))}
                    </NativeSelect>
                  </Field>
                  <input
                    name="courseTitle"
                    type="hidden"
                    value={firstCourse?.title ?? "PROTEA-R Hub"}
                  />
                  <Field>
                    <FieldLabel>Meses de acesso</FieldLabel>
                    <Input
                      defaultValue={12}
                      min={1}
                      name="months"
                      type="number"
                    />
                  </Field>
                  <Button type="submit">
                    Criar matricula e enviar convite
                  </Button>
                </FieldGroup>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Matriculas</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3">
              {data.enrollments.map((enrollment) => (
                <form
                  action={updateEnrollmentAction}
                  className="grid gap-3 rounded-3xl border p-3 md:grid-cols-[1fr_140px_150px_auto]"
                  key={enrollment.id}
                >
                  <input
                    name="enrollmentId"
                    type="hidden"
                    value={enrollment.id}
                  />
                  <div>
                    <p className="font-semibold">{enrollment.name}</p>
                    <p className="text-muted-foreground text-xs">
                      {enrollment.email} - {enrollment.courseTitle}
                    </p>
                  </div>
                  <NativeSelect
                    className="w-full"
                    defaultValue={enrollment.status}
                    name="status"
                  >
                    <option value="active">Ativa</option>
                    <option value="expired">Expirada</option>
                    <option value="revoked">Revogada</option>
                  </NativeSelect>
                  <Input
                    defaultValue={dateInputValue(enrollment.expiresAt)}
                    name="expiresAt"
                    type="date"
                  />
                  <Button type="submit">Atualizar</Button>
                </form>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent className="grid gap-6 lg:grid-cols-3" value="financeiro">
          <Card>
            <CardHeader>
              <CardTitle>Pedidos</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2">
              {data.orders.map((order) => (
                <div className="rounded-3xl border p-3" key={order.id}>
                  <p className="font-semibold">{order.customerName ?? "-"}</p>
                  <p className="text-muted-foreground text-xs">
                    {order.providerOrderId} - {order.status}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Webhooks recentes</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2">
              {overview.recentWebhooks.map((event) => (
                <div className="rounded-3xl border p-3" key={event.eventKey}>
                  <p className="font-mono text-xs">{event.eventKey}</p>
                  <p>
                    {event.eventName} - {event.status}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Certificados</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2">
              {data.certificates.map((certificate) => (
                <Link
                  className="rounded-3xl border p-3 hover:bg-muted"
                  href={route(`/certificados/${certificate.code}`)}
                  key={certificate.code}
                >
                  <span className="block font-semibold">
                    {certificate.studentName}
                  </span>
                  <span className="text-muted-foreground text-xs">
                    {certificate.code} - {formatDate(certificate.issuedAt)}
                  </span>
                </Link>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent className="grid gap-6 lg:grid-cols-2" value="faq">
          <Card>
            <CardHeader>
              <CardTitle>FAQ</CardTitle>
            </CardHeader>
            <CardContent>
              <form action={saveFaqAction}>
                <FieldGroup>
                  <input name="faqId" type="hidden" />
                  <Field>
                    <FieldLabel>Pergunta</FieldLabel>
                    <Input name="question" required />
                  </Field>
                  <Field>
                    <FieldLabel>Resposta</FieldLabel>
                    <Textarea name="answer" required />
                  </Field>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field>
                      <FieldLabel>Categoria</FieldLabel>
                      <Input name="category" />
                    </Field>
                    <Field>
                      <FieldLabel>Ordem</FieldLabel>
                      <Input name="sortOrder" type="number" />
                    </Field>
                  </div>
                  <label
                    className="inline-flex items-center gap-2 text-sm"
                    htmlFor="faq-is-published"
                  >
                    <Checkbox
                      defaultChecked
                      id="faq-is-published"
                      name="isPublished"
                    />
                    Publicado
                  </label>
                  <Button type="submit">Salvar FAQ</Button>
                </FieldGroup>
              </form>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Itens publicados</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2">
              {data.faqs.map((faq) => (
                <div className="rounded-3xl border p-3" key={faq.id}>
                  <p className="font-semibold">{faq.question}</p>
                  <p className="text-muted-foreground text-xs">
                    {faq.category} - {faq.isPublished ? "publicado" : "oculto"}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent className="grid gap-6 lg:grid-cols-2" value="config">
          <Card>
            <CardHeader>
              <CardTitle>Configuracoes</CardTitle>
            </CardHeader>
            <CardContent>
              <form action={saveSettingsAction}>
                <FieldGroup>
                  <Field>
                    <FieldLabel>WhatsApp global</FieldLabel>
                    <Input
                      defaultValue={data.settings.supportWhatsappUrl ?? ""}
                      name="supportWhatsappUrl"
                    />
                  </Field>
                  <Field>
                    <FieldLabel>Nome da assinatura</FieldLabel>
                    <Input
                      defaultValue={data.settings.certificateSignerName ?? ""}
                      name="certificateSignerName"
                    />
                  </Field>
                  <Field>
                    <FieldLabel>Cargo da assinatura</FieldLabel>
                    <Input
                      defaultValue={data.settings.certificateSignerRole ?? ""}
                      name="certificateSignerRole"
                    />
                  </Field>
                  <Field>
                    <FieldLabel>Ultimos 4 caracteres AbacatePay</FieldLabel>
                    <Input
                      defaultValue={
                        data.settings.abacatepayWebhookSecretLast4 ?? ""
                      }
                      name="abacatepayWebhookSecretLast4"
                    />
                  </Field>
                  <Button type="submit">Salvar configuracoes</Button>
                </FieldGroup>
              </form>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Auditoria</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2">
              {data.auditLogs.map((log) => (
                <div
                  className="rounded-3xl border p-3"
                  key={`${log.action}-${log.createdAt.toISOString()}`}
                >
                  <p>{log.action}</p>
                  <p className="text-muted-foreground text-xs">
                    {log.actorEmail ?? "sistema"} - {log.targetType} -{" "}
                    {formatDate(log.createdAt)}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
