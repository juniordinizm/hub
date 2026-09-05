import { describe, expect, it, vi } from "vitest";
import { buildContentReleaseScheduleSnapshot } from "./module-content-release";
import { getContentReleaseScheduleDigest } from "./module-content-release-digest";

vi.mock("server-only", () => ({}));

describe("module content release digest", () => {
  it("is stable for the same canonical snapshot", () => {
    const snapshot = buildContentReleaseScheduleSnapshot([
      { releaseDelayDays: 0, sortOrder: 1, title: "Comece aqui" },
      { releaseDelayDays: 8, sortOrder: 2, title: "Aplicação" },
    ]);

    expect(getContentReleaseScheduleDigest(snapshot)).toBe(
      getContentReleaseScheduleDigest({
        ...snapshot,
        modules: [...snapshot.modules],
      })
    );
  });

  it.each([
    { releaseDelayDays: 9, sortOrder: 2, title: "Aplicação" },
    { releaseDelayDays: 8, sortOrder: 3, title: "Aplicação" },
    { releaseDelayDays: 8, sortOrder: 2, title: "Prática" },
  ])("changes when the schedule changes: %j", (changedModule) => {
    const baseline = buildContentReleaseScheduleSnapshot([
      { releaseDelayDays: 0, sortOrder: 1, title: "Comece aqui" },
      { releaseDelayDays: 8, sortOrder: 2, title: "Aplicação" },
    ]);
    const changed = buildContentReleaseScheduleSnapshot([
      { releaseDelayDays: 0, sortOrder: 1, title: "Comece aqui" },
      changedModule,
    ]);

    expect(getContentReleaseScheduleDigest(changed)).not.toBe(
      getContentReleaseScheduleDigest(baseline)
    );
  });
});
