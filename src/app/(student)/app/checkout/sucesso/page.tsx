import Link from "next/link";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { canMutateStudentExperience } from "@/features/courses/preview";
import { getStudentCourseAccessStatus } from "@/features/courses/server";
import { route } from "@/lib/routes";
import { requireSession } from "@/lib/session";
import { CheckoutAccessWaiter } from "./checkout-access-waiter";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

export default async function CheckoutSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ courseId?: string }>;
}): Promise<React.JSX.Element> {
  const session = await requireSession();

  if (!canMutateStudentExperience(session.role)) {
    redirect(route("/admin"));
  }

  const { courseId = null } = await searchParams;

  if (courseId) {
    const access = await getStudentCourseAccessStatus({
      courseId,
      userId: session.user.id,
    });

    if (access.canAccess) {
      redirect(route(access.redirectTo));
    }
  }

  return (
    <main className="min-h-screen bg-background px-6 py-10 text-foreground sm:px-10 lg:px-12">
      <section className="max-w-2xl rounded-lg border bg-card p-6">
        <Badge variant="outline">Compra confirmada</Badge>
        <h1 className="mt-4 font-bold text-2xl tracking-tight">
          Seu acesso está sendo liberado
        </h1>
        <p className="mt-3 text-muted-foreground text-sm leading-6">
          Obrigado pela compra. Esta página vai abrir seu curso automaticamente
          assim que o acesso estiver disponível.
        </p>
        <CheckoutAccessWaiter courseId={courseId} />
        <div className="mt-6 flex flex-wrap gap-3">
          <Button asChild>
            <Link href={route("/app")}>Voltar para cursos</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={route("/app/certificados")}>Ver certificados</Link>
          </Button>
        </div>
      </section>
    </main>
  );
}
