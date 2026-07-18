import { getPool } from "@/db";
import {
  isCourseCoverVariant,
  parseCourseCoverImage,
} from "@/features/storage/course-cover";
import {
  createR2ObjectReadUrl,
  getPublicMediaUrl,
} from "@/features/storage/r2";
import { requireRole } from "@/lib/session";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ courseId: string; variant: string }> }
): Promise<Response> {
  const { courseId, variant } = await context.params;

  if (!isCourseCoverVariant(variant)) {
    return Response.json({ error: "Variante invalida." }, { status: 404 });
  }

  const { rows } = await getPool().query<{
    cover_image_json: unknown;
    status: string;
  }>("select cover_image_json, status from courses where id = $1 limit 1", [
    courseId,
  ]);
  const coverImage = parseCourseCoverImage(rows[0]?.cover_image_json);
  const image = coverImage?.variants[variant] ?? coverImage?.variants.card;

  if (!image) {
    return Response.json({ error: "Capa nao encontrada." }, { status: 404 });
  }

  if (rows[0]?.status === "active") {
    return Response.redirect(getPublicMediaUrl(image.key), 302);
  }

  await requireRole(["admin", "support"]);

  const signedUrl = await createR2ObjectReadUrl({ key: image.key });

  return new Response(null, {
    headers: {
      "Cache-Control": "public, max-age=300",
      Location: signedUrl,
    },
    status: 302,
  });
}
