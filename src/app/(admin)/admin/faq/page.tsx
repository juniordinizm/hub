import { PageContainer } from "@/components/page-container";
import { getAdminFaqData } from "@/features/admin/server";
import { FaqCreateDialog } from "./faq-dialogs";
import { FaqTable } from "./faq-table";

export const dynamic = "force-dynamic";

export default async function AdminFaqPage(): Promise<React.JSX.Element> {
  const data = await getAdminFaqData();

  const sortedFaqs = [...data.faqs].sort((a, b) => a.sortOrder - b.sortOrder);
  const nextSortOrder =
    sortedFaqs.length > 0
      ? Math.max(...sortedFaqs.map((f) => f.sortOrder)) + 1
      : 1;

  return (
    <PageContainer>
      <div className="flex flex-col gap-8">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-bold text-3xl tracking-tight">
              Perguntas frequentes
            </h1>
            <p className="mt-2 max-w-2xl text-muted-foreground text-sm">
              Conteudo exibido na area do aluno para reduzir duvidas
              operacionais.
            </p>
          </div>
          <FaqCreateDialog nextSortOrder={nextSortOrder} />
        </header>

        <section>
          <FaqTable faqs={sortedFaqs} />
        </section>
      </div>
    </PageContainer>
  );
}
