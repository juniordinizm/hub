import { describe, expect, it } from "vitest";
import {
  buildContentReleaseScheduleSnapshot,
  hasDelayedModules,
  resolveLessonAvailability,
  resolveModuleContentRelease,
} from "./module-content-release";

const anchor = new Date("2026-01-01T00:00:00.000Z");
const day = 86_400_000;

describe("module content release rules", () => {
  it("keeps full access available regardless of delay", () => {
    expect(
      resolveModuleContentRelease({
        contentReleaseMode: "full_access",
        contentReleaseStartedAt: null,
        releaseDelayDays: 8,
        now: new Date(anchor.getTime() + day),
      })
    ).toEqual({ kind: "available" });
  });

  it("locks scheduled content until its relative release time", () => {
    const now = new Date(anchor.getTime() + 8 * day - 1);
    expect(
      resolveModuleContentRelease({
        contentReleaseMode: "scheduled",
        contentReleaseStartedAt: anchor,
        releaseDelayDays: 8,
        now,
      })
    ).toEqual({
      kind: "time_locked",
      availableAt: new Date(anchor.getTime() + 8 * day),
    });
  });

  it("releases scheduled content exactly at the boundary", () => {
    expect(
      resolveModuleContentRelease({
        contentReleaseMode: "scheduled",
        contentReleaseStartedAt: anchor,
        releaseDelayDays: 8,
        now: new Date(anchor.getTime() + 8 * day),
      })
    ).toEqual({ kind: "available" });
  });

  it("rejects a scheduled enrollment without an anchor", () => {
    expect(() =>
      resolveModuleContentRelease({
        contentReleaseMode: "scheduled",
        contentReleaseStartedAt: null,
        releaseDelayDays: 8,
        now: anchor,
      })
    ).toThrow("Matricula agendada sem inicio da entrega.");
  });

  it("lets completed lessons bypass both locks", () => {
    expect(
      resolveLessonAvailability({
        contentReleaseMode: "scheduled",
        contentReleaseStartedAt: anchor,
        releaseDelayDays: 8,
        isCompleted: true,
        isSequenceAvailable: false,
        now: anchor,
      })
    ).toEqual({ kind: "available" });
  });

  it("lets time locks take precedence over sequence locks", () => {
    expect(
      resolveLessonAvailability({
        contentReleaseMode: "scheduled",
        contentReleaseStartedAt: anchor,
        releaseDelayDays: 8,
        isCompleted: false,
        isSequenceAvailable: false,
        now: new Date(anchor.getTime() + day),
      })
    ).toEqual({
      kind: "time_locked",
      availableAt: new Date(anchor.getTime() + 8 * day),
    });
  });

  it("builds an ordered identifier-free schedule snapshot", () => {
    const snapshot = buildContentReleaseScheduleSnapshot([
      { title: "Segundo", sortOrder: 2, releaseDelayDays: 8, id: "secret" },
      { title: "Primeiro", sortOrder: 1, releaseDelayDays: 0 },
    ]);
    expect(snapshot).toEqual({
      version: 1,
      clock: "elapsed_24h",
      modules: [
        { title: "Primeiro", sortOrder: 1, releaseDelayDays: 0 },
        { title: "Segundo", sortOrder: 2, releaseDelayDays: 8 },
      ],
    });
    expect(hasDelayedModules(snapshot.modules)).toBe(true);
  });

  it("rejects unsafe delays and invalid dates", () => {
    expect(() =>
      resolveModuleContentRelease({
        contentReleaseMode: "full_access",
        contentReleaseStartedAt: null,
        releaseDelayDays: 1.5,
        now: anchor,
      })
    ).toThrow("Atraso de liberação inválido.");
    expect(() =>
      resolveModuleContentRelease({
        contentReleaseMode: "scheduled",
        contentReleaseStartedAt: new Date("invalid"),
        releaseDelayDays: 1,
        now: anchor,
      })
    ).toThrow("Âncora inválida.");
    expect(() =>
      resolveModuleContentRelease({
        contentReleaseMode: "scheduled",
        contentReleaseStartedAt: new Date(8_640_000_000_000_000),
        releaseDelayDays: 1,
        now: anchor,
      })
    ).toThrow("Data de liberação inválida.");
  });
});
