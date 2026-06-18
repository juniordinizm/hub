import { NextResponse } from "next/server";
import { proxyJmvstreamUploadPart } from "@/features/jmvstream/proxy-upload";
import { requireRole } from "@/lib/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const POST = async (request: Request): Promise<Response> => {
  await requireRole(["admin"]);

  const requestUrl = new URL(request.url);
  const targetUrl = requestUrl.searchParams.get("url");

  if (!targetUrl) {
    return NextResponse.json(
      { error: "URL assinada JMVStream ausente." },
      { status: 400 }
    );
  }

  const contentType =
    request.headers.get("x-upload-content-type") || "application/octet-stream";

  try {
    const etag = await proxyJmvstreamUploadPart({
      body: await request.arrayBuffer(),
      contentType,
      url: targetUrl,
    });

    return NextResponse.json({ etag });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Nao foi possivel enviar a parte do upload via proxy.",
      },
      { status: 502 }
    );
  }
};
