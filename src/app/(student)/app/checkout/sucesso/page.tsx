import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { route } from "@/lib/routes";
import { requireSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function CheckoutSuccessPage(): Promise<React.JSX.Element> {
  await requireSession();

  return (
    <main className="min-h-screen bg-background px-6 py-10 text-foreground sm:px-10 lg:px-12">
      <section className="max-w-2xl rounded-lg border bg-card p-6">
        <Badge variant="outline">Pagamento recebido</Badge>
        <h1 className="mt-4 font-bold text-2xl tracking-tight">
          Estamos liberando seu acesso
        </h1>
        <p className="mt-3 text-muted-foreground text-sm leading-6">
          O AbacatePay confirmou o retorno do checkout. Assim que o webhook de
          pagamento for processado, o curso aparecerá como liberado na sua
          vitrine.
        </p>
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
