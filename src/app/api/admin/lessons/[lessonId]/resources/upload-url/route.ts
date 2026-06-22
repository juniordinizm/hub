import { getPool } from "@/db";
import { createLessonResourceUploadUrl } from "@/features/storage/r2";
import { requireRole } from "@/lib/session";

export const runtime = "nodejs";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const readString = (
  value: Record<string, unknown>,
  key: string
): string | null => {
  const candidate = value[key];
  return typeof candidate === "string" && candidate.trim()
    ? candidate.trim()
    : null;
};

const readNumber = (
  value: Record<string, unknown>,
  key: string
): number | null => {
  const candidate = value[key];
  return typeof candidate === "number" && Number.isFinite(candidate)
    ? candidate
    : null;
};

const readPreview = (body: Record<string, unknown>) => {
  const preview = body.preview;

  if (!isRecord(preview)) {
    return;
  }

  if (
    !(
      preview.contentType === "image/webp" &&
      typeof preview.height === "number" &&
      typeof preview.sizeBytes === "number" &&
      typeof preview.width === "number"
    )
  ) {
    return null;
  }

  return {
    contentType: "image/webp" as const,
    height: preview.height,
    sizeBytes: preview.sizeBytes,
    width: preview.width,
  };
};

const lessonExists = async (lessonId: string): Promise<boolean> => {
  const { rowCount } = await getPool().query(
    "select 1 from lessons where id = $1 limit 1",
    [lessonId]
  );
  return Number(rowCount) > 0;
};

export async function POST(
  request: Request,
  context: { params: Promise<{ lessonId: string }> }
): Promise<Response> {
  await requireRole(["admin"]);

  const { lessonId } = await context.params;

  if (!(lessonId && (await lessonExists(lessonId)))) {
    return Response.json({ error: "Aula nao encontrada." }, { status: 404 });
  }

  const body: unknown = await request.json();

  if (!isRecord(body)) {
    return Response.json({ error: "Dados invalidos." }, { status: 400 });
  }

  const fileName = readString(body, "fileName");
  const contentType = readString(body, "contentType");
  const sizeBytes = readNumber(body, "sizeBytes");
  const preview = readPreview(body);

  if (!(fileName && contentType && sizeBytes) || preview === null) {
    return Response.json({ error: "Dados invalidos." }, { status: 400 });
  }

  try {
    const signedUpload = await createLessonResourceUploadUrl({
      contentType,
      fileName,
      lessonId,
      preview,
      sizeBytes,
    });

    return Response.json(signedUpload);
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
}
