import { getAdminOverview } from "@/features/admin/server";
import { formatDate } from "@/lib/formatters";

export const dynamic = "force-dynamic";

const metrics = [
  ["Cursos", "courses"],
  ["Alunas", "students"],
  ["Matriculas ativas", "activeEnrollments"],
  ["Pedidos pagos", "paidOrders"],
] as const;

export default async function AdminPage(): Promise<React.JSX.Element> {
  const overview = await getAdminOverview();

  return (
    <div>
      <p className="font-semibold text-[#326c71] text-xs uppercase tracking-[0.18em]">
        Operacao
      </p>
      <h1 className="mt-3 font-bold text-3xl tracking-tight">
        Painel administrativo
      </h1>
      <section className="mt-8 grid gap-4 md:grid-cols-4">
        {metrics.map(([label, key]) => (
          <article
            className="rounded-md border border-[#d9cbc1] bg-white p-5"
            key={key}
          >
            <p className="text-[#667b7d] text-sm">{label}</p>
            <strong className="mt-2 block text-3xl">{overview[key]}</strong>
          </article>
        ))}
      </section>
      <section className="mt-8 rounded-md border border-[#d9cbc1] bg-white">
        <div className="border-[#eadfd8] border-b p-5">
          <h2 className="font-bold text-xl">Webhooks recentes</h2>
        </div>
        <div className="divide-y divide-[#eadfd8]">
          {overview.recentWebhooks.length === 0 ? (
            <p className="p-5 text-[#667b7d] text-sm">
              Nenhum webhook recebido.
            </p>
          ) : (
            overview.recentWebhooks.map((event) => (
              <div
                className="grid gap-2 p-5 text-sm md:grid-cols-4"
                key={event.eventKey}
              >
                <span className="font-mono">{event.eventKey}</span>
                <span>{event.eventName}</span>
                <span>{event.status}</span>
                <span>{formatDate(event.createdAt)}</span>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
