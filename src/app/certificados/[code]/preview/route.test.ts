import { beforeEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({
  consumePublicCertificateLookup: vi.fn(),
  getCertificatePreviewReadUrl: vi.fn(),
}));

vi.mock("@/features/certificates/public-rate-limit", () => ({
  consumePublicCertificateLookup: dependencies.consumePublicCertificateLookup,
}));
vi.mock("@/features/certificates/preview-server", () => ({
  getCertificatePreviewReadUrl: dependencies.getCertificatePreviewReadUrl,
}));

import { GET } from "./route";

const requestPreview = (code: string): Promise<Response> =>
  GET(new Request(`https://hub.example.test/certificados/${code}/preview`), {
    params: Promise.resolve({ code }),
  });

describe("GET /certificados/[code]/preview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dependencies.consumePublicCertificateLookup.mockResolvedValue("allowed");
    dependencies.getCertificatePreviewReadUrl.mockResolvedValue(
      "https://private-r2.example.test/preview"
    );
  });

  it("redirects to an inline private PNG preview", async () => {
    const response = await requestPreview("PRT-PREVIEW");

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "https://private-r2.example.test/preview"
    );
    expect(response.headers.get("content-type")).toBe("image/png");
    expect(response.headers.get("content-disposition")).toBe("inline");
    expect(response.headers.get("x-robots-tag")).toBe("noindex, nofollow");
  });

  it("does not redirect when no ready preview exists", async () => {
    dependencies.getCertificatePreviewReadUrl.mockResolvedValue(null);

    const response = await requestPreview("PRT-MISSING");

    expect(response.status).toBe(404);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("retry-after")).toBe("60");
  });
});
