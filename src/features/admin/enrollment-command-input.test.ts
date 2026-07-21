import { describe, expect, it } from "vitest";
import {
  parseAdjustEnrollmentExpirationInput,
  parseExtendEnrollmentExpirationInput,
  parseSetEnrollmentExpirationInput,
} from "./enrollment-command-input";

describe("admin enrollment command inputs", () => {
  it("parses date-only expiration as the end of the selected day", () => {
    const formData = new FormData();
    formData.set("enrollmentId", "enrollment-1");
    formData.set("userId", "student-1");
    formData.set("reason", "Ajuste aprovado");
    formData.set("newExpiresAt", "2099-06-15");

    expect(parseSetEnrollmentExpirationInput(formData).newExpiresAt).toEqual(
      new Date(2099, 5, 15, 23, 59, 59, 999)
    );
  });

  it("keeps optional extension units absent instead of coercing invalid values", () => {
    const formData = new FormData();
    formData.set("enrollmentId", "enrollment-1");
    formData.set("reason", "Ajuste aprovado");
    formData.set("days", "not-a-number");

    expect(parseExtendEnrollmentExpirationInput(formData)).toMatchObject({
      days: null,
      enrollmentId: "enrollment-1",
      months: null,
    });
  });

  it("does not parse a date for an unsupported adjustment command", () => {
    const formData = new FormData();
    formData.set("adjustment", "unsupported");
    formData.set("enrollmentId", "enrollment-1");
    formData.set("reason", "Ajuste aprovado");

    expect(parseAdjustEnrollmentExpirationInput(formData)).toMatchObject({
      adjustment: "unsupported",
      newExpiresAtValue: "",
    });
  });
});
