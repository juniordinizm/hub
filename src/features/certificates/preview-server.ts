import "server-only";
import { getPool } from "@/db";
import {
  createR2ObjectReadUrl,
  uploadPrivateR2ObjectIfAbsent,
} from "@/features/storage/r2";
import { getServerEnv } from "@/lib/env";
import { renderCertificatePreview } from "./preview";
import { parseCertificateRenderSnapshot } from "./render-snapshot";

const previewKeyForCertificate = (certificateId: string): string =>
  `certificates/${certificateId}/certificate-preview.png`;

export const getCertificatePreviewReadUrl = async (
  code: string
): Promise<string | null> => {
  const result = await getPool().query<{
    id: string;
    render_snapshot: unknown;
  }>(
    `
      select id, render_snapshot
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
  const existingUrl = await createR2ObjectReadUrl({
    key,
    responseContentDisposition: "inline",
  });
  const existingResponse = await fetch(existingUrl, {
    headers: { Range: "bytes=0-0" },
  });
  if (existingResponse.ok) {
    return existingUrl;
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
  await uploadPrivateR2ObjectIfAbsent({
    body: preview.png,
    contentType: "image/png",
    key,
    metadata: { sha256: preview.sha256 },
  });

  return await createR2ObjectReadUrl({
    key,
    responseContentDisposition: "inline",
  });
};
