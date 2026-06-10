import Link from "next/link";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
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
  const courses = await getStudentCourses(session.user.id);
  const currentCourse = courses[0];
  const initials = getInitials(session.user.name);

  return (
    <SidebarProvider>
      <Sidebar
        className="border-sidebar-border bg-sidebar"
        collapsible="offcanvas"
      >
        <SidebarHeader className="px-5 pt-5 pb-0">
          <div className="border-sidebar-border border-b pb-4">
            <p className="font-black text-lg text-sidebar-foreground">
              PROTEA-R
            </p>
            <p className="text-sidebar-foreground/55 text-xs">Area da aluna</p>
          </div>
          <div className="border-sidebar-border border-b py-4">
            <Avatar className="mb-3 size-11">
              <AvatarFallback className="bg-primary text-primary-foreground">
                {initials}
              </AvatarFallback>
            </Avatar>
            <p className="truncate font-semibold text-sidebar-foreground text-sm">
              {session.user.name}
            </p>
            <p className="text-sidebar-foreground/55 text-xs">
              Psicologa participante
            </p>
            {currentCourse ? (
              <div className="mt-3">
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
        <SidebarContent className="px-3">
          <SidebarGroup>
            <SidebarGroupLabel>Menu</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <Link href={route("/app")}>Inicio</Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <Link href={route("/app/certificados")}>Certificados</Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                {session.role === "student" ? null : (
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild>
                      <Link href={route("/admin")}>Admin</Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
          {currentCourse?.modules.length ? (
            <SidebarGroup>
              <SidebarGroupLabel>Modulos</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {currentCourse.modules.map((moduleData) => (
                    <SidebarMenuItem key={moduleData.id}>
                      <SidebarMenuButton asChild>
                        <Link
                          href={route(
                            getModuleHref({
                              courseNextLessonId: currentCourse.nextLessonId,
                              moduleNextLessonId: moduleData.nextLessonId,
                            })
                          )}
                        >
                          <span>Modulo {moduleData.sortOrder}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ) : null}
          <SidebarGroup>
            <SidebarGroupLabel>Suporte</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <Link href={route("/app")}>Perguntas frequentes</Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarSeparator />
        <SidebarFooter className="px-5 pb-5">
          <div className="min-w-0 rounded-xl bg-sidebar-accent p-3">
            <p className="truncate text-sidebar-foreground/70 text-xs">
              {session.user.email}
            </p>
          </div>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <header className="sticky top-0 z-10 flex h-14 items-center border-b bg-background/90 px-4 backdrop-blur md:hidden">
          <SidebarTrigger />
          <span className="ml-3 font-semibold text-sm">PROTEA-R</span>
        </header>
        {children}
      </SidebarInset>
    </SidebarProvider>
  );
}
