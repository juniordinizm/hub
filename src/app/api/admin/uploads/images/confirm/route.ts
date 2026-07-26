import {
  parseStagedAdminImageReference,
  type StagedAdminImageReference,
} from "@/features/storage/staged-image-upload";
import { confirmStagedAdminImageUpload } from "@/features/storage/staged-image-upload-registry";
import { requireRole } from "@/lib/session";

export const runtime = "nodejs";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

export const POST = async (request: Request): Promise<Response> => {
  const session = await requireRole(["admin"]);
  const body: unknown = await request.json();
  const reference = isRecord(body)
    ? parseStagedAdminImageReference(body.reference)
    : null;
  if (!reference) {
    return Response.json({ error: "Dados invalidos." }, { status: 400 });
  }

  try {
    await confirmStagedAdminImageUpload({
      actorUserId: session.user.id,
      reference,
    });
    return Response.json({
      reference: reference satisfies StagedAdminImageReference,
    });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Nao foi possivel confirmar o upload.",
      },
      { status: 400 }
    );
  }
};
