import {
  BookOpen01Icon,
  Certificate01Icon,
  HelpCircleIcon,
  Home01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { redirect } from "next/navigation";
import { SignOutButton } from "@/components/sign-out-button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
  SidebarMenuItem,
  SidebarMenuLink,
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

export default async function StudentLayout({
  children,
}: Readonly<{ children: React.ReactNode }>): Promise<React.JSX.Element> {
  const session = await requireSession();

  if (session.role !== "student") {
    redirect(route("/admin"));
  }

  const courses = await getStudentCourses(session.user.id);
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
            <p className="text-sidebar-foreground/55 text-xs">Área do aluno</p>
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
          </div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Menu</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuLink href={route("/app")}>
                    <HugeiconsIcon
                      icon={Home01Icon}
                      size={18}
                      strokeWidth={1.5}
                    />
                    <span>Início</span>
                  </SidebarMenuLink>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuLink href={route("/app/certificados")}>
                    <HugeiconsIcon
                      icon={Certificate01Icon}
                      size={18}
                      strokeWidth={1.5}
                    />
                    <span>Certificados</span>
                  </SidebarMenuLink>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuLink href={route("/app/perguntas-frequentes")}>
                    <HugeiconsIcon
                      icon={HelpCircleIcon}
                      size={18}
                      strokeWidth={1.5}
                    />
                    <span>Perguntas frequentes</span>
                  </SidebarMenuLink>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
          {courses.length ? (
            <SidebarGroup>
              <SidebarGroupLabel>Meus cursos</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {courses.map((course) => (
                    <SidebarMenuItem key={course.courseId}>
                      <SidebarMenuLink
                        className="h-auto py-2"
                        href={route(`/app/cursos/${course.courseId}`)}
                      >
                        <HugeiconsIcon
                          icon={BookOpen01Icon}
                          size={18}
                          strokeWidth={1.5}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate">{course.title}</span>
                          <span className="block text-sidebar-foreground/45 text-xs">
                            {course.progressPercent}% concluído
                          </span>
                        </span>
                      </SidebarMenuLink>
                    </SidebarMenuItem>
                  ))}
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
