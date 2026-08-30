import { beforeEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({
  deleteR2Objects: vi.fn(),
  getPool: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/db", () => ({ getPool: dependencies.getPool }));
vi.mock("@/features/storage/r2", () => ({
  deleteR2Objects: dependencies.deleteR2Objects,
}));

import { reconcileExpiredLessonResourceUploads } from "./lesson-resource-upload-cleanup";

describe("expired lesson resource upload cleanup", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("deletes only unreferenced expired objects and then their sessions", async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [
          {
            lesson_id: "lesson-1",
            object_key: "lessons/lesson-1/resources/resource-1.pdf",
            preview_object_key:
              "lessons/lesson-1/resources/resource-1-preview.webp",
            resource_id: "resource-1",
          },
        ],
      })
      .mockResolvedValueOnce({ rowCount: 1, rows: [] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ referenced: false }] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [] });
    dependencies.getPool.mockReturnValue({ query });
    dependencies.deleteR2Objects.mockResolvedValue(undefined);

    await expect(
      reconcileExpiredLessonResourceUploads({
        now: new Date("2026-08-30T12:00:00.000Z"),
      })
    ).resolves.toBe(1);

    expect(dependencies.deleteR2Objects).toHaveBeenCalledWith([
      "lessons/lesson-1/resources/resource-1.pdf",
      "lessons/lesson-1/resources/resource-1-preview.webp",
    ]);
    expect(query.mock.calls[0]?.[0]).toContain("expires_at <=");
    expect(query.mock.calls[0]?.[0]).toContain("'cleaning'");
    expect(query.mock.calls[1]?.[0]).toContain("status = 'cleaning'");
    expect(query.mock.calls[4]?.[0]).toContain(
      "delete from staged_lesson_resource_uploads"
    );
  });

  it("keeps the object when another lesson or publication references it", async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [
          {
            lesson_id: "lesson-1",
            object_key: "lessons/lesson-1/resources/resource-1.pdf",
            preview_object_key: null,
            resource_id: "resource-1",
          },
        ],
      })
      .mockResolvedValueOnce({ rowCount: 1, rows: [] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ referenced: true }] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [] });
    dependencies.getPool.mockReturnValue({ query });

    await expect(
      reconcileExpiredLessonResourceUploads({
        now: new Date("2026-08-30T12:00:00.000Z"),
      })
    ).resolves.toBe(0);

    expect(dependencies.deleteR2Objects).not.toHaveBeenCalled();
  });

  it("keeps a cleaning session when the provider deletion fails", async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [
          {
            object_key: "lessons/lesson-1/resources/resource-1.pdf",
            preview_object_key: null,
            resource_id: "resource-1",
          },
        ],
      })
      .mockResolvedValueOnce({ rowCount: 1, rows: [] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ referenced: false }] })
      .mockResolvedValueOnce({ rowCount: 0, rows: [] });
    dependencies.getPool.mockReturnValue({ query });
    dependencies.deleteR2Objects.mockRejectedValue(new Error("R2 unavailable"));

    await expect(
      reconcileExpiredLessonResourceUploads({
        now: new Date("2026-08-30T12:00:00.000Z"),
      })
    ).resolves.toBe(0);

    expect(
      query.mock.calls.filter(
        ([sql]) =>
          String(sql).includes("delete from staged_lesson_resource_uploads") &&
          String(sql).includes("status = 'cleaning'")
      )
    ).toHaveLength(0);
  });
});
