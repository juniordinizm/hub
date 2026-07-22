import { InformationCircleIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { PageContainer } from "@/components/page-container";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { getLearningAnalyticsPreference } from "@/features/learning-analytics/server";
import { requireSession } from "@/lib/session";
import { AnalyticsSwitch } from "./analytics-switch";

export const dynamic = "force-dynamic";

export default async function StudentSettingsPage(): Promise<React.JSX.Element> {
  const session = await requireSession();
  const analyticsEnabled = await getLearningAnalyticsPreference({
    userId: session.user.id,
  });

  return (
    <PageContainer className="min-h-screen bg-background text-foreground">
      <div className="flex flex-col gap-8">
        <header className="border-b pb-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex-1 space-y-1">
              <h1 className="font-bold text-3xl tracking-tight">
                Configurações
              </h1>
              <p className="text-muted-foreground text-sm">
                Ajuste preferências da sua experiência na plataforma.
              </p>
            </div>
          </div>
        </header>

        <section className="grid gap-6">
          <Card className="border-none bg-card shadow-xs ring-1 ring-border/50">
            <CardHeader className="pb-4">
              <CardTitle className="font-semibold text-base">
                Privacidade e Dados
              </CardTitle>
              <CardDescription className="mt-1 text-sm">
                Gerencie como seus dados de uso são coletados e utilizados.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="divide-y divide-border/60 overflow-hidden rounded-xl border bg-background/50">
                <div className="flex flex-col justify-between gap-4 p-4 transition-colors hover:bg-muted/20 sm:flex-row sm:items-center sm:p-5">
                  <div className="max-w-xl space-y-1">
                    <div className="flex items-center gap-1.5">
                      <h3 className="font-medium text-foreground text-sm sm:text-base">
                        Melhoria das aulas
                      </h3>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              aria-label="Mais informações sobre melhoria das aulas"
                              className="inline-flex cursor-help items-center text-muted-foreground transition-colors hover:text-foreground"
                              type="button"
                            >
                              <HugeiconsIcon
                                icon={InformationCircleIcon}
                                size={16}
                              />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent
                            className="max-w-xs p-3 text-xs leading-normal"
                            side="top"
                          >
                            <p>
                              Coletamos dados mínimos de uso (progresso e falhas
                              técnicas) apenas para aprimorar as aulas. Ao
                              desativar, os registros identificáveis são
                              removidos. Saiba mais em nossa{" "}
                              <a
                                className="font-medium underline hover:text-foreground"
                                href="/politica-de-privacidade"
                              >
                                política de privacidade
                              </a>
                              .
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                    <p className="text-muted-foreground text-xs sm:text-sm">
                      Permite coletar métricas anônimas de uso para identificar
                      e corrigir falhas nas aulas.
                    </p>
                  </div>
                  <div className="shrink-0">
                    <AnalyticsSwitch enabled={analyticsEnabled} />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>
      </div>
    </PageContainer>
  );
}
