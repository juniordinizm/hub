/**
 * @vitest-environment jsdom
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { createCertificateCropFile } from "./template-crop";
import {
  CERTIFICATE_BACKGROUND_HEIGHT,
  CERTIFICATE_BACKGROUND_WIDTH,
} from "./template-image-contract";

class LoadedImageMock {
  private readonly listeners = new Map<string, () => void>();

  addEventListener(name: string, listener: () => void): void {
    this.listeners.set(name, listener);
  }

  set src(_value: string) {
    this.listeners.get("load")?.();
  }
}

describe("createCertificateCropFile", () => {
  afterEach(() => vi.restoreAllMocks());

  it("renders the selected crop into the canonical A4 WebP artifact", async () => {
    vi.stubGlobal("Image", LoadedImageMock);
    const drawImage = vi.fn();
    let renderedCanvas: HTMLCanvasElement | null = null;
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
      function getContext(this: HTMLCanvasElement) {
        renderedCanvas = this;
        return { drawImage } as unknown as CanvasRenderingContext2D;
      }
    );
    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(
      (callback, type) =>
        callback(new Blob(["webp"], type ? { type } : undefined))
    );

    const result = await createCertificateCropFile({
      crop: { height: 400, width: 800, x: 12, y: 34 },
      originalName: "certificado.final.png",
      sourceUrl: "blob:source",
    });

    expect(result.name).toBe("certificado.final-certificado.webp");
    expect(result.type).toBe("image/webp");
    expect(drawImage).toHaveBeenCalledWith(
      expect.any(LoadedImageMock),
      12,
      34,
      800,
      400,
      0,
      0,
      CERTIFICATE_BACKGROUND_WIDTH,
      CERTIFICATE_BACKGROUND_HEIGHT
    );
    const canvas = renderedCanvas as unknown as HTMLCanvasElement;
    expect(canvas.width).toBe(CERTIFICATE_BACKGROUND_WIDTH);
    expect(canvas.height).toBe(CERTIFICATE_BACKGROUND_HEIGHT);
  });
});
