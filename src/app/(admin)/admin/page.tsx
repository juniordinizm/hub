import Link from "next/link";
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

const inputClass =
  "h-10 w-full rounded-md border border-[#d9cbc1] bg-white px-3 text-sm outline-none focus:border-[#326c71]";
const textareaClass =
  "min-h-24 w-full rounded-md border border-[#d9cbc1] bg-white px-3 py-2 text-sm outline-none focus:border-[#326c71]";
const buttonClass =
  "inline-flex h-10 items-center justify-center rounded-md bg-[#326c71] px-4 font-bold text-sm text-white hover:bg-[#28595d]";
const sectionClass = "mt-8 rounded-md border border-[#d9cbc1] bg-white";

const dateInputValue = (date: Date): string => date.toISOString().slice(0, 10);

export default async function AdminPage(): Promise<React.JSX.Element> {
  const [overview, data] = await Promise.all([
    getAdminOverview(),
    getAdminManagementData(),
  ]);
  const firstCourse = data.courses[0];

  return (
    <div>
      <p className="font-semibold text-[#326c71] text-xs uppercase tracking-[0.18em]">
        Operacao
      </p>
      <h1 className="mt-3 font-bold text-3xl tracking-tight">
        Painel administrativo
      </h1>

      <section className="mt-8 grid gap-4 md:grid-cols-4">
        {metrics.map(([label, key]) => (
          <article
            className="rounded-md border border-[#d9cbc1] bg-white p-5"
            key={key}
          >
            <p className="text-[#667b7d] text-sm">{label}</p>
            <strong className="mt-2 block text-3xl">{overview[key]}</strong>
          </article>
        ))}
      </section>

      <section className={sectionClass}>
        <div className="border-[#eadfd8] border-b p-5">
          <h2 className="font-bold text-xl">Cursos</h2>
          <p className="mt-1 text-[#667b7d] text-sm">
            Crie ou atualize cursos, pagamento externo e duracao do acesso.
          </p>
        </div>
        <div className="grid gap-6 p-5 lg:grid-cols-[360px_1fr]">
          <form action={saveCourseAction} className="grid gap-3">
            <input
              name="courseId"
              type="hidden"
              value={firstCourse?.id ?? ""}
            />
            <input
              className={inputClass}
              defaultValue={firstCourse?.slug ?? ""}
              name="slug"
              placeholder="slug"
              required
            />
            <input
              className={inputClass}
              defaultValue={firstCourse?.title ?? ""}
              name="title"
              placeholder="Titulo"
              required
            />
            <input
              className={inputClass}
              name="subtitle"
              placeholder="Subtitulo"
            />
            <textarea
              className={textareaClass}
              name="description"
              placeholder="Descricao"
            />
            <input
              className={inputClass}
              name="instructorName"
              placeholder="Instrutora"
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <input
                className={inputClass}
                defaultValue={firstCourse?.workloadHours ?? 10}
                min={0}
                name="workloadHours"
                placeholder="Carga horaria"
                type="number"
              />
              <input
                className={inputClass}
                defaultValue={firstCourse?.accessDurationMonths ?? 12}
                min={1}
                name="accessDurationMonths"
                placeholder="Meses de acesso"
                type="number"
              />
            </div>
            <input
              className={inputClass}
              defaultValue={firstCourse?.supportWhatsappUrl ?? ""}
              name="supportWhatsappUrl"
              placeholder="WhatsApp do curso"
            />
            <input
              className={inputClass}
              defaultValue={firstCourse?.paymentProviderProductId ?? ""}
              name="paymentProviderProductId"
              placeholder="Produto AbacatePay"
            />
            <select
              className={inputClass}
              defaultValue={firstCourse?.status ?? "draft"}
              name="status"
            >
              <option value="draft">Rascunho</option>
              <option value="active">Ativo</option>
              <option value="archived">Arquivado</option>
            </select>
            <button className={buttonClass} type="submit">
              Salvar curso
            </button>
          </form>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-[#667b7d]">
                <tr>
                  <th className="p-2">Curso</th>
                  <th className="p-2">Status</th>
                  <th className="p-2">Produto</th>
                  <th className="p-2">Acesso</th>
                </tr>
              </thead>
              <tbody>
                {data.courses.map((course) => (
                  <tr className="border-[#eadfd8] border-t" key={course.id}>
                    <td className="p-2 font-semibold">{course.title}</td>
                    <td className="p-2">{course.status}</td>
                    <td className="p-2 font-mono text-xs">
                      {course.paymentProviderProductId ?? "-"}
                    </td>
                    <td className="p-2">{course.accessDurationMonths} meses</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className={sectionClass}>
        <div className="border-[#eadfd8] border-b p-5">
          <h2 className="font-bold text-xl">Modulos e aulas</h2>
          <p className="mt-1 text-[#667b7d] text-sm">
            Cadastre a estrutura do curso e os embeds JMV/Panda/externo.
          </p>
        </div>
        <div className="grid gap-6 p-5 lg:grid-cols-2">
          <form action={saveModuleAction} className="grid gap-3">
            <h3 className="font-bold">Modulo</h3>
            <select className={inputClass} name="courseId" required>
              {data.courses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.title}
                </option>
              ))}
            </select>
            <input
              className={inputClass}
              name="title"
              placeholder="Titulo"
              required
            />
            <input
              className={inputClass}
              min={1}
              name="sortOrder"
              placeholder="Ordem"
              required
              type="number"
            />
            <input
              className={inputClass}
              defaultValue="#326c71"
              name="color"
              placeholder="#326c71"
            />
            <button className={buttonClass} type="submit">
              Salvar modulo
            </button>
          </form>
          <form action={saveLessonAction} className="grid gap-3">
            <h3 className="font-bold">Aula</h3>
            <input name="lessonId" type="hidden" />
            <select className={inputClass} name="moduleId" required>
              {data.modules.map((module) => (
                <option key={module.id} value={module.id}>
                  {module.courseTitle} - {module.title}
                </option>
              ))}
            </select>
            <input
              className={inputClass}
              name="title"
              placeholder="Titulo"
              required
            />
            <textarea
              className={textareaClass}
              name="description"
              placeholder="Descricao"
            />
            <div className="grid gap-3 sm:grid-cols-3">
              <select className={inputClass} name="lessonType">
                <option value="video">Video</option>
                <option value="presentation">Apresentacao</option>
                <option value="bonus">Bonus</option>
              </select>
              <input
                className={inputClass}
                min={0}
                name="durationMinutes"
                placeholder="Minutos"
                type="number"
              />
              <input
                className={inputClass}
                min={1}
                name="sortOrder"
                placeholder="Ordem"
                required
                type="number"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <select className={inputClass} name="videoProvider">
                <option value="external">Externo</option>
                <option value="panda">Panda</option>
                <option value="jmvstream">JMVStream</option>
              </select>
              <input
                className={inputClass}
                name="videoExternalId"
                placeholder="ID do video"
              />
            </div>
            <input
              className={inputClass}
              name="videoEmbedUrl"
              placeholder="URL segura do embed"
            />
            <label className="inline-flex items-center gap-2 text-sm">
              <input defaultChecked name="isPublished" type="checkbox" />
              Publicada
            </label>
            <button className={buttonClass} type="submit">
              Salvar aula
            </button>
          </form>
        </div>
        <div className="border-[#eadfd8] border-t p-5">
          <div className="grid gap-2 text-sm">
            {data.lessons.slice(0, 12).map((lesson) => (
              <div
                className="grid gap-2 rounded-md border border-[#eadfd8] p-3 md:grid-cols-[1fr_120px_120px]"
                key={lesson.id}
              >
                <span>
                  <strong>{lesson.courseTitle}</strong> / {lesson.moduleTitle} /{" "}
                  {lesson.title}
                </span>
                <span>{lesson.videoProvider ?? "sem video"}</span>
                <span>{lesson.isPublished ? "publicada" : "rascunho"}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className={sectionClass}>
        <div className="border-[#eadfd8] border-b p-5">
          <h2 className="font-bold text-xl">Alunas e matriculas</h2>
        </div>
        <div className="grid gap-6 p-5 lg:grid-cols-[360px_1fr]">
          <form action={inviteStudentAction} className="grid gap-3">
            <input
              className={inputClass}
              name="name"
              placeholder="Nome"
              required
            />
            <input
              className={inputClass}
              name="email"
              placeholder="E-mail"
              required
              type="email"
            />
            <select className={inputClass} name="courseId" required>
              {data.courses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.title}
                </option>
              ))}
            </select>
            <input
              name="courseTitle"
              type="hidden"
              value={firstCourse?.title ?? "PROTEA-R Hub"}
            />
            <input
              className={inputClass}
              defaultValue={12}
              min={1}
              name="months"
              type="number"
            />
            <button className={buttonClass} type="submit">
              Criar matricula e enviar convite
            </button>
          </form>
          <div className="grid gap-3">
            {data.enrollments.map((enrollment) => (
              <form
                action={updateEnrollmentAction}
                className="grid gap-2 rounded-md border border-[#eadfd8] p-3 md:grid-cols-[1fr_140px_150px_110px]"
                key={enrollment.id}
              >
                <input
                  name="enrollmentId"
                  type="hidden"
                  value={enrollment.id}
                />
                <div>
                  <p className="font-semibold">{enrollment.name}</p>
                  <p className="text-[#667b7d] text-xs">
                    {enrollment.email} - {enrollment.courseTitle}
                  </p>
                </div>
                <select
                  className={inputClass}
                  defaultValue={enrollment.status}
                  name="status"
                >
                  <option value="active">Ativa</option>
                  <option value="expired">Expirada</option>
                  <option value="revoked">Revogada</option>
                </select>
                <input
                  className={inputClass}
                  defaultValue={dateInputValue(enrollment.expiresAt)}
                  name="expiresAt"
                  type="date"
                />
                <button className={buttonClass} type="submit">
                  Atualizar
                </button>
              </form>
            ))}
          </div>
        </div>
      </section>

      <section className={sectionClass}>
        <div className="border-[#eadfd8] border-b p-5">
          <h2 className="font-bold text-xl">
            Pedidos, webhooks e certificados
          </h2>
        </div>
        <div className="grid gap-6 p-5 lg:grid-cols-3">
          <div>
            <h3 className="font-bold">Pedidos</h3>
            <div className="mt-3 grid gap-2 text-sm">
              {data.orders.map((order) => (
                <div
                  className="rounded-md border border-[#eadfd8] p-3"
                  key={order.id}
                >
                  <p className="font-semibold">{order.customerName ?? "-"}</p>
                  <p className="text-[#667b7d] text-xs">
                    {order.providerOrderId} - {order.status}
                  </p>
                </div>
              ))}
            </div>
          </div>
          <div>
            <h3 className="font-bold">Webhooks recentes</h3>
            <div className="mt-3 grid gap-2 text-sm">
              {overview.recentWebhooks.map((event) => (
                <div
                  className="rounded-md border border-[#eadfd8] p-3"
                  key={event.eventKey}
                >
                  <p className="font-mono text-xs">{event.eventKey}</p>
                  <p>
                    {event.eventName} - {event.status}
                  </p>
                </div>
              ))}
            </div>
          </div>
          <div>
            <h3 className="font-bold">Certificados</h3>
            <div className="mt-3 grid gap-2 text-sm">
              {data.certificates.map((certificate) => (
                <Link
                  className="rounded-md border border-[#eadfd8] p-3 hover:bg-[#f7f3ef]"
                  href={route(`/certificados/${certificate.code}`)}
                  key={certificate.code}
                >
                  <span className="block font-semibold">
                    {certificate.studentName}
                  </span>
                  <span className="text-[#667b7d] text-xs">
                    {certificate.code} - {formatDate(certificate.issuedAt)}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className={sectionClass}>
        <div className="border-[#eadfd8] border-b p-5">
          <h2 className="font-bold text-xl">FAQ e configuracoes</h2>
        </div>
        <div className="grid gap-6 p-5 lg:grid-cols-2">
          <form action={saveFaqAction} className="grid gap-3">
            <input name="faqId" type="hidden" />
            <input
              className={inputClass}
              name="question"
              placeholder="Pergunta"
              required
            />
            <textarea
              className={textareaClass}
              name="answer"
              placeholder="Resposta"
              required
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <input
                className={inputClass}
                name="category"
                placeholder="Categoria"
              />
              <input
                className={inputClass}
                name="sortOrder"
                placeholder="Ordem"
                type="number"
              />
            </div>
            <label className="inline-flex items-center gap-2 text-sm">
              <input defaultChecked name="isPublished" type="checkbox" />
              Publicado
            </label>
            <button className={buttonClass} type="submit">
              Salvar FAQ
            </button>
            <div className="grid gap-2 text-sm">
              {data.faqs.map((faq) => (
                <div
                  className="rounded-md border border-[#eadfd8] p-3"
                  key={faq.id}
                >
                  <p className="font-semibold">{faq.question}</p>
                  <p className="text-[#667b7d] text-xs">
                    {faq.category} - {faq.isPublished ? "publicado" : "oculto"}
                  </p>
                </div>
              ))}
            </div>
          </form>
          <form
            action={saveSettingsAction}
            className="grid content-start gap-3"
          >
            <input
              className={inputClass}
              defaultValue={data.settings.supportWhatsappUrl ?? ""}
              name="supportWhatsappUrl"
              placeholder="WhatsApp global"
            />
            <input
              className={inputClass}
              defaultValue={data.settings.certificateSignerName ?? ""}
              name="certificateSignerName"
              placeholder="Nome da assinatura"
            />
            <input
              className={inputClass}
              defaultValue={data.settings.certificateSignerRole ?? ""}
              name="certificateSignerRole"
              placeholder="Cargo da assinatura"
            />
            <input
              className={inputClass}
              defaultValue={data.settings.abacatepayWebhookSecretLast4 ?? ""}
              name="abacatepayWebhookSecretLast4"
              placeholder="Ultimos 4 caracteres do segredo AbacatePay"
            />
            <button className={buttonClass} type="submit">
              Salvar configuracoes
            </button>
            <div className="mt-4">
              <h3 className="font-bold">Auditoria</h3>
              <div className="mt-3 grid gap-2 text-sm">
                {data.auditLogs.map((log) => (
                  <div
                    className="rounded-md border border-[#eadfd8] p-3"
                    key={`${log.action}-${log.createdAt.toISOString()}`}
                  >
                    <p>{log.action}</p>
                    <p className="text-[#667b7d] text-xs">
                      {log.actorEmail ?? "sistema"} - {log.targetType} -{" "}
                      {formatDate(log.createdAt)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </form>
        </div>
      </section>
    </div>
  );
}
