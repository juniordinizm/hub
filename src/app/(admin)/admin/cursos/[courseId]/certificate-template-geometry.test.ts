import { describe, expect, it } from "vitest";
import {
  fitCertificateFieldToContent,
  moveCertificateFieldByPixels,
  resizeCertificateFieldByPixels,
  snapCertificateFieldPosition,
} from "./certificate-template-geometry";

describe("certificate template geometry", () => {
  it("converts a pointer delta to normalized percentages and clamps it", () => {
    const field = { height: 10, width: 20, x: 90, y: 95 };

    expect(
      moveCertificateFieldByPixels(
        field,
        { x: 50, y: 50 },
        { height: 500, width: 1000 }
      )
    ).toEqual({
      ...field,
      x: 80,
      y: 90,
    });
  });

  it("does not mutate the source geometry when moving a field", () => {
    const field = { height: 5, width: 20, x: 10, y: 20 };

    const moved = moveCertificateFieldByPixels(
      field,
      { x: 25, y: -50 },
      { height: 500, width: 1000 }
    );

    expect(moved).toEqual({ height: 5, width: 20, x: 12.5, y: 10 });
    expect(field).toEqual({ height: 5, width: 20, x: 10, y: 20 });
  });

  it("resizes a field from the bottom-right handle and preserves page bounds", () => {
    const field = { height: 20, width: 30, x: 65, y: 70 };

    expect(
      resizeCertificateFieldByPixels(
        field,
        { x: 200, y: 200 },
        { height: 500, width: 1000 }
      )
    ).toEqual({ ...field, height: 40, width: 40, x: 60, y: 60 });
  });

  it("keeps a centered field centered when its width changes", () => {
    const field = { height: 10, width: 30, x: 35, y: 20 };

    expect(
      resizeCertificateFieldByPixels(
        field,
        { x: 100, y: 0 },
        { height: 500, width: 1000 },
        { anchor: "center" }
      )
    ).toMatchObject({ height: 10, width: 40, x: 30, y: 20 });
  });

  it("fits a field to measured content while preserving its center", () => {
    const field = { height: 10, width: 30, x: 35, y: 45 };

    expect(
      fitCertificateFieldToContent(
        field,
        { height: 40, width: 300 },
        { height: 500, width: 1000 }
      )
    ).toEqual({ height: 8, width: 30, x: 35, y: 46 });
  });

  it("keeps the rectangle center stable when width and height change", () => {
    const field = { height: 20, width: 30, x: 35, y: 40 };
    const resized = resizeCertificateFieldByPixels(
      field,
      { x: 100, y: 100 },
      { height: 500, width: 1000 },
      { anchor: "center" }
    );

    expect(resized).toMatchObject({ height: 40, width: 40, x: 30, y: 30 });
    expect(resized.x + resized.width / 2).toBe(field.x + field.width / 2);
    expect(resized.y + resized.height / 2).toBe(field.y + field.height / 2);
  });

  it("preserves the field aspect ratio when Shift resizing is enabled", () => {
    const field = { height: 10, width: 30, x: 35, y: 20 };
    const resized = resizeCertificateFieldByPixels(
      field,
      { x: 100, y: 0 },
      { height: 500, width: 1000 },
      { anchor: "center", preserveAspectRatio: true }
    );

    expect(resized.width / resized.height).toBeCloseTo(3, 1);
    expect(resized.x + resized.width / 2).toBeCloseTo(50, 1);
  });

  it("snaps a field to the page center within the tolerance", () => {
    const field = { height: 10, width: 20, x: 39.4, y: 44.6 };

    expect(snapCertificateFieldPosition(field, { x: 39.8, y: 44.9 })).toEqual({
      ...field,
      x: 40,
      y: 45,
    });
  });
});
