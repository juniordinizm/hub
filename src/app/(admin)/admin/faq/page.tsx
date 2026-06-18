import { Badge } from "@/components/ui/badge";
import { getAdminManagementData } from "@/features/admin/server";
import { FaqCreateDialog } from "./faq-dialogs";
import { FaqTable } from "./faq-table";

export const dynamic = "force-dynamic";

export default async function AdminFaqPage(): Promise<React.JSX.Element> {
  const data = await getAdminManagementData();

  return (
    <main className="px-6 py-8 sm:px-10 lg:px-12">
      <div className="flex flex-col gap-8">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <Badge variant="outline">FAQ</Badge>
            <h1 className="mt-3 font-bold text-3xl tracking-tight">
              Perguntas frequentes
            </h1>
            <p className="mt-2 max-w-2xl text-muted-foreground text-sm">
              Conteudo exibido na area do aluno para reduzir duvidas
              operacionais.
            </p>
          </div>
          <FaqCreateDialog />
        </header>

        <section>
          <FaqTable faqs={data.faqs} />
        </section>
      </div>
    </main>
  );
}
