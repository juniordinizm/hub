import { describe, expect, it } from "vitest";
import {
  formatResourceFileSize,
  getResourceExtension,
  getResourceTypeLabel,
} from "./resource-presentation";

describe("resource presentation", () => {
  it("classifies the same R2 extensions used by authoring and player", () => {
    expect(
      getResourceTypeLabel({
        fileName: "slides.PDF",
        label: "Slides",
        storage: "r2",
      })
    ).toBe("PDF");
    expect(
      getResourceTypeLabel({
        fileName: "dados.csv",
        label: "Dados",
        storage: "r2",
      })
    ).toBe("Planilha");
    expect(
      getResourceTypeLabel(
        { fileName: "aula.pptx", label: "Aula", storage: "r2" },
        { presentationLabel: "Apresentação" }
      )
    ).toBe("Apresentação");
    expect(
      getResourceExtension({
        label: "Link",
        storage: "external",
        url: "https://example.com/file.docx?download=1",
      })
    ).toBe("docx");
  });

  it("keeps metadata formatting deterministic", () => {
    expect(formatResourceFileSize(1024)).toBe("1 KB");
    expect(formatResourceFileSize(1_572_864)).toBe("1,5 MB");
  });
});
