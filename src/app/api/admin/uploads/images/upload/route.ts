import { uploadStagedAdminImageFile } from "@/features/storage/r2";
import {
  parseStagedAdminImageReference,
  type StagedAdminImageReference,
} from "@/features/storage/staged-image-upload";
import { confirmStagedAdminImageUpload } from "@/features/storage/staged-image-upload-registry";
import { requireRole } from "@/lib/session";

export const runtime = "nodejs";

export const POST = async (request: Request): Promise<Response> => {
  const session = await requireRole(["admin"]);
  const formData = await request.formData();
  const file = formData.get("file");
  const referenceValue = formData.get("reference");
  let reference: StagedAdminImageReference | null = null;
  if (typeof referenceValue === "string") {
    try {
      reference = parseStagedAdminImageReference(JSON.parse(referenceValue));
    } catch {
      reference = null;
    }
  }

  if (!(file instanceof File && reference)) {
    return Response.json({ error: "Dados invalidos." }, { status: 400 });
  }

  try {
    await uploadStagedAdminImageFile({
      actorUserId: session.user.id,
      file,
      reference,
    });
    await confirmStagedAdminImageUpload({
      actorUserId: session.user.id,
      reference,
    });
    return Response.json({ reference });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Nao foi possivel enviar a imagem.",
      },
      { status: 400 }
    );
  }
};
