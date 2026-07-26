import { createStagedAdminImageUploadUrl } from "@/features/storage/r2";
import {
  isStagedAdminImagePurpose,
  parseStagedAdminImageReference,
} from "@/features/storage/staged-image-upload";
import { registerStagedAdminImageUpload } from "@/features/storage/staged-image-upload-registry";
import { requireRole } from "@/lib/session";

export const runtime = "nodejs";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

export const POST = async (request: Request): Promise<Response> => {
  const session = await requireRole(["admin"]);
  const body: unknown = await request.json();

  if (!isRecord(body)) {
    return Response.json({ error: "Dados invalidos." }, { status: 400 });
  }

  const { aggregateId, contentType, fileName, purpose, sizeBytes } = body;
  if (
    typeof aggregateId !== "string" ||
    typeof contentType !== "string" ||
    typeof fileName !== "string" ||
    typeof purpose !== "string" ||
    !isStagedAdminImagePurpose(purpose) ||
    typeof sizeBytes !== "number"
  ) {
    return Response.json({ error: "Dados invalidos." }, { status: 400 });
  }

  try {
    const prepared = await createStagedAdminImageUploadUrl({
      actorUserId: session.user.id,
      aggregateId,
      contentType,
      fileName,
      purpose,
      sizeBytes,
    });
    const reference = parseStagedAdminImageReference(prepared.reference);
    if (!reference) {
      throw new Error("Upload temporario invalido.");
    }
    await registerStagedAdminImageUpload({
      actorUserId: session.user.id,
      reference,
    });
    return Response.json(prepared);
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Nao foi possivel preparar o upload.",
      },
      { status: 400 }
    );
  }
};
