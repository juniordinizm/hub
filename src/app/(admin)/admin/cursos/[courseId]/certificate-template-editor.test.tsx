/**
 * @vitest-environment jsdom
 */

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock("@/features/admin/actions", () => ({
  disableCertificateForCourseAction: vi.fn(),
  publishCertificateTemplateFormAction: vi.fn(),
  saveCertificateTemplateDraftFormAction: vi.fn(),
}));
vi.mock("@/features/admin/certificate-template-action-state", () => ({
  certificateTemplateInitialActionState: { status: "idle" },
}));

import { CertificateTemplateEditor } from "./certificate-template-editor";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

class ResizeObserverMock {
  disconnect = vi.fn();
  observe = vi.fn();
  unobserve = vi.fn();
}

describe("CertificateTemplateEditor", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    globalThis.ResizeObserver = ResizeObserverMock;
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("explains the issuer prerequisite and prevents premature publication", () => {
    act(() => {
      root.render(
        <CertificateTemplateEditor
          certificateEnabled={false}
          courseId="course-1"
          issuerConfigured={false}
          templates={[]}
        />
      );
    });

    expect(container.textContent).toContain("Perfil emissor pendente");
    expect(container.textContent).toContain("Dados de teste");
    const publishButton = [...container.querySelectorAll("button")].find(
      (button) => button.textContent?.includes("Publicar certificado")
    );
    expect(publishButton?.disabled).toBe(true);
  });
});
