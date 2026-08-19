import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DatePickerField } from "./date-picker-field";

describe("DatePickerField", () => {
  it("accepts a Date value from a database projection", () => {
    const markup = renderToStaticMarkup(
      <DatePickerField
        defaultValue={new Date("2026-10-01T00:00:00.000Z")}
        name="launchDate"
      />
    );

    expect(markup).toContain('name="launchDate" value="2026-10-01"');
    expect(markup).toContain("01/10/2026");
  });
});
