import "server-only";
import { getPool } from "@/db";
import type { AdminBanner } from "@/features/admin/server";
import { getPublicMediaUrl } from "@/features/storage/r2";

export const getActiveBannersData = async (): Promise<{
  banners: AdminBanner[];
}> => {
  const { rows } = await getPool().query<{
    blur_data_url: string | null;
    id: string;
    image_url: string;
    link_url: string | null;
    button_text: string | null;
    is_active: boolean;
    sort_order: number;
  }>(
    "select id, image_url, blur_data_url, link_url, button_text, is_active, sort_order from dashboard_banners where is_active = true order by sort_order"
  );

  const banners = rows.map((row) => ({
    blurDataUrl: row.blur_data_url,
    id: row.id,
    imageUrl: getPublicMediaUrl(row.image_url),
    linkUrl: row.link_url,
    buttonText: row.button_text,
    isActive: row.is_active,
    sortOrder: row.sort_order,
  }));

  return { banners };
};
