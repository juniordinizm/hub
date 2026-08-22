import "server-only";
import { getPool } from "@/db";
import {
  createR2ObjectReadUrl,
  deleteR2Objects,
  type PrivateR2ObjectHashStatus,
  uploadPrivateR2Object,
  verifyPrivateR2ObjectSha256,
} from "@/features/storage/r2";
import { getServerEnv } from "@/lib/env";
import { renderCertificatePreview } from "./preview";
import { parseCertificateRenderSnapshot } from "./render-snapshot";

const previewKeyForCertificate = (certificateId: string): string =>
  `certificates/${certificateId}/certificate-preview.png`;

const regeneratePreview = async ({
  certificate,
  certificateId,
  removeStaleObject,
}: {
  certificate: { render_snapshot: unknown };
  certificateId: string;
  removeStaleObject: boolean;
}): Promise<void> => {
  const key = previewKeyForCertificate(certificateId);
  if (removeStaleObject) {
    await deleteR2Objects([key]);
  }

  const snapshot = parseCertificateRenderSnapshot(certificate.render_snapshot);
  const backgroundUrl = await createR2ObjectReadUrl({
    key: snapshot.template.backgroundKey,
    responseContentDisposition: "inline",
  });
  const backgroundResponse = await fetch(backgroundUrl);
  if (!backgroundResponse.ok) {
    throw new Error("certificate_preview_background_unavailable");
  }

  const signatureResponse = snapshot.template.signatureKey
    ? await fetch(
        await createR2ObjectReadUrl({
          key: snapshot.template.signatureKey,
          responseContentDisposition: "inline",
        })
      )
    : null;
  if (snapshot.template.signatureKey && !signatureResponse?.ok) {
    throw new Error("certificate_preview_signature_unavailable");
  }

  const preview = await renderCertificatePreview({
    background: Buffer.from(await backgroundResponse.arrayBuffer()),
    publicBaseUrl: getServerEnv().CERTIFICATE_PUBLIC_BASE_URL,
    signature: signatureResponse
      ? Buffer.from(await signatureResponse.arrayBuffer())
      : null,
    snapshot,
  });
  await uploadPrivateR2Object({
    body: preview.png,
    contentType: "image/png",
    key,
  });
  await getPool().query(
    "update certificates set preview_sha256 = $2, updated_at = now() where id = $1",
    [certificateId, preview.sha256]
  );
};

export const getCertificatePreviewReadUrl = async (
  code: string
): Promise<string | null> => {
  const result = await getPool().query<{
    id: string;
    preview_sha256: string | null;
    render_snapshot: unknown;
  }>(
    `
      select id, preview_sha256, render_snapshot
      from certificates
      where code = $1
        and status = 'valid'
        and render_status = 'ready'
      limit 1
    `,
    [code]
  );
  const certificate = result.rows[0];
  if (!certificate) {
    return null;
  }

  const key = previewKeyForCertificate(certificate.id);
  const readUrl = () =>
    createR2ObjectReadUrl({
      key,
      responseContentDisposition: "inline",
    });

  if (certificate.preview_sha256) {
    const status: PrivateR2ObjectHashStatus = await verifyPrivateR2ObjectSha256(
      {
        expectedSha256: certificate.preview_sha256,
        key,
      }
    );
    if (status === "match") {
      return readUrl();
    }
    if (status === "unavailable") {
      throw new Error("certificate_preview_storage_unavailable");
    }
    await regeneratePreview({
      certificate,
      certificateId: certificate.id,
      removeStaleObject: true,
    });
    return readUrl();
  }

  // Legacy previews have no canonical digest recorded; regenerate once and
  // persist the hash so later reads become verifiable.
  await regeneratePreview({
    certificate,
    certificateId: certificate.id,
    removeStaleObject: false,
  });
  return readUrl();
};
