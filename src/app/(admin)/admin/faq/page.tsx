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
import { deleteFaqAction, saveFaqAction } from "@/features/admin/actions";
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

        <section className="space-y-3">
          {data.faqs.map((faq) => (
            <details className="rounded-lg border bg-card" key={faq.id}>
              <summary className="cursor-pointer list-none p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">{faq.question}</p>
                    <p className="mt-1 text-muted-foreground text-xs">
                      {faq.category} - ordem {faq.sortOrder}
                    </p>
                  </div>
                  <Badge variant={faq.isPublished ? "default" : "outline"}>
                    {faq.isPublished ? "publicado" : "oculto"}
                  </Badge>
                </div>
              </summary>
              <div className="border-t p-4">
                <div className="space-y-4">
                  <form action={saveFaqAction}>
                    <FieldGroup>
                      <input name="faqId" type="hidden" value={faq.id} />
                      <Field>
                        <FieldLabel>Pergunta</FieldLabel>
                        <Input
                          defaultValue={faq.question}
                          name="question"
                          required
                        />
                      </Field>
                      <Field>
                        <FieldLabel>Resposta</FieldLabel>
                        <Textarea
                          defaultValue={faq.answer}
                          name="answer"
                          required
                        />
                      </Field>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <Field>
                          <FieldLabel>Categoria</FieldLabel>
                          <Input defaultValue={faq.category} name="category" />
                        </Field>
                        <Field>
                          <FieldLabel>Ordem</FieldLabel>
                          <Input
                            defaultValue={faq.sortOrder}
                            name="sortOrder"
                            type="number"
                          />
                        </Field>
                      </div>
                      <label
                        className="inline-flex items-center gap-2 text-sm"
                        htmlFor={`faq-is-published-${faq.id}`}
                      >
                        <Checkbox
                          defaultChecked={faq.isPublished}
                          id={`faq-is-published-${faq.id}`}
                          name="isPublished"
                        />
                        Publicado
                      </label>
                      <Button className="w-fit" type="submit">
                        Salvar pergunta
                      </Button>
                    </FieldGroup>
                  </form>
                  <form action={deleteFaqAction}>
                    <input name="faqId" type="hidden" value={faq.id} />
                    <Button size="sm" type="submit" variant="destructive">
                      Excluir pergunta
                    </Button>
                  </form>
                </div>
              </div>
            </details>
          ))}
        </section>
      </section>
    </div>
  );
}
