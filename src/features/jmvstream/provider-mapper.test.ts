import { describe, expect, it } from "vitest";
import {
  getJmvstreamVideoPlacement,
  isJmvstreamVideoNotFoundError,
} from "./provider-mapper";

describe("JMVStream provider mapper", () => {
  it("maps the provider folder state to the course-gallery operation", () => {
    expect(getJmvstreamVideoPlacement({ galleryUuid: "course-1" })).toBe(
      "missing"
    );
    expect(
      getJmvstreamVideoPlacement({
        galleryUuid: "course-1",
        video: { folderUuid: "course-1" },
      })
    ).toBe("already_in_gallery");
    expect(
      getJmvstreamVideoPlacement({
        galleryUuid: "course-1",
        video: { folderUuid: "other" },
      })
    ).toBe("move");
  });

  it("recognizes only the provider's eventual-consistency absence", () => {
    expect(isJmvstreamVideoNotFoundError(new Error("video not found"))).toBe(
      true
    );
    expect(isJmvstreamVideoNotFoundError(new Error("permission denied"))).toBe(
      false
    );
  });
});
