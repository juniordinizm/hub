import { redirect } from "next/navigation";
import { SupportRequestDialog } from "@/components/support-request-dialog";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
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
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
        <header className="border-b pb-6">
          <div className="flex flex-col gap-4">
            <div className="space-y-1">
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

        <div className="flex flex-col gap-6">
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
            <Accordion
              className="w-full"
              collapsible
              defaultValue={faqs[0]?.id ?? ""}
              type="single"
            >
              {faqs.map((faq) => (
                <AccordionItem key={faq.id} value={faq.id}>
                  <AccordionTrigger className="text-left text-base">
                    {faq.question}
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground text-sm leading-7">
                    {faq.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          )}

          <div className="flex justify-end">
            <SupportRequestDialog triggerLabel="Falar com suporte" />
          </div>
        </div>
      </div>
    </main>
  );
}
