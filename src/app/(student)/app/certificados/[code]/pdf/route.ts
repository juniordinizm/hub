import { NextResponse } from "next/server";
import { getPool } from "@/db";
import { createR2ObjectReadUrl } from "@/features/storage/r2";
import { canPerform } from "@/lib/auth-policy";
import { requireSession } from "@/lib/session";

export const GET = async (
  _request: Request,
  { params }: { params: Promise<{ code: string }> }
) => {
  const session = await requireSession();
  const { code } = await params;
  const canManageCertificates = canPerform(session.role, "manageCertificates");
  const result = await getPool().query<{ pdf_storage_key: string | null }>(
    `select pdf_storage_key from certificates where code = $1 and status = 'valid' and render_status = 'ready' and ($2::boolean or user_id = $3) limit 1`,
    [code, canManageCertificates, session.user.id]
  );
  const key = result.rows[0]?.pdf_storage_key;
  if (!key) {
    return new NextResponse(null, { status: 404 });
  }
  return NextResponse.redirect(await createR2ObjectReadUrl({ key }));
};
