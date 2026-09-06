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

  it("keeps future lesson items visible but static in the course outline", async () => {
    const source = await readFile(
      new URL(
        "../../app/(student)/app/aulas/[lessonId]/page.tsx",
        import.meta.url
      ),
      "utf8"
    );

    expect(source).toContain("LessonSidebarItem");
    expect(source).toContain("AccordionContent");
    expect(source).toContain("formatLessonReleaseDate");
    expect(source).toContain('aria-disabled="true"');
    expect(source).not.toContain("Conclua a aula anterior para liberar");
  });

  it("uses a multi-open accordion for the lesson outline", async () => {
    const source = await readFile(
      new URL(
        "../../app/(student)/app/aulas/[lessonId]/page.tsx",
        import.meta.url
      ),
      "utf8"
    );

    expect(source).toContain("AccordionContent");
    expect(source).toContain("AccordionItem");
    expect(source).toContain("AccordionTrigger");
    expect(source).toContain('type="multiple"');
    expect(source).toContain("defaultValue={[activeModuleId]}");
  });

  it("groups each module lock reason in its header", async () => {
    const source = await readFile(
      new URL(
        "../../app/(student)/app/aulas/[lessonId]/page.tsx",
        import.meta.url
      ),
      "utf8"
    );

    expect(source).toContain('module.releaseState === "time_locked"');
    expect(source).toContain("Continue a sequência");
    expect(source).toContain("formatLessonReleaseDate(module.availableAt)");
    expect(source).not.toContain("<span>Em breve</span>");
    expect(source).not.toContain("Disponível em ${formatLessonReleaseDate");
  });

  it("keeps module triggers compact and lesson rows free of duration labels", async () => {
    const source = await readFile(
      new URL(
        "../../app/(student)/app/aulas/[lessonId]/page.tsx",
        import.meta.url
      ),
      "utf8"
    );

    expect(source).toContain("hover:no-underline focus:no-underline");
    expect(source).toContain("[&_a]:no-underline");
    expect(source).not.toContain("module.lessons.length} ");
    expect(source).not.toContain(
      "formatLessonDuration(lesson.durationSeconds)"
    );
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
