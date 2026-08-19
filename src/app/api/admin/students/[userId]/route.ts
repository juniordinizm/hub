import { getAdminStudentSheetData } from "@/features/admin/server";

export const dynamic = "force-dynamic";

const noStoreHeaders = { "Cache-Control": "no-store" };

export async function GET(
  request: Request,
  { params }: { params: Promise<{ userId: string }> }
): Promise<Response> {
  const { userId } = await params;
  const courseId = new URL(request.url).searchParams.get("courseId")?.trim();
  const data = await getAdminStudentSheetData({
    ...(courseId ? { courseId } : {}),
    userId,
  });

  if (!data) {
    return Response.json(
      { message: "Aluno não encontrado." },
      { headers: noStoreHeaders, status: 404 }
    );
  }

  return Response.json(data, { headers: noStoreHeaders });
}
