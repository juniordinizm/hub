/**
 * @vitest-environment jsdom
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  COURSE_COVER_CARD_HEIGHT,
  COURSE_COVER_CARD_WIDTH,
} from "@/features/storage/course-cover";
import { createCourseCoverCropFile } from "./course-cover-crop";

class LoadedImageMock {
  private readonly listeners = new Map<string, () => void>();

  addEventListener(name: string, listener: () => void): void {
    this.listeners.set(name, listener);
  }

  set src(_value: string) {
    this.listeners.get("load")?.();
  }
}

describe("course cover crop", () => {
  afterEach(() => vi.restoreAllMocks());

  it("renders the selected crop into the card's canonical 24:25 WebP artifact", async () => {
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

    const result = await createCourseCoverCropFile({
      crop: { height: 400, width: 800, x: 12, y: 34 },
      originalName: "curso.final.png",
      sourceUrl: "blob:source",
    });

    expect(result.name).toBe("curso.final-capa.webp");
    expect(result.type).toBe("image/webp");
    expect(drawImage).toHaveBeenCalledWith(
      expect.any(LoadedImageMock),
      12,
      34,
      800,
      400,
      0,
      0,
      COURSE_COVER_CARD_WIDTH,
      COURSE_COVER_CARD_HEIGHT
    );
    const canvas = renderedCanvas as unknown as HTMLCanvasElement;
    expect(canvas.width).toBe(COURSE_COVER_CARD_WIDTH);
    expect(canvas.height).toBe(COURSE_COVER_CARD_HEIGHT);
  });
});
