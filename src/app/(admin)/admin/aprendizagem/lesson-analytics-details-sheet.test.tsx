/** @vitest-environment jsdom */

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { LessonAnalyticsLessonReport } from "@/features/learning-analytics/types";
import { LessonAnalyticsDetailsSheet } from "./lesson-analytics-details-sheet";

const lesson: LessonAnalyticsLessonReport = {
  aggregate: {
    activeEnrollments: 5,
    completed: 5,
    errorCount: 3,
    medianCheckpointPercent: 70,
    medianHoursToComplete: 1.75,
    medianHoursToNextLesson: 2,
    started: 8,
  },
  courseAverageViewingPercent: 62.5,
  current: {
    activeEnrollments: 5,
    completed: 3,
    errorCount: 0,
    lessonTitle: "Aula atual",
    medianCheckpointPercent: 80,
    medianHoursToComplete: 1.5,
    medianHoursToNextLesson: 2,
    moduleTitle: "Módulo 1",
    publicationNumber: 2,
    publicationStatus: "published",
    started: 4,
  },
  curriculumKey: "curriculum-1",
  lessonTitle: "Aula atual",
  moduleTitle: "Módulo 1",
  position: 1,
  versions: [
    {
      activeEnrollments: 5,
      completed: 3,
      errorCount: 0,
      lessonTitle: "Aula atual",
      medianCheckpointPercent: 80,
      medianHoursToComplete: 1.5,
      medianHoursToNextLesson: 2,
      moduleTitle: "Módulo 1",
      publicationNumber: 2,
      publicationStatus: "published",
      started: 4,
    },
    {
      activeEnrollments: 0,
      completed: 2,
      errorCount: 3,
      lessonTitle: "Aula anterior",
      medianCheckpointPercent: 60,
      medianHoursToComplete: 2,
      medianHoursToNextLesson: null,
      moduleTitle: "Módulo antigo",
      publicationNumber: 1,
      publicationStatus: "retired",
      started: 4,
    },
  ],
};

describe("LessonAnalyticsDetailsSheet", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (
      globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    Object.defineProperty(globalThis, "ResizeObserver", {
      configurable: true,
      value: class {
        disconnect(): void {
          // Intentional no-op for Radix measurements in jsdom.
        }
        observe(): void {
          // Intentional no-op for Radix measurements in jsdom.
        }
        unobserve(): void {
          // Intentional no-op for Radix measurements in jsdom.
        }
      },
    });
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    document.body.innerHTML = "";
    Reflect.deleteProperty(globalThis, "ResizeObserver");
  });

  it("opens the current metrics and historical versions from the row action", () => {
    act(() =>
      root.render(<LessonAnalyticsDetailsSheet lesson={lesson} period="90d" />)
    );

    const trigger = container.querySelector<HTMLButtonElement>("button");
    expect(trigger?.textContent).toContain("Ver versões");
    expect(document.body.textContent).not.toContain("Histórico de versões");

    act(() => trigger?.click());

    expect(document.body.textContent).toContain(
      "Publicação vigente v2 · 3 meses"
    );
    expect(document.body.textContent).toContain("v1");
    expect(document.body.textContent).toContain("Retirada");
    expect(document.body.textContent).toContain("CM");
    expect(
      document.querySelector('abbr[title="Checkpoint mediano"]')
    ).not.toBeNull();
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
  });
});
