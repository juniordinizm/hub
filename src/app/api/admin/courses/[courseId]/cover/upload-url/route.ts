import { getPool } from "@/db";
import {
  type CourseCoverVariant,
  isCourseCoverVariant,
} from "@/features/storage/course-cover";
import { createCourseCoverUploadUrls } from "@/features/storage/r2";
import { requireRole } from "@/lib/session";

export const runtime = "nodejs";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const readOriginal = (body: Record<string, unknown>) => {
  const original = body.original;

  if (!isRecord(original)) {
    return null;
  }

  if (
    !(
      typeof original.contentType === "string" &&
      typeof original.fileName === "string" &&
      typeof original.sizeBytes === "number"
    )
  ) {
    return null;
  }

  return {
    contentType: original.contentType,
    fileName: original.fileName,
    sizeBytes: original.sizeBytes,
  };
};

const readVariants = (body: Record<string, unknown>) => {
  if (!Array.isArray(body.variants)) {
    return null;
  }

  const variants: Array<{
    contentType: string;
    sizeBytes: number;
    variant: CourseCoverVariant;
  }> = [];

  for (const candidate of body.variants) {
    if (!isRecord(candidate)) {
      return null;
    }

    if (
      !(
        typeof candidate.contentType === "string" &&
        typeof candidate.sizeBytes === "number" &&
        typeof candidate.variant === "string"
      )
    ) {
      return null;
    }

    if (!isCourseCoverVariant(candidate.variant)) {
      return null;
    }

    variants.push({
      contentType: candidate.contentType,
      sizeBytes: candidate.sizeBytes,
      variant: candidate.variant,
    });
  }

  return variants;
};

const courseExists = async (courseId: string): Promise<boolean> => {
  const { rowCount } = await getPool().query(
    "select 1 from courses where id = $1 limit 1",
    [courseId]
  );
  return Number(rowCount) > 0;
};

export async function POST(
  request: Request,
  context: { params: Promise<{ courseId: string }> }
): Promise<Response> {
  await requireRole(["admin"]);

  const { courseId } = await context.params;

  if (!(courseId && (await courseExists(courseId)))) {
    return Response.json({ error: "Curso nao encontrado." }, { status: 404 });
  }

  const body: unknown = await request.json();

  if (!isRecord(body)) {
    return Response.json({ error: "Dados invalidos." }, { status: 400 });
  }

  const original = readOriginal(body);
  const variants = readVariants(body);

  if (!(original && variants)) {
    return Response.json({ error: "Dados invalidos." }, { status: 400 });
  }

  try {
    return Response.json(
      await createCourseCoverUploadUrls({ courseId, original, variants })
    );
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Nao foi possivel preparar a capa.",
      },
      { status: 400 }
    );
  }
}
