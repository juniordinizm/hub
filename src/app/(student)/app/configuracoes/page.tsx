import {
  InformationCircleIcon,
  ShieldKeyIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { updateCertificateNameAction } from "@/app/(student)/app/actions";
import { PageContainer } from "@/components/page-container";
import { Scrollspy } from "@/components/reui/scrollspy";
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

        <div className="grid grid-cols-1 gap-14 md:grid-cols-[220px_1fr] lg:grid-cols-[240px_1fr]">
          <aside className="hidden md:block">
            <div className="sticky top-24">
              <Card className="border-none bg-card p-1.5 shadow-xs ring-1 ring-border/50">
                <Scrollspy
                  className="flex flex-col gap-1"
                  history={false}
                  offset={96}
                >
                  <a
                    className="flex items-center gap-2.5 rounded-lg px-3 py-2 font-medium text-muted-foreground text-sm transition-colors hover:bg-muted/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring data-[active=true]:bg-muted data-[active=true]:text-foreground"
                    data-scrollspy-anchor="privacidade"
                    href="#privacidade"
                  >
                    <HugeiconsIcon
                      icon={ShieldKeyIcon}
                      size={18}
                      strokeWidth={1.5}
                    />
                    <span>Privacidade e Dados</span>
                  </a>
                </Scrollspy>
              </Card>
            </div>
          </aside>

          <div className="space-y-8">
            <section className="grid scroll-mt-24 gap-6" id="certificado">
              <Card className="border-none bg-card shadow-xs ring-1 ring-border/50">
                <CardHeader>
                  <CardTitle className="font-semibold text-base">
                    Nome no certificado
                  </CardTitle>
                  <CardDescription className="text-sm">
                    Use seu nome completo. Alteracoes futuras nao modificam
                    certificados ja emitidos.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form
                    action={updateCertificateNameAction}
                    className="flex flex-col gap-3 sm:flex-row"
                  >
                    <input
                      className="min-w-0 flex-1 rounded-md border bg-background px-3 py-2 text-sm"
                      defaultValue={session.user.name ?? ""}
                      name="name"
                      required
                    />
                    <button
                      className="rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground text-sm"
                      type="submit"
                    >
                      Salvar nome
                    </button>
                  </form>
                </CardContent>
              </Card>
            </section>
            <section className="grid scroll-mt-24 gap-6" id="privacidade">
              <Card className="border-none bg-card shadow-xs ring-1 ring-border/50">
                <CardHeader>
                  <CardTitle className="font-semibold text-base">
                    Privacidade e Dados
                  </CardTitle>
                  <CardDescription className="text-sm">
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
                                  className="inline-flex cursor-help items-center rounded-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
                                sideOffset={6}
                              >
                                <p>
                                  Coletamos dados mínimos de uso (progresso e
                                  falhas técnicas) apenas para aprimorar as
                                  aulas. Ao desativar, os registros
                                  identificáveis são removidos. Saiba mais em
                                  nossa{" "}
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
                          Permite coletar métricas anônimas de uso para
                          identificar e corrigir falhas nas aulas.
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
        </div>
      </div>
    </PageContainer>
  );
}
