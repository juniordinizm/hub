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
        <Badge variant="outline">Compra confirmada</Badge>
        <h1 className="mt-4 font-bold text-2xl tracking-tight">
          Seu acesso está quase pronto
        </h1>
        <p className="mt-3 text-muted-foreground text-sm leading-6">
          Obrigado pela compra. Em instantes o curso aparecerá liberado na sua
          área de cursos. Se isso não acontecer automaticamente, aguarde um
          momento e atualize a página.
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
