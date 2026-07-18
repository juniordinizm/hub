import { getAdminBannersData } from "@/features/admin/server";
import { BannerCreateDialog } from "./banner-dialogs";
import { BannerTable } from "./banner-table";

export const dynamic = "force-dynamic";

export default async function AdminBannersPage(): Promise<React.JSX.Element> {
  const data = await getAdminBannersData();

  const sortedBanners = [...data.banners].sort(
    (a, b) => a.sortOrder - b.sortOrder
  );

  return (
    <main className="px-6 py-8 sm:px-10 lg:px-12">
      <div className="flex flex-col gap-8">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-bold text-3xl tracking-tight">
              Banners do Dashboard
            </h1>
            <p className="mt-2 max-w-2xl text-muted-foreground text-sm">
              Configure os banners rotativos exibidos na página inicial da área
              do aluno. (Máx. 5 imagens)
            </p>
          </div>
          <BannerCreateDialog />
        </header>

        <section>
          <BannerTable banners={sortedBanners} />
        </section>
      </div>
    </main>
  );
}
