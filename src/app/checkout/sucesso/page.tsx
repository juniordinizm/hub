import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { route } from "@/lib/routes";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

export default function PublicCheckoutSuccessPage(): React.JSX.Element {
  return (
    <main className="min-h-screen bg-background px-6 py-10 text-foreground sm:px-10 lg:px-12">
      <section className="max-w-2xl rounded-lg border bg-card p-6">
        <Badge variant="outline">Pagamento em confirmacao</Badge>
        <h1 className="mt-4 font-bold text-2xl tracking-tight">
          Seu acesso esta sendo preparado
        </h1>
        <p className="mt-3 text-muted-foreground text-sm leading-6">
          Assim que o pagamento for confirmado, enviaremos as instrucoes de
          acesso para o e-mail usado na compra. Se esta for sua primeira compra,
          o e-mail tera um link para criar sua senha.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button asChild>
            <Link href={route("/entrar")}>Ir para login</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={route("/recuperar-senha")}>Reenviar acesso</Link>
          </Button>
        </div>
      </section>
    </main>
  );
}
