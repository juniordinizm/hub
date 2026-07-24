import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  CertificateTemplateDomainError,
  CertificateTemplateValidationError,
} from "@/features/certificates/template-errors";
import {
  getExpectedCertificateTemplateActionMessage,
  saveAndPublishCertificateTemplate,
} from "./certificate-template-actions";

describe("certificate template action errors", () => {
  it("returns only messages from expected domain and validation failures", () => {
    expect(
      getExpectedCertificateTemplateActionMessage(
        new CertificateTemplateDomainError("Configure o perfil emissor.")
      )
    ).toBe("Configure o perfil emissor.");
    expect(
      getExpectedCertificateTemplateActionMessage(
        new CertificateTemplateValidationError("Cor invalida.")
      )
    ).toBe("Cor invalida.");
  });

  it("does not expose an unexpected infrastructure error", () => {
    expect(
      getExpectedCertificateTemplateActionMessage(
        new Error("password=secret database connection failed")
      )
    ).toBeNull();
  });
});

describe("saveAndPublishCertificateTemplate", () => {
  it("saves the submitted FormData before publishing its course", async () => {
    const order: string[] = [];
    const formData = new FormData();
    formData.set("courseId", "course-current");
    formData.set("spec", '{"backgroundKey":"current"}');

    await saveAndPublishCertificateTemplate({
      formData,
      publishDraft: (courseId) => {
        order.push(`publish:${courseId}`);
        return Promise.resolve();
      },
      saveDraft: (submitted) => {
        order.push(`save:${submitted.get("spec")}`);
        return Promise.resolve();
      },
    });

    expect(order).toEqual([
      'save:{"backgroundKey":"current"}',
      "publish:course-current",
    ]);
  });

  it("rejects a submission without a course before mutating", async () => {
    const publishDraft = vi.fn();
    const saveDraft = vi.fn();

    await expect(
      saveAndPublishCertificateTemplate({
        formData: new FormData(),
        publishDraft,
        saveDraft,
      })
    ).rejects.toThrow("Curso invalido");
    expect(saveDraft).not.toHaveBeenCalled();
    expect(publishDraft).not.toHaveBeenCalled();
  });
});
