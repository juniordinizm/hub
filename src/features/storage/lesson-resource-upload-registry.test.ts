import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/db", () => ({ getPool: vi.fn() }));

import type { LessonResourceUploadQueryable } from "./lesson-resource-upload-registry";
import {
  consumeLessonResourceUpload,
  getLessonResourceUpload,
  getPreparedLessonResourceUpload,
  markLessonResourceUploadUploaded,
  registerLessonResourceUpload,
} from "./lesson-resource-upload-registry";

const reference = {
  contentType: "application/pdf",
  fileName: "material.pdf",
  id: "resource-1",
  key: "lessons/lesson-1/resources/resource-1-material.pdf",
  label: "material.pdf",
  sizeBytes: 3,
  storage: "r2" as const,
};

describe("lesson resource upload registry", () => {
  it("persists the actor, lesson and immutable reference metadata", async () => {
    const query = vi.fn(async () => ({ rowCount: 1, rows: [] }));

    await registerLessonResourceUpload({
      actorUserId: "admin-1",
      lessonId: "lesson-1",
      queryable: { query },
      reference,
    });

    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("insert into staged_lesson_resource_uploads"),
      expect.arrayContaining([
        reference.id,
        reference.key,
        "lesson-1",
        "admin-1",
        reference.contentType,
        reference.fileName,
        reference.sizeBytes,
      ])
    );
  });

  it("loads only a non-expired session owned by the actor and lesson", async () => {
    const query = vi.fn(async () => ({
      rowCount: 1,
      rows: [
        {
          actor_user_id: "admin-1",
          content_type: "application/pdf",
          expires_at: new Date("2026-08-30T17:00:00.000Z"),
          file_name: "material.pdf",
          lesson_id: "lesson-1",
          object_key: reference.key,
          preview_content_type: null,
          preview_height: null,
          preview_key: null,
          preview_size_bytes: null,
          preview_width: null,
          resource_id: reference.id,
          size_bytes: 3,
          status: "prepared",
        },
      ],
    }));

    await expect(
      getLessonResourceUpload({
        actorUserId: "admin-1",
        lessonId: "lesson-1",
        queryable: { query } as unknown as LessonResourceUploadQueryable,
        resourceId: reference.id,
      })
    ).resolves.toMatchObject({
      actorUserId: "admin-1",
      lessonId: "lesson-1",
      reference,
      status: "prepared",
    });

    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("expires_at > now()"),
      [reference.id, "lesson-1", "admin-1"]
    );
  });

  it("marks a session uploaded idempotently and later consumed", async () => {
    const query = vi.fn(async () => ({ rowCount: 1, rows: [] }));
    const queryable = {
      query,
    } as unknown as LessonResourceUploadQueryable;

    await markLessonResourceUploadUploaded({
      actorUserId: "admin-1",
      lessonId: "lesson-1",
      queryable,
      resourceId: reference.id,
    });
    await consumeLessonResourceUpload({
      actorUserId: "admin-1",
      lessonId: "lesson-1",
      queryable,
      resourceId: reference.id,
    });

    const calls = query.mock.calls as unknown as [string, unknown[]][];
    expect(calls[0]?.[0]).toContain("status = 'uploaded'");
    expect(calls[1]?.[0]).toContain("status = 'consumed'");
    expect(calls[0]?.[1]).toEqual([reference.id, "lesson-1", "admin-1"]);
  });

  it("loads only a prepared session for a transport retry", async () => {
    const query = vi.fn(async () => ({
      rowCount: 1,
      rows: [
        {
          actor_user_id: "admin-1",
          content_type: "application/pdf",
          expires_at: new Date("2026-08-30T17:00:00.000Z"),
          file_name: "material.pdf",
          lesson_id: "lesson-1",
          object_key: reference.key,
          preview_content_type: null,
          preview_height: null,
          preview_key: null,
          preview_size_bytes: null,
          preview_width: null,
          resource_id: reference.id,
          size_bytes: 3,
          status: "prepared",
        },
      ],
    }));

    await expect(
      getPreparedLessonResourceUpload({
        actorUserId: "admin-1",
        lessonId: "lesson-1",
        queryable: { query } as unknown as LessonResourceUploadQueryable,
        resourceId: reference.id,
      })
    ).resolves.toMatchObject({ status: "prepared" });
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("status = 'prepared'"),
      [reference.id, "lesson-1", "admin-1"]
    );
  });

  it("rejects a stored object key outside the lesson resource namespace", async () => {
    const query = vi.fn(async () => ({
      rowCount: 1,
      rows: [
        {
          actor_user_id: "admin-1",
          content_type: "application/pdf",
          expires_at: new Date("2026-08-30T17:00:00.000Z"),
          file_name: "material.pdf",
          lesson_id: "lesson-1",
          object_key: "lessons/other/resources/material.pdf",
          preview_content_type: null,
          preview_height: null,
          preview_key: null,
          preview_size_bytes: null,
          preview_width: null,
          resource_id: reference.id,
          size_bytes: 3,
          status: "prepared",
        },
      ],
    }));

    await expect(
      getLessonResourceUpload({
        actorUserId: "admin-1",
        lessonId: "lesson-1",
        queryable: { query } as unknown as LessonResourceUploadQueryable,
        resourceId: reference.id,
      })
    ).rejects.toThrow("Upload temporario invalido");
  });
});
