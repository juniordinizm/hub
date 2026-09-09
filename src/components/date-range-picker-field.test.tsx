/**
 * @vitest-environment jsdom
 */

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  DateRangePickerField,
  isDateOutsideRange,
} from "./date-range-picker-field";
import { CalendarDayButton } from "./ui/calendar";

describe("DateRangePickerField", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (
      globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    document.body.innerHTML = "";
    (
      globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = false;
  });

  it("renders one control with separate form values for the range", () => {
    const markup = renderToStaticMarkup(
      <DateRangePickerField endName="finishDate" startName="startDate" />
    );

    expect(markup).toContain('name="startDate" value=""');
    expect(markup).toContain('name="finishDate" value=""');
    expect(markup).toContain("Selecionar período");
  });

  it("renders a persisted range in the trigger label", () => {
    const markup = renderToStaticMarkup(
      <DateRangePickerField
        defaultFinishValue="2026-08-31"
        defaultStartValue="2026-08-01"
        endName="finishDate"
        startName="startDate"
      />
    );

    expect(markup).toContain('name="startDate" value="2026-08-01"');
    expect(markup).toContain('name="finishDate" value="2026-08-31"');
    expect(markup).toContain("01/08/2026 – 31/08/2026");
  });

  it("keeps calendar day selection from submitting the containing form", () => {
    const markup = renderToStaticMarkup(
      <CalendarDayButton
        day={
          {
            date: new Date("2026-08-01T12:00:00.000Z"),
            displayMonth: new Date("2026-08-01T12:00:00.000Z"),
          } as never
        }
        modifiers={{}}
      />
    );

    expect(markup).toContain('type="button"');
  });

  it("keeps the popover open until the second date is selected", async () => {
    await act(async () => {
      root.render(
        <form>
          <DateRangePickerField endName="finishDate" startName="startDate" />
        </form>
      );
      await Promise.resolve();
    });

    const trigger = container.querySelector("button") as HTMLButtonElement;
    if (!trigger) {
      throw new Error("O gatilho do período não foi renderizado.");
    }
    await act(async () => {
      trigger.dispatchEvent(
        new MouseEvent("click", { bubbles: true, cancelable: true })
      );
      await Promise.resolve();
    });

    const getSelectableDays = (): HTMLButtonElement[] =>
      Array.from(
        document.querySelectorAll<HTMLButtonElement>(
          "button[data-day]:not([disabled])"
        )
      );
    const firstDay = getSelectableDays()[0];
    if (!firstDay) {
      throw new Error("Nenhum dia selecionável foi renderizado.");
    }

    await act(async () => {
      firstDay.dispatchEvent(
        new MouseEvent("click", { bubbles: true, cancelable: true })
      );
      await Promise.resolve();
    });

    expect(
      document.querySelector('[data-slot="popover-content"]')
    ).not.toBeNull();
    expect(
      (container.querySelector('input[name="finishDate"]') as HTMLInputElement)
        .value
    ).toBe("");

    const secondDay = getSelectableDays().find((day) => day !== firstDay);
    if (!secondDay) {
      throw new Error("Um segundo dia selecionável não foi renderizado.");
    }

    await act(async () => {
      secondDay.dispatchEvent(
        new MouseEvent("click", { bubbles: true, cancelable: true })
      );
      await Promise.resolve();
    });

    expect(document.querySelector('[data-slot="popover-content"]')).toBeNull();
  });

  it("supports a maximum selectable date for closed periods", () => {
    expect(
      isDateOutsideRange(new Date("2026-08-15T12:00:00.000Z"), {
        maxDate: "2026-08-15",
      })
    ).toBe(false);
    expect(
      isDateOutsideRange(new Date("2026-08-20T12:00:00.000Z"), {
        maxDate: "2026-08-15",
      })
    ).toBe(true);
  });
});
