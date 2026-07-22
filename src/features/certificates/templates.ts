import "server-only";
import { randomUUID } from "node:crypto";
import { getPool } from "@/db";
import {
  createR2ObjectReadUrl,
  uploadPrivateR2Object,
} from "@/features/storage/r2";
import { requireRole } from "@/lib/session";
import { parseCertificateTemplateDraft } from "./render-snapshot";
import {
  normalizeCertificateBackground,
  normalizeCertificateSignature,
} from "./template-image";
import type { CertificateTemplateSpec } from "./template-rules";
import { validateCertificateTemplate } from "./template-rules";

export const uploadCertificateBackground = async ({
  courseId,
  file,
}: {
  courseId: string;
  file: File;
}): Promise<string> => {
  const image = await normalizeCertificateBackground(file);
  if (
    !(
      file.type === "image/png" ||
      file.type === "image/jpeg" ||
      file.type === "image/webp"
    ) ||
    file.size > 10 * 1024 * 1024
  ) {
    throw new Error("Envie uma imagem PNG, JPEG ou WebP de até 10 MiB.");
  }
  const key = `certificates/templates/${courseId}/${randomUUID()}.webp`;
  await uploadPrivateR2Object({
    body: image.body,
    contentType: image.contentType,
    key,
  });
  return key;
};

export const uploadCertificateSignature = async ({
  courseId,
  file,
}: {
  courseId: string;
  file: File;
}): Promise<string> => {
  const image = await normalizeCertificateSignature(file);
  if (
    !(
      file.type === "image/png" ||
      file.type === "image/jpeg" ||
      file.type === "image/webp"
    ) ||
    file.size > 2 * 1024 * 1024
  ) {
    throw new Error(
      "Envie a assinatura visual em PNG, JPEG ou WebP de ate 2 MiB."
    );
  }
  const key = `certificates/templates/${courseId}/signatures/${randomUUID()}.webp`;
  await uploadPrivateR2Object({
    body: image.body,
    contentType: image.contentType,
    key,
  });
  return key;
};

export const saveCertificateTemplateDraft = async ({
  courseId,
  signerName,
  signerRole,
  signatureKey,
  spec,
}: {
  courseId: string;
  signerName: string | null;
  signerRole: string | null;
  signatureKey: string | null;
  spec: CertificateTemplateSpec;
}): Promise<void> => {
  const errors = validateCertificateTemplate(spec);
  if (errors.length) {
    throw new Error(errors[0]);
  }
  const updated = await getPool().query(
    `
      update certificate_templates
      set background_key = $2, spec = $3::jsonb, signer_name = $4, signer_role = $5,
          signature_key = $6, updated_at = now()
      where course_id = $1 and status = 'draft'
    `,
    [
      courseId,
      spec.backgroundKey,
      JSON.stringify(spec),
      signerName,
      signerRole,
      signatureKey,
    ]
  );
  if (updated.rowCount) {
    return;
  }
  await getPool().query(
    `insert into certificate_templates (course_id, version, status, background_key, spec, signer_name, signer_role, signature_key)
     values ($1, coalesce((select max(version) + 1 from certificate_templates where course_id = $1), 1), 'draft', $2, $3::jsonb, $4, $5, $6)`,
    [
      courseId,
      spec.backgroundKey,
      JSON.stringify(spec),
      signerName,
      signerRole,
      signatureKey,
    ]
  );
};

export interface CertificateTemplateSummary {
  backgroundKey: string;
  backgroundUrl: string;
  id: string;
  signatureKey: string | null;
  signatureUrl: string | null;
  signerName: string | null;
  signerRole: string | null;
  spec: CertificateTemplateSpec;
  status: "draft" | "published" | "superseded";
  version: number;
}

export const getCertificateTemplatesForCourse = async (
  courseId: string
): Promise<CertificateTemplateSummary[]> => {
  await requireRole(["admin"]);
  const { rows } = await getPool().query<{
    background_key: string;
    id: string;
    signer_name: string | null;
    signer_role: string | null;
    signature_key: string | null;
    spec: unknown;
    status: "draft" | "published" | "superseded";
    version: number;
  }>(
    `select id, version, status, background_key, spec, signer_name, signer_role, signature_key
     from certificate_templates
     where course_id = $1
     order by version desc`,
    [courseId]
  );
  return await Promise.all(
    rows.map(async (row) => ({
      backgroundKey: row.background_key,
      backgroundUrl: await createR2ObjectReadUrl({ key: row.background_key }),
      id: row.id,
      signerName: row.signer_name,
      signerRole: row.signer_role,
      signatureKey: row.signature_key,
      signatureUrl: row.signature_key
        ? await createR2ObjectReadUrl({ key: row.signature_key })
        : null,
      spec: parseCertificateTemplateDraft(row.spec),
      status: row.status,
      version: row.version,
    }))
  );
};

export const hasCertificateIssuerProfile = async (): Promise<boolean> => {
  await requireRole(["admin"]);
  const result = await getPool().query<{ id: string }>(
    "select id from certificate_issuer_profiles where id = 'global' limit 1"
  );

  return Boolean(result.rows[0]);
};

export const publishCertificateTemplate = async (
  courseId: string
): Promise<void> => {
  const client = await getPool().connect();
  try {
    await client.query("begin");
    const issuer = await client.query<{ id: string }>(
      "select id from certificate_issuer_profiles where id = 'global' for share"
    );
    if (!issuer.rows[0]) {
      throw new Error(
        "Preencha o perfil emissor em Configuracoes antes de publicar o certificado."
      );
    }
    const draft = await client.query<{ id: string }>(
      "select id from certificate_templates where course_id = $1 and status = 'draft' for update",
      [courseId]
    );
    if (!draft.rows[0]) {
      throw new Error(
        "Crie e salve um rascunho de certificado antes de publicar."
      );
    }
    await client.query(
      "update certificate_templates set status = 'superseded', updated_at = now() where course_id = $1 and status = 'published'",
      [courseId]
    );
    await client.query(
      "update certificate_templates set status = 'published', published_at = now(), updated_at = now() where id = $1",
      [draft.rows[0].id]
    );
    await client.query(
      "update courses set certificate_enabled = true, updated_at = now() where id = $1",
      [courseId]
    );
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
};

export const disableCertificateForCourse = async (
  courseId: string
): Promise<void> => {
  await getPool().query(
    "update courses set certificate_enabled = false, updated_at = now() where id = $1",
    [courseId]
  );
};
