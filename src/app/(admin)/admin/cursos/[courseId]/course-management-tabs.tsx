"use client";

import { useRouter, useSearchParams } from "next/navigation";
import type { ReactNode } from "react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ADMIN_COURSE_STUDENT_ID_PARAM } from "@/features/admin/student-navigation";

const COURSE_MANAGEMENT_TABS = [
  { label: "Visão geral", value: "overview" },
  { label: "Conteúdo", value: "content" },
  { label: "Alunos", value: "students" },
  { label: "Configurações", value: "settings" },
  { label: "Certificado", value: "certificate" },
] as const;

export type CourseManagementTab =
  (typeof COURSE_MANAGEMENT_TABS)[number]["value"];

interface CourseManagementTabsProps {
  certificate?: ReactNode;
  content?: ReactNode;
  overview?: ReactNode;
  settings?: ReactNode;
  students?: ReactNode;
}

interface CourseTabDirtyContextValue {
  setTabDirty: (
    tab: CourseManagementTab,
    sourceId: string,
    dirty: boolean
  ) => void;
}

type PendingNavigation =
  | { href: string; kind: "href" }
  | { kind: "tab"; tab: CourseManagementTab };

const CourseTabDirtyContext = createContext<
  CourseTabDirtyContextValue | undefined
>(undefined);

export function useCourseTabDirty(
  tab: CourseManagementTab,
  isDirty: boolean
): void {
  const context = useContext(CourseTabDirtyContext);
  const sourceId = useId();

  useEffect(() => {
    context?.setTabDirty(tab, sourceId, isDirty);
    return () => context?.setTabDirty(tab, sourceId, false);
  }, [context, isDirty, sourceId, tab]);

  useEffect(() => {
    if (!isDirty) {
      return;
    }

    const handleBeforeUnload = (event: BeforeUnloadEvent): void => {
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);
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
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeTab = getActiveTab(searchParams.get("tab"));
  const tabStripRef = useRef<HTMLDivElement>(null);
  const [dirtyTabs, setDirtyTabs] = useState<
    Partial<Record<CourseManagementTab, Set<string>>>
  >({});
  const [pendingNavigation, setPendingNavigation] =
    useState<PendingNavigation | null>(null);
  const currentUrlRef = useRef<string | null>(null);

  const setTabDirty = useCallback(
    (tab: CourseManagementTab, sourceId: string, dirty: boolean): void => {
      setDirtyTabs((current) => {
        const nextTabSources = new Set(current[tab] ?? []);
        if (dirty) {
          nextTabSources.add(sourceId);
        } else {
          nextTabSources.delete(sourceId);
        }
        if (
          nextTabSources.size === (current[tab]?.size ?? 0) &&
          [...nextTabSources].every((id) => current[tab]?.has(id))
        ) {
          return current;
        }
        if (nextTabSources.size === 0) {
          const { [tab]: _removed, ...rest } = current;
          return rest;
        }
        return { ...current, [tab]: nextTabSources };
      });
    },
    []
  );
  const dirtyContextValue = useMemo(() => ({ setTabDirty }), [setTabDirty]);

  useEffect(() => {
    const activeTrigger = tabStripRef.current?.querySelector<HTMLElement>(
      `[data-course-tab="${activeTab}"]`
    );
    activeTrigger?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [activeTab]);

  useEffect(() => {
    if (!dirtyTabs[activeTab]?.size) {
      return;
    }

    const handleDocumentClick = (event: MouseEvent): void => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }

      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }
      const anchor = target.closest<HTMLAnchorElement>("a[href]");
      if (
        !anchor ||
        anchor.hasAttribute("download") ||
        (anchor.target && anchor.target !== "_self")
      ) {
        return;
      }

      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#")) {
        return;
      }

      const url = new URL(href, window.location.href);
      if (
        url.origin !== window.location.origin ||
        url.href === window.location.href
      ) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      setPendingNavigation({
        href: `${url.pathname}${url.search}${url.hash}`,
        kind: "href",
      });
    };

    document.addEventListener("click", handleDocumentClick, true);
    return () =>
      document.removeEventListener("click", handleDocumentClick, true);
  }, [activeTab, dirtyTabs]);

  useEffect(() => {
    const readCurrentUrl = (): string =>
      `${window.location.pathname}${window.location.search}${window.location.hash}`;

    currentUrlRef.current ??= readCurrentUrl();
    const handlePopState = (event: PopStateEvent): void => {
      const nextUrl = readCurrentUrl();
      const currentUrl = currentUrlRef.current;

      if (!dirtyTabs[activeTab]?.size) {
        currentUrlRef.current = nextUrl;
        return;
      }
      if (!currentUrl || nextUrl === currentUrl) {
        return;
      }

      event.stopImmediatePropagation();
      window.history.pushState(window.history.state, "", currentUrl);
      setPendingNavigation({ href: nextUrl, kind: "href" });
    };

    window.addEventListener("popstate", handlePopState, true);
    return () => window.removeEventListener("popstate", handlePopState, true);
  }, [activeTab, dirtyTabs]);

  const navigateToTab = (value: CourseManagementTab): void => {
    const nextSearchParams = new URLSearchParams(searchParams.toString());
    if (value === "overview") {
      nextSearchParams.delete("tab");
    } else {
      nextSearchParams.set("tab", value);
    }
    if (value !== "students") {
      nextSearchParams.delete("enrollmentPage");
      nextSearchParams.delete("enrollmentQ");
      nextSearchParams.delete("enrollmentStatus");
      nextSearchParams.delete(ADMIN_COURSE_STUDENT_ID_PARAM);
      nextSearchParams.delete("enrollmentAction");
    }

    const query = nextSearchParams.toString();
    const nextUrl = `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`;
    currentUrlRef.current = nextUrl;
    setPendingNavigation(null);
    router.push(nextUrl);
  };

  const navigateToHref = (href: string): void => {
    currentUrlRef.current = href;
    setPendingNavigation(null);
    router.push(href);
  };

  const changeTab = (value: string): void => {
    if (!isCourseManagementTab(value)) {
      return;
    }
    if (value === activeTab) {
      return;
    }
    if (dirtyTabs[activeTab]?.size) {
      setPendingNavigation({ kind: "tab", tab: value });
      return;
    }
    navigateToTab(value);
  };

  return (
    <CourseTabDirtyContext.Provider value={dirtyContextValue}>
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
        <TabsContent className="space-y-5" value="certificate">
          {certificate}
        </TabsContent>
      </Tabs>

      <AlertDialog
        onOpenChange={(open) => {
          if (!open) {
            setPendingNavigation(null);
          }
        }}
        open={pendingNavigation !== null}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Alterações não salvas</AlertDialogTitle>
            <AlertDialogDescription>
              Esta seção tem alterações que ainda não foram salvas. Se você sair
              agora, elas serão perdidas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Continuar editando</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                if (pendingNavigation?.kind === "tab") {
                  navigateToTab(pendingNavigation.tab);
                } else if (pendingNavigation?.kind === "href") {
                  navigateToHref(pendingNavigation.href);
                }
              }}
              variant="destructive"
            >
              Sair sem salvar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </CourseTabDirtyContext.Provider>
  );
}
