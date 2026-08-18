import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import { getE2eObjectStorageCorsHeaders } from "../src/features/storage/e2e-object-storage-cors";
import { getE2eObjectStorageMetadataHeaders } from "../src/features/storage/e2e-object-storage-metadata";

const PORT = 4568;
const LEADING_SLASH_PATTERN = /^\/+/;
const XML_KEY_PATTERN = /<Key>(.*?)<\/Key>/g;

interface StoredObject {
  body: Buffer;
  contentType: string;
  metadataHeaders: Record<string, string>;
}

const objects = new Map<string, StoredObject>();

const decodeXml = (value: string): string =>
  value
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'");

const getObjectId = (url: URL): string | null => {
  const path = decodeURIComponent(url.pathname).replace(
    LEADING_SLASH_PATTERN,
    ""
  );
  return path.includes("/") ? path : null;
};

const readRequestBody = async (request: IncomingMessage): Promise<Buffer> => {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
};

const deleteRequestedObjects = (source: string): void => {
  for (const match of source.matchAll(XML_KEY_PATTERN)) {
    const key = match[1];
    if (key) {
      for (const objectId of objects.keys()) {
        if (objectId.endsWith(`/${decodeXml(key)}`)) {
          objects.delete(objectId);
        }
      }
    }
  }
};

const sendXml = (
  response: ServerResponse,
  body: string,
  statusCode = 200
): void => {
  response.writeHead(statusCode, { "content-type": "application/xml" });
  response.end(body);
};

const handleRequest = async (
  request: IncomingMessage,
  response: ServerResponse
): Promise<void> => {
  const url = new URL(request.url ?? "/", `http://${request.headers.host}`);
  const corsHeaders = getE2eObjectStorageCorsHeaders({
    ...(request.headers.origin ? { origin: request.headers.origin } : {}),
    ...(request.headers["access-control-request-headers"]
      ? {
          requestedHeaders: request.headers["access-control-request-headers"],
        }
      : {}),
  });
  for (const [header, value] of Object.entries(corsHeaders)) {
    response.setHeader(header, value);
  }
  if (request.method === "OPTIONS") {
    response.writeHead(corsHeaders["access-control-allow-origin"] ? 204 : 403);
    response.end();
    return;
  }

  if (url.pathname === "/") {
    response.end("ready");
    return;
  }

  if (request.method === "POST" && url.searchParams.has("delete")) {
    deleteRequestedObjects((await readRequestBody(request)).toString("utf8"));
    sendXml(
      response,
      '<?xml version="1.0" encoding="UTF-8"?><DeleteResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/"/>'
    );
    return;
  }

  const objectId = getObjectId(url);
  if (!objectId) {
    response.writeHead(404).end("Not found");
    return;
  }

  if (request.method === "PUT") {
    objects.set(objectId, {
      body: await readRequestBody(request),
      contentType:
        request.headers["content-type"] ?? "application/octet-stream",
      metadataHeaders: getE2eObjectStorageMetadataHeaders(request.headers),
    });
    response.writeHead(200, { etag: '"e2e-object"' }).end();
    return;
  }

  const object = objects.get(objectId);
  if (!object) {
    sendXml(
      response,
      '<?xml version="1.0" encoding="UTF-8"?><Error><Code>NoSuchKey</Code></Error>',
      404
    );
    return;
  }

  response.setHeader("content-length", object.body.byteLength);
  response.setHeader("content-type", object.contentType);
  response.setHeader("etag", '"e2e-object"');
  const metadataHeaders = getE2eObjectStorageMetadataHeaders(
    object.metadataHeaders
  );
  for (const [headerName, headerValue] of Object.entries(metadataHeaders)) {
    response.setHeader(headerName, headerValue);
  }
  if (request.method === "HEAD") {
    response.end();
    return;
  }
  if (request.method === "GET") {
    response.end(object.body);
    return;
  }

  response.writeHead(405).end("Method not allowed");
};

const server = createServer((request, response) => {
  handleRequest(request, response).catch((error: unknown) => {
    response
      .writeHead(500)
      .end(error instanceof Error ? error.message : "Object storage failure");
  });
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`E2E object storage ready at http://127.0.0.1:${PORT}`);
});
