import { HelpCircleIcon, Shield01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { redirect } from "next/navigation";
import { SupportRequestDialog } from "@/components/support-request-dialog";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { canMutateStudentExperience } from "@/features/courses/preview";
import { getPublishedFaqItems } from "@/features/courses/server";
import { route } from "@/lib/routes";
import { requireSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function StudentFaqPage(): Promise<React.JSX.Element> {
  const session = await requireSession();

  if (!canMutateStudentExperience(session.role)) {
    redirect(route("/admin"));
  }

  const faqs = await getPublishedFaqItems();

  return (
    <main className="min-h-screen bg-background px-6 py-8 text-foreground sm:px-10 lg:px-12">
      <div className="flex flex-col gap-8">
        <header className="border-b pb-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex-1 space-y-1">
              <h1 className="font-bold text-3xl tracking-tight">
                Perguntas frequentes
              </h1>
              <p className="text-muted-foreground text-sm">
                Respostas rápidas sobre acesso, pagamento, progresso,
                certificados e uso da plataforma.
              </p>
            </div>
          </div>
        </header>

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
          <div className="flex flex-col gap-8">
            {faqs.length === 0 ? (
              <Card>
                <CardHeader>
                  <CardDescription>FAQ</CardDescription>
                  <CardTitle>Nenhuma pergunta publicada</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground text-sm leading-6">
                    Quando a equipe publicar respostas, elas aparecerão aqui.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <section className="flex flex-col gap-3">
                <div className="grid gap-3">
                  {faqs.map((faq) => (
                    <Card key={faq.id} size="sm">
                      <CardHeader>
                        <CardTitle className="flex items-start gap-3 text-base">
                          <HugeiconsIcon
                            className="mt-0.5 text-primary"
                            icon={HelpCircleIcon}
                          />
                          {faq.question}
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-muted-foreground text-sm leading-7">
                          {faq.answer}
                        </p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </section>
            )}
          </div>

          <aside className="lg:sticky lg:top-6">
            <Card>
              <CardHeader>
                <CardDescription>Atendimento</CardDescription>
                <CardTitle>Precisa de ajuda?</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col gap-3 text-muted-foreground text-sm leading-6">
                  <p>
                    Se a resposta não estiver aqui, envie uma mensagem para o
                    suporte com seu e-mail de acesso e o nome do curso.
                  </p>
                  <div className="rounded-md border bg-background/45 p-3">
                    <div className="flex items-center gap-2 font-medium text-foreground">
                      <HugeiconsIcon icon={Shield01Icon} />
                      Acesso e pagamento
                    </div>
                    <p className="mt-1">
                      Tenha em mãos comprovante, pedido ou e-mail usado na
                      compra.
                    </p>
                  </div>
                </div>
                <SupportRequestDialog
                  triggerClassName="mt-5 w-full"
                  triggerLabel="Falar com suporte"
                />
              </CardContent>
            </Card>
          </aside>
        </div>
      </div>
    </main>
  );
}
