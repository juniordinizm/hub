/**
 * @vitest-environment jsdom
 */

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CourseWorkloadDialog } from "./course-workload-dialog";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

describe("CourseWorkloadDialog", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    document.body.innerHTML = "";
  });

  const renderDialog = (
    onValueChange: (value: number | null) => void
  ): void => {
    act(() => {
      root.render(
        <CourseWorkloadDialog
          calculatedHours={10}
          onValueChange={onValueChange}
          value={null}
        />
      );
    });
  };

  it("applies a manual workload override without saving the course", () => {
    const onValueChange = vi.fn();
    renderDialog(onValueChange);

    act(() => {
      container.querySelector<HTMLButtonElement>("button")?.click();
    });

    const modeSelect = document.querySelector<HTMLButtonElement>(
      "#course-workload-mode"
    );
    expect(modeSelect?.textContent).toContain("Automático");
    expect(
      document.querySelector<HTMLInputElement>(
        'input[name="workloadHoursOverrideDialog"]'
      )?.disabled
    ).toBe(true);

    act(() => {
      modeSelect?.click();
    });

    act(() => {
      Array.from(document.querySelectorAll<HTMLDivElement>("[role=option]"))
        .find((option) => option.textContent?.includes("Manual"))
        ?.click();
    });

    const input = document.querySelector<HTMLInputElement>(
      'input[name="workloadHoursOverrideDialog"]'
    );
    expect(input).not.toBeNull();
    expect(input?.disabled).toBe(false);

    act(() => {
      if (!input) {
        return;
      }
      Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value"
      )?.set?.call(input, "18");
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });

    act(() => {
      Array.from(document.querySelectorAll<HTMLButtonElement>("button"))
        .find((button) => button.textContent?.includes("Aplicar"))
        ?.click();
    });

    expect(onValueChange).toHaveBeenCalledWith(18);
  });

  it("uses null to restore automatic workload calculation", () => {
    const onValueChange = vi.fn();
    renderDialog(onValueChange);

    act(() => {
      container.querySelector<HTMLButtonElement>("button")?.click();
    });

    expect(
      document.querySelector("[data-slot=field-description]")?.textContent
    ).toContain("10 horas");

    act(() => {
      document
        .querySelector<HTMLButtonElement>('button[type="submit"]')
        ?.click();
    });

    expect(onValueChange).toHaveBeenCalledWith(null);
  });
});
