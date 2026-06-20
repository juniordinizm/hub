import { type NextRequest, NextResponse } from "next/server";
import { isJmvstreamUploadProxyEnabled } from "@/features/jmvstream/proxy-upload";
import { getServerEnv } from "@/lib/env";
import { getCurrentSession } from "@/lib/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const POST = async (request: NextRequest): Promise<NextResponse> => {
  const session = await getCurrentSession();

  if (!(session && ["admin", "support"].includes(session.role))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const env = getServerEnv();
  const proxyEnabled = isJmvstreamUploadProxyEnabled({
    isVercel: env.VERCEL === "1",
    mode: env.JMVSTREAM_UPLOAD_PROXY_MODE,
    nodeEnv: env.NODE_ENV,
  });

  if (!proxyEnabled) {
    return NextResponse.json(
      {
        error:
          "Proxy de upload JMVStream desabilitado neste ambiente. Configure CORS/Expose-Headers: ETag na JMVStream/S3 ou use backend dedicado fora da Vercel.",
      },
      { status: 409 }
    );
  }

  const targetUrl = request.nextUrl.searchParams.get("url");

  if (!(targetUrl && isAllowedJmvstreamS3Url(targetUrl))) {
    return NextResponse.json({ error: "invalid_upload_url" }, { status: 400 });
  }

  const body = await request.arrayBuffer();
  const response = await fetch(targetUrl, {
    body,
    headers: {
      "Content-Type":
        request.headers.get("content-type") ?? "application/octet-stream",
    },
    method: "PUT",
  });

  if (!response.ok) {
    return NextResponse.json(
      { error: await readUploadError(response) },
      { status: response.status }
    );
  }

  const etag = response.headers.get("ETag");

  if (!etag) {
    return NextResponse.json({ error: "missing_etag" }, { status: 502 });
  }

  return new NextResponse(null, {
    headers: { ETag: etag },
    status: 200,
  });
};

const isAllowedJmvstreamS3Url = (value: string): boolean => {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname.endsWith(".jmvstream.com");
  } catch {
    return false;
  }
};

const readUploadError = async (response: Response): Promise<string> => {
  const message = await response.text();
  return message.trim() || "upload_part_failed";
};
