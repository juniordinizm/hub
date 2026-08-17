import { beforeEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({
  createR2ObjectReadUrl: vi.fn(),
  getPublicMediaUrl: vi.fn(),
  query: vi.fn(),
  requireRole: vi.fn(),
}));

vi.mock("@/db", () => ({ getPool: () => ({ query: dependencies.query }) }));
vi.mock("@/features/storage/r2", () => ({
  createR2ObjectReadUrl: dependencies.createR2ObjectReadUrl,
  getPublicMediaUrl: dependencies.getPublicMediaUrl,
}));
vi.mock("@/lib/session", () => ({ requireRole: dependencies.requireRole }));

import { GET } from "./route";

const coverImage = {
  original: {
    contentType: "image/png",
    fileName: "cover.png",
    key: "courses/course-1/cover/original.png",
    sizeBytes: 100,
  },
  variants: {
    card: {
      contentType: "image/webp",
      height: 1000,
      key: "courses/course-1/cover/card.webp",
      sizeBytes: 100,
      width: 960,
    },
  },
};

const getCover = async ({
  catalogVisibility,
  status,
}: {
  catalogVisibility: "hidden" | "listed";
  status: "active" | "draft";
}) => {
  dependencies.query.mockResolvedValue({
    rows: [
      {
        catalog_visibility: catalogVisibility,
        cover_image_json: coverImage,
        status,
      },
    ],
  });
  dependencies.getPublicMediaUrl.mockReturnValue(
    "https://media.example/card.webp"
  );
  dependencies.createR2ObjectReadUrl.mockResolvedValue(
    "https://private.example/card.webp"
  );
  return await GET(new Request("https://hub.example"), {
    params: Promise.resolve({ courseId: "course-1", variant: "card" }),
  });
};

describe("course cover delivery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each([
    ["active", "hidden"],
    ["draft", "listed"],
  ] as const)("serves a public cover for %s delivery with %s catalog visibility", async (status, catalogVisibility) => {
    const response = await getCover({ catalogVisibility, status });

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe(
      "https://media.example/card.webp"
    );
    expect(dependencies.requireRole).not.toHaveBeenCalled();
  });

  it("requires an operator for a hidden draft cover", async () => {
    const response = await getCover({
      catalogVisibility: "hidden",
      status: "draft",
    });

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe(
      "https://private.example/card.webp"
    );
    expect(dependencies.requireRole).toHaveBeenCalledWith(["admin", "support"]);
  });
});
