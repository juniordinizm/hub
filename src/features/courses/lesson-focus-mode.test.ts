import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("lesson focus mode UI state", () => {
  it("keeps focus mode out of lesson URLs", async () => {
    const source = await readFile(
      new URL(
        "../../app/(student)/app/aulas/[lessonId]/page.tsx",
        import.meta.url
      ),
      "utf8"
    );

    expect(source).not.toContain("focus?:");
    expect(source).not.toContain("query.focus");
    expect(source).not.toContain("focusHref");
    expect(source).not.toContain('focus: "1"');
  });

  it("uses the project sidebar primitive for the lesson course sidebar", async () => {
    const source = await readFile(
      new URL(
        "../../app/(student)/app/aulas/[lessonId]/page.tsx",
        import.meta.url
      ),
      "utf8"
    );

    expect(source).toContain("Sidebar,");
    expect(source).toContain('collapsible="none"');
  });

  it("keeps the main sidebar trigger visible while focus mode is active", async () => {
    const source = await readFile(
      new URL("../../components/panel-layout.tsx", import.meta.url),
      "utf8"
    );

    expect(source).not.toContain("isFocusMode ? null : <SidebarTrigger");
  });

  it("keeps the lesson sidebar mounted so focus mode can animate it closed", async () => {
    const source = await readFile(
      new URL("../../components/lesson-focus-mode.tsx", import.meta.url),
      "utf8"
    );

    expect(source).toContain("h-[calc(100svh-4rem)] overflow-hidden");
    expect(source).toContain("custom-scrollbar min-w-0 overflow-y-auto");
    expect(source).toContain("transition-[grid-template-columns]");
    expect(source).toContain("lg:grid-cols-[minmax(0,1fr)_0px]");
    expect(source).not.toContain("isFocusMode ? null : sidebar");
  });

  it("opens the main sidebar and leaves focus mode in the same toggle", async () => {
    const source = await readFile(
      new URL("../../components/panel-layout.tsx", import.meta.url),
      "utf8"
    );

    expect(source).toContain("const [isMainSidebarOpen, setMainSidebarOpen]");
    expect(source).toContain("setMainSidebarOpen(open);");
    expect(source).toContain("open={isFocusMode ? false : isMainSidebarOpen}");
  });
});
