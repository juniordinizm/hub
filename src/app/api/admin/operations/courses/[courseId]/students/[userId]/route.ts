import { getSupportStudentSheetData } from "@/features/admin/support-server";

export const dynamic = "force-dynamic";

const noStoreHeaders = { "Cache-Control": "no-store" };

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ courseId: string; userId: string }> }
): Promise<Response> {
  const { courseId, userId } = await params;
  const data = await getSupportStudentSheetData({ courseId, userId });

  if (!data) {
    return Response.json(
      { message: "Contexto não encontrado." },
      { headers: noStoreHeaders, status: 404 }
    );
  }

  return Response.json(data, { headers: noStoreHeaders });
}
