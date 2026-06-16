import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { saveFaqAction } from "@/features/admin/actions";
import { getAdminManagementData } from "@/features/admin/server";

export const dynamic = "force-dynamic";

export default async function AdminFaqPage(): Promise<React.JSX.Element> {
  const data = await getAdminManagementData();

  return (
    <div className="space-y-8">
      <header>
        <Badge variant="outline">FAQ</Badge>
        <h1 className="mt-3 font-bold text-3xl tracking-tight">
          Perguntas frequentes
        </h1>
        <p className="mt-2 max-w-2xl text-muted-foreground text-sm">
          Conteúdo exibido na área da aluna para reduzir dúvidas operacionais.
        </p>
      </header>

      <section className="grid gap-6 lg:grid-cols-[420px_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Nova pergunta</CardTitle>
            <CardDescription>
              Cadastre uma resposta curta e objetiva.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={saveFaqAction}>
              <FieldGroup>
                <input name="faqId" type="hidden" />
                <Field>
                  <FieldLabel>Pergunta</FieldLabel>
                  <Input name="question" required />
                </Field>
                <Field>
                  <FieldLabel>Resposta</FieldLabel>
                  <Textarea name="answer" required />
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field>
                    <FieldLabel>Categoria</FieldLabel>
                    <Input name="category" />
                  </Field>
                  <Field>
                    <FieldLabel>Ordem</FieldLabel>
                    <Input name="sortOrder" type="number" />
                  </Field>
                </div>
                <label
                  className="inline-flex items-center gap-2 text-sm"
                  htmlFor="faq-is-published"
                >
                  <Checkbox
                    defaultChecked
                    id="faq-is-published"
                    name="isPublished"
                  />
                  Publicado
                </label>
                <Button type="submit">Salvar FAQ</Button>
              </FieldGroup>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Itens cadastrados</CardTitle>
            <CardDescription>Lista do que aparece para alunas.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {data.faqs.map((faq) => (
              <div className="rounded-lg border p-3" key={faq.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">{faq.question}</p>
                    <p className="mt-1 text-muted-foreground text-sm">
                      {faq.answer}
                    </p>
                  </div>
                  <Badge variant={faq.isPublished ? "default" : "outline"}>
                    {faq.isPublished ? "publicado" : "oculto"}
                  </Badge>
                </div>
                <p className="mt-3 text-muted-foreground text-xs">
                  {faq.category} - ordem {faq.sortOrder}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
