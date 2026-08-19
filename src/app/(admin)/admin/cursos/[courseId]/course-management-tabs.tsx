"use client";

import { useSearchParams } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect, useRef } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const COURSE_MANAGEMENT_TABS = [
  { label: "Visão geral", value: "overview" },
  { label: "Conteúdo", value: "content" },
  { label: "Alunos", value: "students" },
  { label: "Configurações", value: "settings" },
  { label: "Certificado", value: "certificate" },
] as const;

type CourseManagementTab = (typeof COURSE_MANAGEMENT_TABS)[number]["value"];

interface CourseManagementTabsProps {
  certificate: ReactNode;
  content: ReactNode;
  overview: ReactNode;
  settings: ReactNode;
  students: ReactNode;
}

const isCourseManagementTab = (
  value: string | null
): value is CourseManagementTab =>
  COURSE_MANAGEMENT_TABS.some((tab) => tab.value === value);

const getActiveTab = (value: string | null): CourseManagementTab =>
  isCourseManagementTab(value) ? value : "overview";

export function CourseManagementTabs({
  certificate,
  content,
  overview,
  settings,
  students,
}: CourseManagementTabsProps): React.JSX.Element {
  const searchParams = useSearchParams();
  const activeTab = getActiveTab(searchParams.get("tab"));
  const tabStripRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const activeTrigger = tabStripRef.current?.querySelector<HTMLElement>(
      `[data-course-tab="${activeTab}"]`
    );
    activeTrigger?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [activeTab]);

  const changeTab = (value: string): void => {
    if (!isCourseManagementTab(value)) {
      return;
    }

    const nextSearchParams = new URLSearchParams(searchParams.toString());
    if (value === "overview") {
      nextSearchParams.delete("tab");
    } else {
      nextSearchParams.set("tab", value);
    }

    const query = nextSearchParams.toString();
    const nextUrl = `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`;
    window.history.pushState(null, "", nextUrl);
  };

  return (
    <Tabs onValueChange={changeTab} value={activeTab}>
      <div
        className="max-w-full overflow-x-auto border-b"
        data-course-tabs-scroll="true"
        ref={tabStripRef}
      >
        <TabsList className="min-w-max flex-nowrap" variant="line">
          {COURSE_MANAGEMENT_TABS.map((tab) => (
            <TabsTrigger
              data-course-tab={tab.value}
              key={tab.value}
              value={tab.value}
            >
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>

      <TabsContent className="space-y-6" value="overview">
        {overview}
      </TabsContent>
      <TabsContent className="space-y-6" value="content">
        {content}
      </TabsContent>
      <TabsContent className="space-y-5" value="students">
        {students}
      </TabsContent>
      <TabsContent className="space-y-6" value="settings">
        {settings}
      </TabsContent>
      <TabsContent
        className="space-y-5 data-[state=inactive]:hidden"
        forceMount
        value="certificate"
      >
        {certificate}
      </TabsContent>
    </Tabs>
  );
}
