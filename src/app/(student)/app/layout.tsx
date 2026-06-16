import {
  BookOpen01Icon,
  Certificate01Icon,
  HelpCircleIcon,
  Home01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SignOutButton } from "@/components/sign-out-button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarSeparator,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { getStudentCourses } from "@/features/courses/server";
import { route } from "@/lib/routes";
import { requireSession } from "@/lib/session";

const NAME_PARTS_PATTERN = /\s+/;

const getInitials = (name: string): string => {
  const [first = "", second = ""] = name.trim().split(NAME_PARTS_PATTERN);
  return `${first.slice(0, 1)}${second.slice(0, 1) || first.slice(1, 2)}`
    .toUpperCase()
    .slice(0, 2);
};

const getModuleHref = ({
  courseNextLessonId,
  moduleNextLessonId,
}: {
  courseNextLessonId: string | null;
  moduleNextLessonId: string | null;
}): string => {
  if (moduleNextLessonId) {
    return `/app/aulas/${moduleNextLessonId}`;
  }

  if (courseNextLessonId) {
    return `/app/aulas/${courseNextLessonId}`;
  }

  return "/app/certificados";
};

export default async function StudentLayout({
  children,
}: Readonly<{ children: React.ReactNode }>): Promise<React.JSX.Element> {
  const session = await requireSession();

  if (session.role !== "student") {
    redirect(route("/admin"));
  }

  const courses = await getStudentCourses(session.user.id);
  const currentCourse = courses[0];
  const initials = getInitials(session.user.name);

  return (
    <SidebarProvider className="h-svh overflow-hidden">
      <Sidebar
        className="border-sidebar-border bg-sidebar"
        collapsible="offcanvas"
      >
        <SidebarHeader className="px-5 pt-5 pb-0">
          <div className="border-sidebar-border border-b pb-4">
            <p className="font-black text-lg text-sidebar-foreground">
              PROTEA-R
            </p>
            <p className="text-sidebar-foreground/55 text-xs">Area do aluno</p>
          </div>
          <div className="border-sidebar-border border-b py-4">
            <div className="flex items-center gap-3">
              <Avatar className="size-9 shrink-0">
                <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p
                  className="truncate font-semibold text-sidebar-foreground text-sm"
                  title={session.user.name}
                >
                  {session.user.name}
                </p>
                <p
                  className="truncate text-sidebar-foreground/55 text-xs"
                  title={session.user.email}
                >
                  {session.user.email}
                </p>
              </div>
            </div>
            {currentCourse ? (
              <div className="mt-4">
                <div className="mb-1 flex items-center justify-between gap-3">
                  <span className="font-semibold text-[0.65rem] text-sidebar-foreground/45 uppercase tracking-[0.12em]">
                    Progresso
                  </span>
                  <span className="font-bold text-primary text-xs">
                    {currentCourse.progressPercent}%
                  </span>
                </div>
                <Progress
                  className="h-1 bg-primary/20"
                  value={currentCourse.progressPercent}
                />
              </div>
            ) : null}
          </div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Menu</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <Link href={route("/app")} legacyBehavior passHref>
                    <SidebarMenuButton asChild>
                      <a href={route("/app")}>
                        <HugeiconsIcon
                          icon={Home01Icon}
                          size={18}
                          strokeWidth={1.5}
                        />
                        <span>Inicio</span>
                      </a>
                    </SidebarMenuButton>
                  </Link>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <Link
                    href={route("/app/certificados")}
                    legacyBehavior
                    passHref
                  >
                    <SidebarMenuButton asChild>
                      <a href={route("/app/certificados")}>
                        <HugeiconsIcon
                          icon={Certificate01Icon}
                          size={18}
                          strokeWidth={1.5}
                        />
                        <span>Certificados</span>
                      </a>
                    </SidebarMenuButton>
                  </Link>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <Link
                    href={route("/app/perguntas-frequentes")}
                    legacyBehavior
                    passHref
                  >
                    <SidebarMenuButton asChild>
                      <a href={route("/app/perguntas-frequentes")}>
                        <HugeiconsIcon
                          icon={HelpCircleIcon}
                          size={18}
                          strokeWidth={1.5}
                        />
                        <span>Perguntas frequentes</span>
                      </a>
                    </SidebarMenuButton>
                  </Link>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
          {currentCourse?.modules.length ? (
            <SidebarGroup>
              <SidebarGroupLabel>Modulos</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {currentCourse.modules.map((moduleData) => {
                    const moduleHref = route(
                      getModuleHref({
                        courseNextLessonId: currentCourse.nextLessonId,
                        moduleNextLessonId: moduleData.nextLessonId,
                      })
                    );
                    return (
                      <SidebarMenuItem key={moduleData.id}>
                        <Link href={moduleHref} legacyBehavior passHref>
                          <SidebarMenuButton asChild>
                            <a href={moduleHref}>
                              <HugeiconsIcon
                                icon={BookOpen01Icon}
                                size={18}
                                strokeWidth={1.5}
                              />
                              <span>Modulo {moduleData.sortOrder}</span>
                            </a>
                          </SidebarMenuButton>
                        </Link>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ) : null}
        </SidebarContent>
        <SidebarSeparator />
        <SidebarFooter className="gap-3 px-5 pb-5">
          <SignOutButton className="w-full" variant="secondary" />
        </SidebarFooter>
      </Sidebar>
      <SidebarInset className="overflow-hidden">
        <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center border-border/40 border-b bg-background px-4 md:hidden">
          <SidebarTrigger />
          <span className="ml-3 font-semibold text-sm">PROTEA-R</span>
        </header>
        <ScrollArea className="h-[calc(100svh-3.5rem)] w-full md:h-svh">
          <div className="flex-1">{children}</div>
        </ScrollArea>
      </SidebarInset>
    </SidebarProvider>
  );
}
