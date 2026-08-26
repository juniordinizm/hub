"use client";

import type {
  StagedAdminImagePurpose,
  StagedAdminImageReference,
} from "@/features/storage/staged-image-upload";

interface PreparedStagedAdminImageUpload {
  reference: StagedAdminImageReference;
  uploadUrl: string;
}

const readErrorMessage = async (response: Response): Promise<string> => {
  const body: unknown = await response.json().catch(() => null);
  if (
    body &&
    typeof body === "object" &&
    "error" in body &&
    typeof body.error === "string"
  ) {
    return body.error;
  }

  return "Nao foi possivel enviar a imagem.";
};

export const uploadStagedAdminImage = async ({
  aggregateId,
  file,
  purpose,
}: {
  aggregateId: string;
  file: File;
  purpose: StagedAdminImagePurpose;
}): Promise<StagedAdminImageReference> => {
  const preparation = await fetch("/api/admin/uploads/images/prepare", {
    body: JSON.stringify({
      aggregateId,
      contentType: file.type,
      fileName: file.name,
      purpose,
      sizeBytes: file.size,
    }),
    headers: { "content-type": "application/json" },
    method: "POST",
  });

  if (!preparation.ok) {
    throw new Error(await readErrorMessage(preparation));
  }

  const prepared = (await preparation.json()) as PreparedStagedAdminImageUpload;
  let directUploadSucceeded = false;
  try {
    const upload = await fetch(prepared.uploadUrl, {
      body: file,
      headers: { "content-type": file.type },
      method: "PUT",
    });
    directUploadSucceeded = upload.ok;
  } catch {
    directUploadSucceeded = false;
  }

  if (!directUploadSucceeded) {
    const formData = new FormData();
    formData.set("file", file);
    formData.set("reference", JSON.stringify(prepared.reference));
    const fallbackUpload = await fetch("/api/admin/uploads/images/upload", {
      body: formData,
      method: "POST",
    });

    if (!fallbackUpload.ok) {
      throw new Error(await readErrorMessage(fallbackUpload));
    }

    const fallbackConfirmed = (await fallbackUpload.json()) as {
      reference: StagedAdminImageReference;
    };
    return fallbackConfirmed.reference;
  }

  const confirmation = await fetch("/api/admin/uploads/images/confirm", {
    body: JSON.stringify({ reference: prepared.reference }),
    headers: { "content-type": "application/json" },
    method: "POST",
  });
  if (!confirmation.ok) {
    throw new Error(await readErrorMessage(confirmation));
  }

  const confirmed = (await confirmation.json()) as {
    reference: StagedAdminImageReference;
  };
  return confirmed.reference;
};
