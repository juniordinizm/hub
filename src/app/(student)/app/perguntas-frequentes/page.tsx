import { WhatsappIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  getPublishedFaqItems,
  getSupportWhatsappUrl,
} from "@/features/courses/server";

export const dynamic = "force-dynamic";

export default async function StudentFaqPage(): Promise<React.JSX.Element> {
  const [faqs, supportWhatsappUrl] = await Promise.all([
    getPublishedFaqItems(),
    getSupportWhatsappUrl(),
  ]);

  return (
    <main className="min-h-screen px-6 py-9 sm:px-10 lg:px-12">
      <div className="mx-auto max-w-4xl">
        <header>
          <p className="font-semibold text-accent text-xs uppercase tracking-[0.14em]">
            Suporte
          </p>
          <h1 className="mt-3 font-bold text-3xl tracking-tight">
            Perguntas frequentes
          </h1>
          <p className="mt-2 max-w-2xl text-muted-foreground text-sm">
            Respostas rápidas sobre acesso, progresso, certificado e uso da
            plataforma.
          </p>
        </header>

        <div className="mt-8 grid gap-5">
          {faqs.map((faq) => (
            <Card key={faq.id}>
              <CardHeader>
                <CardDescription>{faq.category}</CardDescription>
                <CardTitle className="text-base">{faq.question}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-sm leading-7">
                  {faq.answer}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        {supportWhatsappUrl ? (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Precisa de ajuda?</CardTitle>
              <CardDescription>
                Fale com o suporte pelo WhatsApp.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild>
                <a
                  className="gap-2"
                  href={supportWhatsappUrl}
                  rel="noopener"
                  target="_blank"
                >
                  <HugeiconsIcon
                    icon={WhatsappIcon}
                    size={18}
                    strokeWidth={2}
                  />
                  Falar com suporte
                </a>
              </Button>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </main>
  );
}
