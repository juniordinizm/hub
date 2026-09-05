import { beforeEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({
  logOperationalEvent: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/observability", () => ({
  createCorrelationId: () => "11111111-1111-4111-8111-111111111111",
  logOperationalEvent: dependencies.logOperationalEvent,
}));

import {
  classifyContentReleaseError,
  createContentReleaseDiagnostics,
  reportContentReleaseOperationalEvent,
} from "./content-release-observability";

describe("content release observability", () => {
  beforeEach(() => {
    dependencies.logOperationalEvent.mockReset();
  });

  it.each([
    ["Matricula agendada sem inicio da entrega.", "invalid_anchor"],
    ["Atraso de liberação inválido.", "invalid_delay"],
    ["Relógio inválida.", "invalid_clock"],
    ["Modo de liberação inválido.", "invalid_mode"],
  ] as const)("classifies %s", (message, reason) => {
    expect(classifyContentReleaseError(new Error(message))).toBe(reason);
  });

  it("reports one sanitized event per aggregate and reason", () => {
    const diagnostics = createContentReleaseDiagnostics();

    diagnostics.reportInvalidState({
      courseId: "course-1",
      reason: "invalid_anchor",
    });
    diagnostics.reportInvalidState({
      courseId: "course-1",
      reason: "invalid_anchor",
    });
    diagnostics.reportInvalidState({
      courseId: "course-1",
      reason: "invalid_delay",
    });

    expect(dependencies.logOperationalEvent).toHaveBeenCalledTimes(2);
    expect(dependencies.logOperationalEvent).toHaveBeenNthCalledWith(1, {
      aggregateId: "course-1",
      correlationId: "11111111-1111-4111-8111-111111111111",
      errorCode: "content_release_invalid_state",
      operation: "content_release.resolve.invalid_anchor",
      outcome: "failure",
    });
  });

  it("uses stable codes for conflicts and override decisions", () => {
    reportContentReleaseOperationalEvent({
      code: "content_release_digest_conflict",
      courseId: "course-1",
    });
    reportContentReleaseOperationalEvent({
      code: "content_release_override_granted",
      courseId: "course-1",
    });

    expect(dependencies.logOperationalEvent).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        errorCode: "content_release_digest_conflict",
        outcome: "failure",
      })
    );
    expect(dependencies.logOperationalEvent).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        errorCode: "content_release_override_granted",
        outcome: "success",
      })
    );
  });
});
