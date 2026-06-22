import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LessonRichTextRenderer } from "./lesson-rich-text-renderer";

describe("LessonRichTextRenderer", () => {
  it("renders ProseMirror lesson documents to static React markup", () => {
    const markup = renderToStaticMarkup(
      <LessonRichTextRenderer
        document={{
          type: "doc",
          content: [
            {
              type: "heading",
              attrs: { level: 2 },
              content: [{ type: "text", text: "Resumo da aula" }],
            },
            {
              type: "paragraph",
              content: [
                { type: "text", text: "Leia o " },
                {
                  type: "text",
                  marks: [
                    {
                      type: "link",
                      attrs: {
                        href: "https://example.com/material",
                        target: "_blank",
                      },
                    },
                  ],
                  text: "material",
                },
                {
                  type: "text",
                  marks: [{ type: "bold" }],
                  text: " principal",
                },
              ],
            },
          ],
        }}
      />
    );

    expect(markup).toContain("<h2");
    expect(markup).toContain("Resumo da aula");
    expect(markup).toContain('href="https://example.com/material"');
    expect(markup).toContain("<strong");
  });
});
