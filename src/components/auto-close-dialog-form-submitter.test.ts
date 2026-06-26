import { describe, expect, it } from "vitest";
import { appendSubmitterValue } from "./auto-close-dialog-form";

describe("AutoCloseDialogForm submitter handling", () => {
  it("includes the clicked submit button name and value in server action form data", () => {
    const formData = new FormData();
    formData.set("reason", "Suporte");

    appendSubmitterValue(formData, {
      disabled: false,
      name: "days",
      value: "7",
    });

    expect(formData.get("reason")).toBe("Suporte");
    expect(formData.get("days")).toBe("7");
  });
});
