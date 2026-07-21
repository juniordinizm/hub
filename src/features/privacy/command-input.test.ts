import { describe, expect, it } from "vitest";
import {
  parsePrivacyRequestIdentifierInput,
  parseRegisterPrivacyRequestInput,
} from "./command-input";

describe("privacy command inputs", () => {
  it("trims the registration command before it reaches persistence", () => {
    const formData = new FormData();
    formData.set("userId", " student-1 ");
    formData.set("reason", " Solicitacao da titular ");

    expect(parseRegisterPrivacyRequestInput(formData)).toEqual({
      reason: "Solicitacao da titular",
      userId: "student-1",
    });
  });

  it("rejects an empty approval or execution command", () => {
    expect(() => parsePrivacyRequestIdentifierInput(new FormData())).toThrow();
  });
});
