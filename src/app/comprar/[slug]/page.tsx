import Link from "next/link";
import { redirect } from "next/navigation";
import { PageContainer } from "@/components/page-container";
import { Button } from "@/components/ui/button";
import { CourseInterestButton } from "@/features/courses/course-interest-button";
import {
  getPurchaseHandoffView,
  type PurchaseHandoffView,
} from "@/features/payments/purchase-handoff";
import { route } from "@/lib/routes";
import { getCurrentSession } from "@/lib/session";
import { PurchaseHandoffClient } from "./purchase-handoff-client";

export const dynamic = "force-dynamic";

const BLOCKED_CONTENT = {
  account_blocked: {
    description: "Esta Conta nao pode iniciar uma compra. Fale com o suporte.",
    title: "Conta bloqueada",
  },
  course_revoked: {
    description:
      "Este acesso foi encerrado. Fale com o suporte antes de comprar novamente.",
    title: "Acesso encerrado",
  },
  team_account: {
    description:
      "Uma Conta de equipe nao pode comprar Cursos. Fale com o suporte.",
    title: "Conta de equipe",
  },
} as const;

const UNAVAILABLE_CONTENT = {
  checkout_disabled: {
    description:
      "A compra esta temporariamente indisponivel. Fale com o suporte.",
    title: "Checkout indisponivel",
  },
  course_unavailable: {
    description:
      "Este Curso nao esta disponivel para compra. Fale com o suporte.",
    title: "Curso indisponivel",
  },
} as const;

function TechnicalState({
  description,
  title,
}: {
  description: string;
  title: string;
}): React.JSX.Element {
  return (
    <PageContainer
      as="main"
      className="min-h-screen bg-background text-foreground"
    >
      <section className="max-w-2xl rounded-lg border bg-card p-6">
        <h1 className="font-bold text-2xl tracking-tight">{title}</h1>
        <p className="mt-3 text-muted-foreground text-sm leading-6">
          {description}
        </p>
      </section>
    </PageContainer>
  );
}

function CourseAccess({
  view,
}: {
  view: Extract<PurchaseHandoffView, { kind: "access" }>;
}): React.JSX.Element {
  return (
    <PageContainer
      as="main"
      className="min-h-screen bg-background text-foreground"
    >
      <section className="max-w-2xl rounded-lg border bg-card p-6">
        <h1 className="font-bold text-2xl tracking-tight">
          {view.courseTitle}
        </h1>
        <p className="mt-3 text-muted-foreground text-sm leading-6">
          Sua Matricula ja esta ativa.
        </p>
        <Button asChild className="mt-6">
          <Link href={route(view.href)}>Acessar curso</Link>
        </Button>
      </section>
    </PageContainer>
  );
}

function ComingSoon({
  canManageInterest,
  view,
}: {
  canManageInterest: boolean;
  view: Extract<PurchaseHandoffView, { kind: "coming_soon" }>;
}): React.JSX.Element {
  return (
    <PageContainer
      as="main"
      className="min-h-screen bg-background text-foreground"
    >
      <section className="max-w-2xl rounded-lg border bg-card p-6">
        <p className="font-medium text-muted-foreground text-sm">Em breve</p>
        <h1 className="mt-2 font-bold text-2xl tracking-tight">
          {view.courseTitle}
        </h1>
        <p className="mt-3 text-muted-foreground text-sm leading-6">
          Este Curso ainda está em preparação. Nenhuma compra ou Matrícula será
          criada antes da abertura das inscrições.
        </p>
        {view.launchDate ? (
          <p className="mt-4 text-sm">
            Lançamento previsto:{" "}
            <time dateTime={view.launchDate}>
              {new Date(`${view.launchDate}T00:00:00.000Z`).toLocaleDateString(
                "pt-BR",
                { dateStyle: "long", timeZone: "UTC" }
              )}
            </time>
          </p>
        ) : null}
        {canManageInterest ? (
          <CourseInterestButton
            className="mt-6"
            courseId={view.courseId}
            isInterested={view.isInterested}
            variant={view.isInterested ? "outline" : "default"}
          />
        ) : null}
      </section>
    </PageContainer>
  );
}

function SalesClosed({
  canManageInterest,
  view,
}: {
  canManageInterest: boolean;
  view: Extract<PurchaseHandoffView, { kind: "sales_closed" }>;
}): React.JSX.Element {
  return (
    <PageContainer
      as="main"
      className="min-h-screen bg-background text-foreground"
    >
      <section className="max-w-2xl rounded-lg border bg-card p-6">
        <h1 className="font-bold text-2xl tracking-tight">
          {view.courseTitle}
        </h1>
        <p className="mt-3 text-muted-foreground text-sm leading-6">
          Inscrições fechadas. Quem já possui Matrícula continua com acesso
          normal durante o período contratado.
        </p>
        {canManageInterest ? (
          <CourseInterestButton
            className="mt-6"
            courseId={view.courseId}
            isInterested={view.isInterested}
            variant={view.isInterested ? "outline" : "default"}
          />
        ) : null}
      </section>
    </PageContainer>
  );
}

export default async function PurchasePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<React.JSX.Element> {
  const [{ slug }, session] = await Promise.all([params, getCurrentSession()]);
  const view = await getPurchaseHandoffView({ session, slug });

  if (view.kind === "external_redirect") {
    redirect(view.href);
  }

  if (view.kind === "checkout") {
    return (
      <PurchaseHandoffClient
        courseSlug={view.courseSlug}
        courseTitle={view.courseTitle}
        releaseSchedule={view.releaseSchedule}
        releaseScheduleDigest={view.releaseScheduleDigest}
      />
    );
  }

  if (view.kind === "access") {
    return <CourseAccess view={view} />;
  }

  if (view.kind === "blocked") {
    return <TechnicalState {...BLOCKED_CONTENT[view.reason]} />;
  }

  const canManageInterest = session?.role === "student";
  if (view.kind === "coming_soon") {
    return <ComingSoon canManageInterest={canManageInterest} view={view} />;
  }

  if (view.kind === "sales_closed") {
    return <SalesClosed canManageInterest={canManageInterest} view={view} />;
  }

  return <TechnicalState {...UNAVAILABLE_CONTENT[view.reason]} />;
}
