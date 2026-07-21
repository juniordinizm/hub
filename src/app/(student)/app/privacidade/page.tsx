import { setLearningAnalyticsConsentAction } from "@/app/(student)/app/actions";
import { PageContainer } from "@/components/page-container";
import { Button } from "@/components/ui/button";
import { getLearningAnalyticsConsent } from "@/features/learning-analytics/server";
import { requireSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function StudentPrivacyPage(): Promise<React.JSX.Element> {
  const session = await requireSession();
  const consented = await getLearningAnalyticsConsent({
    userId: session.user.id,
  });

  return (
    <PageContainer>
      <div className="max-w-2xl space-y-6">
        <header className="space-y-2">
          <h1 className="font-bold text-3xl tracking-tight">Privacidade</h1>
          <p className="text-muted-foreground">
            Controle o uso opcional de dados mínimos de aprendizagem.
          </p>
        </header>
        <section className="space-y-4 rounded-lg border bg-card p-6">
          <div className="space-y-2">
            <h2 className="font-semibold text-lg">
              Melhoria da experiência de aprendizagem
            </h2>
            <p className="text-muted-foreground text-sm">
              Com sua autorização, registramos início, faixas de progresso de
              vídeo, conclusão e falhas técnicas. Não gravamos comentários,
              texto assistido, replay de sessão, endereço IP ou um perfil de
              comportamento.
            </p>
            <p className="text-muted-foreground text-sm">
              Esses registros ajudam a identificar aulas com problema. Eles não
              alteram seu acesso, progresso ou certificado e podem ser
              desativados a qualquer momento.
            </p>
          </div>
          <form action={setLearningAnalyticsConsentAction}>
            <input
              name="consented"
              type="hidden"
              value={consented ? "false" : "true"}
            />
            <Button type="submit" variant={consented ? "outline" : "default"}>
              {consented
                ? "Desativar análise opcional"
                : "Autorizar análise opcional"}
            </Button>
          </form>
          <p className="text-muted-foreground text-xs">
            Estado atual: {consented ? "autorizado" : "não autorizado"}.
          </p>
        </section>
      </div>
    </PageContainer>
  );
}
