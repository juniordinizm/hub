import { describe, expect, it } from "vitest";
import {
  parseAdjustEnrollmentExpirationInput,
  parseExtendEnrollmentExpirationInput,
  parseGrantEnrollmentFullContentAccessInput,
  parseSetEnrollmentExpirationInput,
} from "./enrollment-command-input";

describe("admin enrollment command inputs", () => {
  it("parses date-only expiration as the end of the selected day", () => {
    const formData = new FormData();
    formData.set("enrollmentId", "enrollment-1");
    formData.set("userId", "student-1");
    formData.set("reason", "Ajuste aprovado");
    formData.set("newExpiresAt", "2099-06-15");

    const previousTimeZone = process.env.TZ;
    process.env.TZ = "UTC";

    try {
      expect(parseSetEnrollmentExpirationInput(formData).newExpiresAt).toEqual(
        new Date("2099-06-16T02:59:59.999Z")
      );
    } finally {
      if (previousTimeZone === undefined) {
        delete process.env.TZ;
      } else {
        process.env.TZ = previousTimeZone;
      }
    }
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

  it("requires a reason for full content access", () => {
    const formData = new FormData();
    formData.set("enrollmentId", "enrollment-1");

    expect(() => parseGrantEnrollmentFullContentAccessInput(formData)).toThrow(
      "Informe o motivo da liberação."
    );
    formData.set("reason", "Liberacao excepcional aprovada");
    expect(parseGrantEnrollmentFullContentAccessInput(formData)).toEqual({
      enrollmentId: "enrollment-1",
      reason: "Liberacao excepcional aprovada",
    });
  });
});
