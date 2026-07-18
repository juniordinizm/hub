import { NextResponse } from "next/server";
import { getPool } from "@/db";
import { createR2ObjectReadUrl } from "@/features/storage/r2";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ bannerId: string }> }
): Promise<NextResponse> {
  const { bannerId } = await params;

  const { rows } = await getPool().query<{ image_url: string }>(
    "select image_url from dashboard_banners where id = $1",
    [bannerId]
  );

  const banner = rows[0];

  if (!banner?.image_url) {
    return new NextResponse("Not Found", { status: 404 });
  }

  const signedUrl = await createR2ObjectReadUrl({ key: banner.image_url });

  return NextResponse.redirect(signedUrl);
}
