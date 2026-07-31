import Link from "next/link";
import { PageContainer } from "@/components/page-container";
import { Button } from "@/components/ui/button";
import { resolveCheckoutRetryPath } from "@/features/payments/checkout";
import { route } from "@/lib/routes";

interface CheckoutExpiredPageProps {
  searchParams: Promise<{ attemptId?: string }>;
}

export default async function CheckoutExpiredPage({
  searchParams,
}: CheckoutExpiredPageProps): Promise<React.JSX.Element> {
  const { attemptId } = await searchParams;
  const retryPath = await resolveCheckoutRetryPath(attemptId);

  return (
    <PageContainer className="min-h-screen bg-background text-foreground">
      <main className="max-w-2xl rounded-lg border bg-card p-6">
        <h1 className="font-bold text-2xl tracking-tight">Checkout expirado</h1>
        <p className="mt-3 text-muted-foreground text-sm leading-6">
          {retryPath
            ? "O prazo desta tentativa terminou sem confirmação. Volte ao curso para iniciar um novo checkout."
            : "Não encontramos esta tentativa. Entre no Hub ou fale com o suporte para continuar."}
        </p>
        <Button asChild className="mt-6">
          <Link href={route(retryPath ?? "/entrar")}>
            {retryPath ? "Tentar novamente" : "Ir para login"}
          </Link>
        </Button>
      </main>
    </PageContainer>
  );
}
