import { PageContainer } from "@/components/page-container";
import { getAdminBannersData } from "@/features/admin/server";
import { BannerGallery } from "./banner-gallery";

export const dynamic = "force-dynamic";

export default async function AdminBannersPage(): Promise<React.JSX.Element> {
  const data = await getAdminBannersData();

  const sortedBanners = [...data.banners].sort(
    (a, b) => a.sortOrder - b.sortOrder
  );

  return (
    <PageContainer>
      <div className="flex flex-col gap-8">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-bold text-3xl tracking-tight">
              Banners do Dashboard
            </h1>
            <p className="mt-2 max-w-2xl text-muted-foreground text-sm">
              Configure os banners rotativos exibidos na página inicial da área
              do aluno. Arraste para reordenar. (Máx. 5 imagens)
            </p>
          </div>
        </header>

        <section>
          <BannerGallery initialBanners={sortedBanners} />
        </section>
      </div>
    </PageContainer>
  );
}
