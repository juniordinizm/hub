import { NextResponse } from "next/server";
import { getPool } from "@/db";
import {
  createR2ObjectReadUrl,
  verifyPrivateR2ObjectSha256,
} from "@/features/storage/r2";
import { canPerform } from "@/lib/auth-policy";
import { requireSession } from "@/lib/session";

export const GET = async (
  _request: Request,
  { params }: { params: Promise<{ code: string }> }
) => {
  const session = await requireSession();
  const { code } = await params;
  const canManageCertificates = canPerform(session.role, "manageCertificates");
  const result = await getPool().query<{
    pdf_sha256: string | null;
    pdf_storage_key: string | null;
  }>(
    `select pdf_sha256, pdf_storage_key from certificates where code = $1 and status = 'valid' and render_status = 'ready' and ($2::boolean or user_id = $3) limit 1`,
    [code, canManageCertificates, session.user.id]
  );
  const certificate = result.rows[0];
  const key = certificate?.pdf_storage_key;
  if (!key) {
    return new NextResponse(null, { status: 404 });
  }

  if (certificate.pdf_sha256) {
    const artifactStatus = await verifyPrivateR2ObjectSha256({
      expectedSha256: certificate.pdf_sha256,
      key,
    });
    if (
      artifactStatus === "mismatch" ||
      artifactStatus === "missing" ||
      artifactStatus === "unavailable"
    ) {
      return new NextResponse(null, {
        headers: {
          "Cache-Control": "no-store",
          "Retry-After": "60",
        },
        status: 503,
      });
    }
  }

  return NextResponse.redirect(await createR2ObjectReadUrl({ key }));
};
