import Link from "next/link";
import { PageContainer } from "@/components/page-container";
import { Button } from "@/components/ui/button";
import { route } from "@/lib/routes";

export default function CheckoutCancelledPage(): React.JSX.Element {
  return (
    <PageContainer className="min-h-screen bg-background text-foreground">
      <main className="max-w-2xl rounded-lg border bg-card p-6">
        <h1 className="font-bold text-2xl tracking-tight">
          Checkout cancelado
        </h1>
        <p className="mt-3 text-muted-foreground text-sm leading-6">
          Nenhuma confirmação de pagamento foi recebida. Você pode voltar e
          iniciar uma nova tentativa quando quiser.
        </p>
        <Button asChild className="mt-6">
          <Link href={route("/")}>Voltar ao início</Link>
        </Button>
      </main>
    </PageContainer>
  );
}
