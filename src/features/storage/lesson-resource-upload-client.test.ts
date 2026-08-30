import { afterEach, describe, expect, it, vi } from "vitest";
import { LESSON_SERVER_FALLBACK_MAX_BYTES } from "./lesson-resource-upload";
import { uploadLessonResource } from "./lesson-resource-upload-client";

const reference = {
  contentType: "application/pdf",
  fileName: "material.pdf",
  id: "resource-1",
  key: "lessons/lesson-1/resources/resource-1-material.pdf",
  label: "material.pdf",
  sizeBytes: 3,
  storage: "r2" as const,
};

const prepared = (uploadUrl: string) => ({
  expiresAt: "2026-08-30T16:00:00.000Z",
  reference,
  uploadUrl,
});

const createFile = (size = 3): File =>
  new File([new Uint8Array(size)], "material.pdf", {
    type: "application/pdf",
  });

describe("lesson resource upload client", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("keeps the prepared Content-Type on the signed PUT and confirms it", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(Response.json(prepared("https://r2.test/u1")))
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
      .mockResolvedValueOnce(Response.json({ reference }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      uploadLessonResource({ file: createFile(), lessonId: "lesson-1" })
    ).resolves.toEqual(reference);

    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "https://r2.test/u1",
      expect.objectContaining({
        body: expect.any(File),
        headers: { "Content-Type": "application/pdf" },
        method: "PUT",
      })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      "/api/admin/lessons/lesson-1/resources/confirm",
      expect.objectContaining({
        body: JSON.stringify({ resourceId: "resource-1" }),
        method: "POST",
      })
    );
  });

  it("reissues the URL and retries the same object key once", async () => {
    const renewedReference = { ...reference };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(Response.json(prepared("https://r2.test/u1")))
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce(
        Response.json({
          expiresAt: "2026-08-30T16:10:00.000Z",
          reference: renewedReference,
          uploadUrl: "https://r2.test/u2",
        })
      )
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
      .mockResolvedValueOnce(Response.json({ reference: renewedReference }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      uploadLessonResource({ file: createFile(), lessonId: "lesson-1" })
    ).resolves.toEqual(renewedReference);

    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      "/api/admin/lessons/lesson-1/resources/reissue-url",
      expect.objectContaining({
        body: JSON.stringify({ resourceId: "resource-1" }),
        method: "POST",
      })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      4,
      "https://r2.test/u2",
      expect.objectContaining({ method: "PUT" })
    );
    expect(fetchMock).toHaveBeenCalledTimes(5);
  });

  it("rejects a reissued response that changes the prepared object key", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(Response.json(prepared("https://r2.test/u1")))
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce(
        Response.json({
          expiresAt: "2026-08-30T16:10:00.000Z",
          reference: {
            ...reference,
            key: "lessons/other/resources/forged.pdf",
          },
          uploadUrl: "https://r2.test/u2",
        })
      );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      uploadLessonResource({ file: createFile(), lessonId: "lesson-1" })
    ).rejects.toThrow("material preparado");
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("uses the same-origin fallback only for a small file after the bounded retry", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(Response.json(prepared("https://r2.test/u1")))
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce(
        Response.json({
          expiresAt: "2026-08-30T16:10:00.000Z",
          reference,
          uploadUrl: "https://r2.test/u2",
        })
      )
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce(Response.json({ reference }));
    vi.stubGlobal("fetch", fetchMock);
    const file = createFile();

    await expect(
      uploadLessonResource({ file, lessonId: "lesson-1" })
    ).resolves.toEqual(reference);

    const fallbackRequest = fetchMock.mock.calls[4]?.[1] as RequestInit;
    const body = fallbackRequest.body as FormData;
    expect(fetchMock).toHaveBeenNthCalledWith(
      5,
      "/api/admin/lessons/lesson-1/resources/upload",
      expect.objectContaining({ method: "POST" })
    );
    expect(body.get("file")).toBe(file);
    expect(body.get("resourceId")).toBe("resource-1");
  });

  it("uploads an image preview with its separately signed Content-Type", async () => {
    const previewReference = {
      ...reference,
      preview: {
        contentType: "image/webp" as const,
        height: 180,
        key: "lessons/lesson-1/resources/resource-1-preview.webp",
        sizeBytes: 7,
        width: 320,
      },
    };
    const preview = {
      blob: new Blob(["preview"], { type: "image/webp" }),
      contentType: "image/webp" as const,
      height: 180,
      width: 320,
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({
          ...prepared("https://r2.test/u1"),
          previewUploadUrl: "https://r2.test/p1",
          reference: previewReference,
        })
      )
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
      .mockResolvedValueOnce(Response.json({ reference: previewReference }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      uploadLessonResource({
        file: createFile(),
        lessonId: "lesson-1",
        preview,
      })
    ).resolves.toEqual(previewReference);

    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      "https://r2.test/p1",
      expect.objectContaining({
        body: preview.blob,
        headers: { "Content-Type": "image/webp" },
        method: "PUT",
      })
    );
  });

  it("does not proxy a file larger than the fallback cap", async () => {
    const largeReference = {
      ...reference,
      sizeBytes: LESSON_SERVER_FALLBACK_MAX_BYTES + 1,
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({
          ...prepared("https://r2.test/u1"),
          reference: largeReference,
        })
      )
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce(
        Response.json({
          expiresAt: "2026-08-30T16:10:00.000Z",
          reference: largeReference,
          uploadUrl: "https://r2.test/u2",
        })
      )
      .mockRejectedValueOnce(new TypeError("Failed to fetch"));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      uploadLessonResource({
        file: createFile(LESSON_SERVER_FALLBACK_MAX_BYTES + 1),
        lessonId: "lesson-1",
      })
    ).rejects.toThrow("Atualize a página e tente novamente");

    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(fetchMock).not.toHaveBeenCalledWith(
      "/api/admin/lessons/lesson-1/resources/upload",
      expect.anything()
    );
  });

  it("does not retry indefinitely after the second direct failure", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(Response.json(prepared("https://r2.test/u1")))
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce(
        Response.json({
          expiresAt: "2026-08-30T16:10:00.000Z",
          reference,
          uploadUrl: "https://r2.test/u2",
        })
      )
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce(Response.json({ reference }));
    vi.stubGlobal("fetch", fetchMock);

    await uploadLessonResource({ file: createFile(), lessonId: "lesson-1" });

    const putCalls = fetchMock.mock.calls.filter(
      ([, init]) => (init as RequestInit | undefined)?.method === "PUT"
    );
    expect(putCalls).toHaveLength(2);
    expect(fetchMock).toHaveBeenCalledTimes(5);
  });

  it("does not surface a signed URL and includes the safe support correlation", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      Response.json(
        {
          correlationId: "1858430b-f149-40b6-97f4-56aac713d984",
          error:
            "R2 failed: https://r2.example.test/signed?X-Amz-Signature=secret",
        },
        { status: 400 }
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      uploadLessonResource({ file: createFile(), lessonId: "lesson-1" })
    ).rejects.toThrow(
      "Nao foi possivel preparar o upload. (ID de suporte: 1858430b-f149-40b6-97f4-56aac713d984)"
    );
  });
});
