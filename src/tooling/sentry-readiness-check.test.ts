import { describe, expect, it } from "vitest";
import {
  fetchSentryReadinessEvidence,
  verifySentryReadinessEvidence,
} from "./sentry-readiness-check";

const eventId = "a".repeat(32);
const release = "b".repeat(40);
const event = {
  dateCreated: "2026-08-24T13:00:00.000Z",
  entries: [
    {
      data: {
        values: [
          {
            stacktrace: {
              frames: [{ filename: "src/lib/sentry-readiness.ts" }],
            },
          },
        ],
      },
      type: "exception",
    },
  ],
  eventID: eventId,
  release: { version: release },
  request: null,
  tags: [
    { key: "environment", value: "staging" },
    { key: "readiness_probe", value: "sentry" },
    { key: "release", value: release },
  ],
  user: null,
};
const workflows = [
  {
    enabled: true,
    environment: "staging",
    id: "workflow-1",
    lastTriggered: "2026-08-24T13:00:05.000Z",
    name: "Hub Production readiness",
  },
];
const detectors = [
  {
    enabled: true,
    projectId: "4511808556564480",
    workflowIds: ["workflow-1"],
  },
];

describe("Sentry readiness evidence", () => {
  it("accepts a source-mapped PII-free event that triggered the expected workflow", () => {
    expect(
      verifySentryReadinessEvidence({
        detectors,
        event,
        expected: {
          alertName: "Hub Production readiness",
          environment: "staging",
          eventId,
          projectId: "4511808556564480",
          release,
        },
        workflows,
      })
    ).toEqual([]);
  });

  it("allows Sentry-derived geolocation without allowing user identity fields", () => {
    expect(
      verifySentryReadinessEvidence({
        detectors,
        event: {
          ...event,
          user: {
            geo: {
              city: "Sao Paulo",
              country_code: "BR",
              region: "SP",
            },
          },
        },
        expected: {
          alertName: "Hub Production readiness",
          environment: "staging",
          eventId,
          projectId: "4511808556564480",
          release,
        },
        workflows,
      })
    ).toEqual([]);
  });

  it("rejects identity fields that accompany derived geolocation", () => {
    const errors = verifySentryReadinessEvidence({
      detectors,
      event: {
        ...event,
        user: {
          email: "student@example.test",
          geo: { country_code: "BR" },
        },
      },
      expected: {
        alertName: "Hub Production readiness",
        environment: "staging",
        eventId,
        projectId: "4511808556564480",
        release,
      },
      workflows,
    });

    expect(errors).toContain("event contains a sensitive attribute or value");
  });

  it("does not treat source-map frame context as runtime telemetry", () => {
    expect(
      verifySentryReadinessEvidence({
        detectors,
        event: {
          ...event,
          entries: [
            {
              data: {
                values: [
                  {
                    rawStacktrace: {
                      frames: [
                        {
                          context: [[1, 'const path = "/health?probe";']],
                          filename: "src/lib/sentry-readiness.ts",
                        },
                      ],
                    },
                  },
                ],
              },
              type: "exception",
            },
          ],
          user: {
            geo: { country_code: "BR" },
          },
        },
        expected: {
          alertName: "Hub Production readiness",
          environment: "staging",
          eventId,
          projectId: "4511808556564480",
          release,
        },
        workflows,
      })
    ).toEqual([]);
  });

  it("rejects PII, a minified-only frame and an alert not triggered by the event", () => {
    const errors = verifySentryReadinessEvidence({
      detectors,
      event: {
        ...event,
        entries: [
          {
            data: {
              values: [
                { stacktrace: { frames: [{ filename: "app/chunks/123.js" }] } },
              ],
            },
            type: "exception",
          },
        ],
        extra: { email: "student@example.test" },
      },
      expected: {
        alertName: "Hub Production readiness",
        environment: "staging",
        eventId,
        projectId: "4511808556564480",
        release,
      },
      workflows: [
        { ...workflows[0], lastTriggered: "2026-08-24T12:59:00.000Z" },
      ],
    });

    expect(errors).toContain("event contains a sensitive attribute or value");
    expect(errors).toContain(
      "exception frame does not resolve to src/lib/sentry-readiness.ts"
    );
    expect(errors).toContain("expected alert workflow did not reach the event");
  });

  it.each([401, 403])("fails closed on Sentry HTTP %i", async (status) => {
    const fetchImpl = async () =>
      new Response('{"detail":"redacted"}', { status });

    await expect(
      fetchSentryReadinessEvidence({
        authToken: "read-only-token",
        eventId,
        fetchImpl: fetchImpl as typeof fetch,
        organization: "neurocapacitar",
        project: "hub-development",
      })
    ).rejects.toThrow(`Sentry read failed with HTTP ${status}.`);
  });
});
